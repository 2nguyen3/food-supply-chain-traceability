"""I06: ciphertext hoặc tag sai thì từ chối hoàn toàn, không trả dữ liệu từng phần (P04-09)."""
import os
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import crypto
from conftest import assert_test_database


def _flip(b: bytes, i: int = -1) -> bytes:
    i = i % len(b)
    return b[:i] + bytes([b[i] ^ 1]) + b[i + 1:]


# ---- thư viện mã hóa ----
@pytest.fixture()
def sealed():
    mk, doc, up = os.urandom(32), uuid.uuid4(), "0x" + "ab" * 20
    plain = b"%PDF-1.7 HOA DON " + os.urandom(500)
    return mk, doc, up, plain, crypto.encrypt_document(plain, doc, up, 1, mk)


def open_(e, mk, **over):
    a = dict(package=e.package, aad=e.aad, wrapped_key=e.wrapped_key, wrap_iv=e.wrap_iv, wrap_tag=e.wrap_tag,
             master_key=mk)
    a.update(over)
    return crypto.decrypt_document(**a)


def test_roundtrip_and_package_hides_plaintext_and_key(sealed):
    mk, _, _, plain, e = sealed
    assert open_(e, mk) == plain
    assert plain[:20] not in e.package and e.wrapped_key not in e.package
    assert (len(e.wrapped_key), len(e.wrap_iv), len(e.wrap_tag)) == (32, 12, 16)


def test_each_encryption_uses_fresh_iv_and_key(sealed):
    mk, doc, up, plain, e = sealed
    e2 = crypto.encrypt_document(plain, doc, up, 1, mk)
    assert e.package != e2.package and e.wrap_iv != e2.wrap_iv and e.wrapped_key != e2.wrapped_key
    assert e.package[4:16] != e2.package[4:16]  # IV nội dung khác nhau


@pytest.mark.parametrize("label", [
    "ciphertext", "tag", "iv", "truncated", "magic", "aad_uploader", "aad_document", "wrapped_key", "wrap_tag", "master_key",
])
def test_tampering_is_rejected(sealed, label):
    mk, doc, up, _, e = sealed
    over = {
        "ciphertext": dict(package=_flip(e.package)),
        "tag": dict(package=_flip(e.package, crypto.HEADER_BYTES - 1)),
        "iv": dict(package=_flip(e.package, 5)),
        "truncated": dict(package=e.package[:20]),
        "magic": dict(package=b"XXX" + e.package[3:]),
        "aad_uploader": dict(aad=crypto.build_aad(1, doc, "0x" + "cd" * 20)),
        "aad_document": dict(aad=crypto.build_aad(1, uuid.uuid4(), up)),
        "wrapped_key": dict(wrapped_key=_flip(e.wrapped_key, 0)),
        "wrap_tag": dict(wrap_tag=_flip(e.wrap_tag, 0)),
        "master_key": dict(master_key=os.urandom(32)),
    }[label]
    with pytest.raises(crypto.CiphertextInvalid):
        open_(e, mk, **over)


@pytest.mark.parametrize("bad", [None, "", "abc", "g" * 64, "A" * 10])
def test_invalid_master_key_is_rejected(bad):
    with pytest.raises(crypto.CryptoConfigError):
        crypto.parse_master_key(bad)


# ---- qua API: không trả dữ liệu từng phần ----
def _private_doc(api):
    import io
    content = b"%PDF-1.7 HOA DON BI MAT " + os.urandom(300)
    r = api.client.post("/documents", headers=api.headers["farmerA"], data={"doc_type": "invoice"},
                        files={"file": ("f", io.BytesIO(content))})
    assert r.status_code == 201
    return r.json(), content


def _read(api, doc):
    return api.client.get(f"/documents/{doc['id']}/content", headers=api.headers["farmerA"])


def _assert_rejected(r, content):
    assert r.status_code == 502 and r.json()["error"]["code"] == "CIPHERTEXT_INVALID"
    assert content[:20] not in r.content and len(r.content) < 300


@pytest.mark.parametrize("where", ["last_byte", "tag", "truncated"])
def test_api_rejects_tampered_ciphertext(api, where):
    doc, content = _private_doc(api)
    original = api.ipfs.store[doc["cid"]]
    assert _read(api, doc).content == content
    api.ipfs.store[doc["cid"]] = {
        "last_byte": _flip(original),
        "tag": _flip(original, crypto.HEADER_BYTES - 1),
        "truncated": original[: len(original) // 2],
    }[where]
    _assert_rejected(_read(api, doc), content)


@pytest.mark.parametrize("column", ["aad", "wrapped_key", "wrap_tag", "wrap_iv"])
def test_api_rejects_tampered_key_material_in_db(api, column):
    doc, content = _private_doc(api)
    with Session(api.engine) as s:
        s.execute(text(f"UPDATE documents SET {column} = set_byte({column}, 0, get_byte({column}, 0) # 1) WHERE id = :i"),
                  {"i": doc["id"]})
        s.commit()
    _assert_rejected(_read(api, doc), content)


def test_api_rejects_when_master_key_changed(api):
    import secrets
    doc, content = _private_doc(api)
    api.settings.__dict__["master_key"] = secrets.token_hex(32)  # Settings frozen: đổi qua __dict__ cho test
    _assert_rejected(_read(api, doc), content)


def test_api_rejects_when_decrypted_content_does_not_match_stored_hash(api):
    doc, content = _private_doc(api)
    with Session(api.engine) as s:
        s.execute(text("UPDATE documents SET sha256 = :h WHERE id = :i"), {"h": b"\x00" * 32, "i": doc["id"]})
        s.commit()
    _assert_rejected(_read(api, doc), content)


def test_ipfs_fetch_failure_is_reported_not_faked(api):
    doc, _ = _private_doc(api)
    api.ipfs.fail_fetch = True
    r = _read(api, doc)
    assert r.status_code == 502 and r.json()["error"]["code"] == "IPFS_FETCH_FAILED"


# ---- guard: pytest từ chối chạy trên database không phải _test ----
@pytest.mark.parametrize("url", [
    "postgresql+psycopg://u:p@127.0.0.1:5432/food_dev",
    "postgresql+psycopg://u:p@127.0.0.1:5432/production",
    "",
])
def test_refuses_non_test_database(url):
    with pytest.raises(BaseException) as exc:
        assert_test_database(url)
    assert type(exc.value).__name__ == "Exit"


def test_accepts_test_database():
    url = "postgresql+psycopg://u:p@127.0.0.1:5432/food_test"
    assert assert_test_database(url) == url
