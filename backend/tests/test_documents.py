"""I05: ACL theo tài liệu, grant/revoke và bind (P04-09). Chain và IPFS dùng bản giả."""
import io
import os

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from helpers import sha

PDF = b"%PDF-1.7 chung nhan mau"
PNG = b"\x89PNG\r\n\x1a\n" + b"x" * 64
TX = "0x" + "ab" * 32
TX_OTHER = "0x" + "cd" * 32


def upload(api, who, doc_type, content, expect=201):
    r = api.client.post("/documents", headers=api.headers[who], data={"doc_type": doc_type},
                        files={"file": ("f", io.BytesIO(content), "application/octet-stream")})
    assert r.status_code == expect, r.text
    return r


def err(r):
    return r.status_code, r.json()["error"]["code"]


def grant(api, owner, doc, wallet_name, expect=None):
    r = api.client.post(f"/documents/{doc['id']}/grants", headers=api.headers[owner],
                        json={"wallet": api.people[wallet_name].address})
    if expect:
        assert r.status_code == expect, r.text
    return r


def read(api, who, doc):
    headers = api.headers[who] if who else {}
    return api.client.get(f"/documents/{doc['id']}/content", headers=headers)


@pytest.fixture()
def invoice(api):
    """Farmer A upload invoice (private) cho lô; grant cho Logistics và Retailer."""
    content = b"%PDF-1.7 HOA DON BI MAT " + os.urandom(200)
    doc = upload(api, "farmerA", "invoice", content).json()
    api.chain.owners[1] = api.people["farmerA"].address.lower()
    api.chain.creators[1] = api.people["farmerA"].address.lower()
    grant(api, "farmerA", doc, "logistics", 201)
    grant(api, "farmerA", doc, "retailer", 201)
    return doc, content


# ---------------- I05: đọc tài liệu riêng ----------------
def test_acl_matrix_for_private_invoice(api, invoice):
    doc, content = invoice
    for who in ("farmerA", "logistics", "retailer"):
        r = read(api, who, doc)
        assert r.status_code == 200 and r.content == content, who
        assert r.headers["x-document-sha256"] == sha(content).hex()
        assert r.headers["cache-control"] == "no-store"
        assert r.headers["content-disposition"].startswith("attachment;")
    for who in ("farmerB", "admin", "stranger"):  # Farmer B, Admin (không grant), ví không vai trò
        assert err(read(api, who, doc)) == (403, "ACCESS_DENIED"), who
    assert read(api, None, doc).status_code == 401  # Consumer / không đăng nhập


def test_stored_ciphertext_does_not_contain_plaintext(api, invoice):
    doc, content = invoice
    assert content[:30] not in api.ipfs.store[doc["cid"]]
    assert not {"wrapped_key", "aad", "wrap_iv", "wrap_tag"} & set(doc)


def test_grant_loses_effect_when_onchain_role_is_revoked(api, invoice):
    doc, _ = invoice
    api.chain.take(api.people["logistics"].address, "LOGISTICS_ROLE")
    assert err(read(api, "logistics", doc)) == (403, "ACCESS_DENIED")


def test_revoke_blocks_later_reads_but_not_downloaded_copy(api, invoice):
    doc, content = invoice
    downloaded = read(api, "retailer", doc).content
    r = api.client.delete(f"/documents/{doc['id']}/grants/{api.people['retailer'].address}",
                          headers=api.headers["farmerA"])
    assert r.status_code == 204
    assert err(read(api, "retailer", doc)) == (403, "ACCESS_DENIED")
    assert downloaded == content


def test_admin_cannot_grant_itself_and_unknown_cross_access(api, invoice):
    doc, _ = invoice
    r = grant(api, "admin", doc, "admin")
    assert err(r) == (403, "NOT_UPLOADER")
    assert err(grant(api, "farmerB", doc, "farmerB")) == (403, "NOT_UPLOADER")
    unknown = {"id": "6d1f0a52-8a0e-4c7e-9b5f-2e3c1d7a9f10"}
    assert err(read(api, "farmerB", unknown)) == (404, "DOCUMENT_NOT_FOUND")


def test_rpc_failure_denies_instead_of_guessing(api, invoice):
    doc, _ = invoice
    api.chain.down = True
    r = read(api, "farmerA", doc)
    assert err(r) == (503, "CHAIN_UNAVAILABLE") and b"HOA DON" not in r.content


def test_public_document_is_not_served_by_content_endpoint(api):
    doc = upload(api, "farmerA", "certificate", PDF).json()
    r = read(api, "farmerA", doc)
    assert err(r) == (400, "DOCUMENT_IS_PUBLIC") and doc["cid"] in r.json()["error"]["message"]
    assert err(grant(api, "farmerA", doc, "logistics")) == (400, "DOCUMENT_IS_PUBLIC")


# ---------------- I05: grants ----------------
def test_grant_rules_and_regrant_updates_same_row(api, invoice):
    doc, _ = invoice
    assert grant(api, "farmerA", doc, "logistics").status_code == 200  # đã có, còn hiệu lực
    assert err(grant(api, "farmerA", doc, "stranger")) == (422, "WALLET_NOT_ELIGIBLE")
    r = api.client.post(f"/documents/{doc['id']}/grants", headers=api.headers["farmerA"], json={"wallet": "0x123"})
    assert err(r) == (422, "INVALID_WALLET")

    path = f"/documents/{doc['id']}/grants/{api.people['logistics'].address}"
    assert api.client.delete(path, headers=api.headers["farmerA"]).status_code == 204
    assert err(api.client.delete(path, headers=api.headers["farmerA"])) == (404, "GRANT_NOT_FOUND")
    assert api.client.delete(path, headers=api.headers["logistics"]).status_code == 403

    r = grant(api, "farmerA", doc, "logistics")
    assert r.status_code == 200 and r.json()["revoked_at"] is None
    with Session(api.engine) as s:
        n = s.execute(text("SELECT count(*) FROM document_grants WHERE document_id = :d AND wallet = :w"),
                      {"d": doc["id"], "w": api.people["logistics"].address.lower()}).scalar()
    assert n == 1


# ---------------- I05: bind ----------------
@pytest.fixture()
def lot(api):
    """Farmer A upload bộ 3 hồ sơ và 'mint' lô 1 trên chain giả (receipt TX)."""
    certificate = upload(api, "farmerA", "certificate", PDF).json()
    image = upload(api, "farmerA", "image", PNG).json()
    meta = _metadata_json()
    metadata = upload(api, "farmerA", "metadata", meta).json()
    api.chain.create_batch(1, api.people["farmerA"].address, TX, metadata["cid"], meta, PDF, PNG)
    return {"certificate": certificate, "image": image, "metadata": metadata, "meta_bytes": meta}


def _metadata_json() -> bytes:
    import json
    return json.dumps({
        "name": "COCONUT-001", "description": "d", "image": "ipfs://bafyimg", "batchCode": "COCONUT-001",
        "farmId": "FARM-A", "harvestGroupId": "HG-A01", "certificateURI": "ipfs://bafycert",
        "certificateSHA256": sha(PDF).hex(), "imageSHA256": sha(PNG).hex(), "schemaVersion": 1,
        "cultivar": "x", "fertilizer": "y", "farmLocation": "Ben Tre", "tempMin": 8, "tempMax": 15, "quantityKg": 1000,
    }).encode()


def bind(api, who, doc, token_id="1", tx=TX):
    body = {"token_id": token_id}
    if tx is not None:
        body["tx_hash"] = tx
    return api.client.post(f"/documents/{doc['id']}/bind", headers=api.headers[who], json=body)


def test_bind_three_batch_documents_with_correct_receipt(api, lot):
    for kind in ("certificate", "image", "metadata"):
        r = bind(api, "farmerA", lot[kind])
        assert r.status_code == 200 and r.json()["status"] == "bound" and r.json()["token_id"] == "1"
        assert r.json()["bind_tx_hash"] == TX


def test_bind_is_idempotent_and_blocks_cross_lot(api, lot):
    first = bind(api, "farmerA", lot["certificate"]).json()
    again = bind(api, "farmerA", lot["certificate"])
    assert again.status_code == 200 and again.json() == first
    with Session(api.engine) as s:
        assert s.execute(text("SELECT count(*) FROM documents WHERE token_id = 1")).scalar() == 1
    assert err(bind(api, "farmerA", lot["certificate"], token_id="2")) == (409, "ALREADY_BOUND")
    assert err(bind(api, "farmerA", lot["certificate"], tx=TX_OTHER)) == (409, "ALREADY_BOUND")


def test_bind_rejects_hash_mismatch(api, lot):
    other = upload(api, "farmerA", "certificate", b"%PDF-1.7 file khac").json()
    assert err(bind(api, "farmerA", other)) == (422, "HASH_MISMATCH")


def test_bind_rejects_bad_receipts(api, lot):
    cert = lot["certificate"]
    r = bind(api, "farmerA", cert, tx="0x" + "11" * 32)  # chưa có receipt
    assert err(r) == (422, "TX_RECEIPT_INVALID") and "receipt" in r.json()["error"]["message"]

    api.chain.receipts[TX_OTHER] = dict(api.chain.receipts[TX], invalid="Giao dịch không gửi tới contract này")
    assert err(bind(api, "farmerA", cert, tx=TX_OTHER)) == (422, "TX_RECEIPT_INVALID")  # sai contract / status

    api.chain.receipts[TX_OTHER] = dict(api.chain.receipts[TX], farmer=api.people["farmerB"].address.lower())
    assert err(bind(api, "farmerA", cert, tx=TX_OTHER)) == (422, "TX_RECEIPT_INVALID")  # sai uploader

    assert err(bind(api, "farmerA", cert, token_id="2")) == (422, "TX_RECEIPT_INVALID")  # sai tokenId
    assert bind(api, "farmerA", cert, tx=None).status_code == 422  # thiếu tx_hash
    assert bind(api, "farmerA", cert, tx="khong-phai-hash").status_code == 422
    assert bind(api, "farmerA", cert, token_id="abc").status_code == 422


def test_bind_requires_uploader_and_existing_document(api, lot):
    assert err(bind(api, "farmerB", lot["certificate"])) == (403, "NOT_UPLOADER")
    assert err(bind(api, "farmerA", {"id": "6d1f0a52-8a0e-4c7e-9b5f-2e3c1d7a9f10"})) == (404, "DOCUMENT_NOT_FOUND")


def test_bind_invoice_and_incident_without_tx(api, lot):
    inv = upload(api, "farmerA", "invoice", b"%PDF-1.7 hoa don").json()
    assert bind(api, "farmerA", inv, tx=None).status_code == 200  # Farmer tạo lô
    inv_b = upload(api, "farmerB", "invoice", b"%PDF-1.7 hoa don B").json()
    assert err(bind(api, "farmerB", inv_b, tx=None)) == (403, "NOT_UPLOADER")  # không phải người tạo lô
    assert bind(api, "farmerA", upload(api, "farmerA", "invoice", b"%PDF-1.7 x").json(), token_id="9", tx=None).status_code == 422

    inc = upload(api, "retailer", "incident_report", b'{"note": "x"}').json()
    assert err(bind(api, "retailer", inc, tx=None)) == (403, "NOT_UPLOADER")  # chưa giữ lô
    api.chain.owners[1] = api.people["retailer"].address.lower()
    assert bind(api, "retailer", inc, tx=None).status_code == 200


# ---------------- upload: quyền, kích thước, nội dung ----------------
def test_upload_rejections(api):
    assert err(upload(api, "stranger", "certificate", PDF, 403)) == (403, "ROLE_REQUIRED")
    assert err(upload(api, "retailer", "certificate", PDF, 403)) == (403, "ROLE_REQUIRED")
    assert err(upload(api, "farmerA", "certificate", b"<html>gia pdf", 415)) == (415, "UNSUPPORTED_CONTENT")
    assert err(upload(api, "farmerA", "image", b"\xff\xd8\xff" + b"0" * (10 * 1024 * 1024), 413)) == (413, "FILE_TOO_LARGE")
    upload(api, "farmerA", "foo", PDF, 422)
    assert api.client.post("/documents", data={"doc_type": "image"}, files={"file": ("f", io.BytesIO(PNG))}).status_code == 401
    api.ipfs.fail_upload = True
    assert err(upload(api, "farmerA", "certificate", PDF, 502)) == (502, "IPFS_UPLOAD_FAILED")
    with Session(api.engine) as s:  # upload IPFS lỗi thì không tạo bản ghi
        assert s.execute(text("SELECT count(*) FROM documents")).scalar() == 0
