"""Tài liệu (P04-07): upload tạo draft, bind vào lô sau receipt, cấp/thu hồi quyền đọc.

Không biết HTTP: ném các lỗi nghiệp vụ bên dưới, tầng API ánh xạ sang mã HTTP (core/errors.py).
Chain và IPFS truyền vào qua tham số để thay bằng bản giả khi test.
"""
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core import crypto
from app.db.models import Document, DocumentGrant
from app.services import auth_service, upload_rules
from app.services.chain import ChainClient, ReceiptInvalid, ReceiptNotFound
from app.services.ipfs import PinataClient

SCHEMA_VERSION = 1
TX_HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")
BATCH_CREATED_TYPES = ("metadata", "certificate", "image")  # bind kèm receipt createBatch
EXTENSION = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "application/json": "json"}


class DocumentNotFound(Exception):
    pass


class NotUploader(Exception):
    pass


class AlreadyBound(Exception):
    pass


class TxReceiptInvalid(Exception):
    pass


class HashMismatch(Exception):
    pass


class DocumentIsPublic(Exception):
    pass


class WalletNotEligible(Exception):
    pass


class GrantNotFound(Exception):
    pass


class InvalidRequest(Exception):
    pass


class AccessDenied(Exception):
    pass


# ---------- upload ----------
def create_document(
    db: Session, ipfs: PinataClient, master_key: str | None, wallet: str, doc_type: str, content: bytes,
) -> Document:
    """Kiểm nội dung, mã hóa nếu là tài liệu riêng, upload IPFS rồi ghi draft (token_id NULL).

    Quyền người upload (`upload_rules.require_uploader_role`) do tầng API kiểm trước khi đọc tệp.
    """
    mime_type = upload_rules.validate_content(doc_type, content)
    visibility = upload_rules.visibility_for(doc_type)

    doc_id = uuid.uuid4()
    name = f"{doc_type}-{str(doc_id)[:8]}.{EXTENSION[mime_type]}"
    fields: dict = {}
    if visibility == "private":
        enc = crypto.encrypt_document(
            content, doc_id, wallet, SCHEMA_VERSION, crypto.parse_master_key(master_key)
        )
        cid = ipfs.upload(enc.package, name + ".enc", "application/octet-stream")  # chỉ ciphertext lên IPFS
        fields = {"aad": enc.aad, "wrapped_key": enc.wrapped_key, "wrap_iv": enc.wrap_iv, "wrap_tag": enc.wrap_tag}
    else:
        cid = ipfs.upload(content, name, mime_type)

    doc = Document(
        id=doc_id, uploader=wallet, visibility=visibility, doc_type=doc_type, cid=cid,
        sha256=upload_rules.sha256_of(content), mime_type=mime_type, size_bytes=len(content),
        schema_version=SCHEMA_VERSION, **fields,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ---------- bind ----------
def _load_owned(db: Session, wallet: str, doc_id: uuid.UUID) -> Document:
    doc = db.get(Document, doc_id)
    if doc is None:
        raise DocumentNotFound()
    if doc.uploader.lower() != wallet.lower():
        raise NotUploader()
    return doc


def bind_document(
    db: Session, chain: ChainClient, wallet: str, doc_id: uuid.UUID, token_id: str, tx_hash: str | None,
    from_block: int = 0,
) -> Document:
    doc = _load_owned(db, wallet, doc_id)
    if not isinstance(token_id, str) or not token_id.isdigit() or int(token_id) == 0:
        raise InvalidRequest("token_id phải là số nguyên dương dạng chuỗi")
    tid = int(token_id)

    from_receipt = doc.doc_type in BATCH_CREATED_TYPES
    if from_receipt:
        if not tx_hash or not TX_HASH.match(tx_hash):
            raise InvalidRequest("Cần tx_hash hợp lệ (0x + 64 ký tự hex)")
        tx_hash = tx_hash.lower()
    elif tx_hash is not None:
        raise InvalidRequest(f"{doc.doc_type} không dùng tx_hash")

    if doc.token_id is not None:  # đã gắn: lặp lại cùng dữ liệu thì trả kết quả cũ
        if int(doc.token_id) == tid and (doc.bind_tx_hash or None) == tx_hash:
            return doc
        raise AlreadyBound()

    if from_receipt:
        _check_receipt(chain, doc, tid, tx_hash)
    else:
        _check_post_mint(chain, doc, tid, from_block)

    result = db.execute(  # nguyên tử: chỉ một request gắn được
        text(
            "UPDATE documents SET token_id = :t, bind_tx_hash = :h WHERE id = :id AND token_id IS NULL"
        ),
        {"t": tid, "h": tx_hash, "id": doc.id},
    )
    db.commit()
    db.refresh(doc)
    if result.rowcount != 1 and not (int(doc.token_id) == tid and (doc.bind_tx_hash or None) == tx_hash):
        raise AlreadyBound()
    return doc


def _check_receipt(chain: ChainClient, doc: Document, tid: int, tx_hash: str) -> None:
    try:
        created = chain.get_batch_created(tx_hash)
    except ReceiptNotFound:
        raise TxReceiptInvalid("Chưa có receipt cho giao dịch này, thử lại sau vài giây") from None
    except ReceiptInvalid as exc:
        raise TxReceiptInvalid(str(exc)) from None
    if created["farmer"] != doc.uploader.lower():
        raise TxReceiptInvalid("Người tạo lô trong receipt không phải uploader")
    if created["token_id"] != tid:
        raise TxReceiptInvalid("tokenId trong receipt không khớp token_id")

    digest = bytes(doc.sha256)
    if doc.doc_type == "metadata":
        if digest != created["metadata_hash"] or doc.cid != created["metadata_cid"]:
            raise HashMismatch()
        return
    batch = chain.get_batch(tid)
    if batch is None:
        raise TxReceiptInvalid("Lô không tồn tại trên chain")
    expected = batch["certificateHash"] if doc.doc_type == "certificate" else batch["imageHash"]
    if digest != bytes(expected):
        raise HashMismatch()


def _check_post_mint(chain: ChainClient, doc: Document, tid: int, from_block: int) -> None:
    """invoice: uploader là Farmer đã tạo lô. incident_report: uploader là Retailer đang giữ lô."""
    if doc.doc_type == "invoice":
        creator = chain.get_batch_creator(tid, from_block)
        if creator is None:
            raise InvalidRequest("Lô không tồn tại")
        if creator != doc.uploader.lower():
            raise NotUploader()
    else:  # incident_report
        owner = chain.owner_of(tid)
        if owner is None:
            raise InvalidRequest("Lô không tồn tại")
        if owner.lower() != doc.uploader.lower():
            raise NotUploader()


# ---------- grants ----------
def grant_access(
    db: Session, chain: ChainClient, wallet: str, doc_id: uuid.UUID, target: str
) -> tuple[DocumentGrant, bool]:
    """Trả (grant, created). created=False khi đã có grant hoặc cấp lại sau khi thu hồi."""
    doc = _load_owned(db, wallet, doc_id)
    if doc.visibility != "private":
        raise DocumentIsPublic()
    target = auth_service.normalize_wallet(target)  # InvalidWallet
    if not chain.has_business_role(target):
        raise WalletNotEligible()

    grant = db.get(DocumentGrant, (doc.id, target))
    if grant is None:
        grant = DocumentGrant(document_id=doc.id, wallet=target, granted_by=wallet.lower())
        db.add(grant)
        db.commit()
        db.refresh(grant)
        return grant, True
    if grant.revoked_at is not None:  # cấp lại: cập nhật dòng cũ
        grant.revoked_at = None
        grant.granted_by = wallet.lower()
        grant.granted_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(grant)
    return grant, False


def revoke_grant(db: Session, wallet: str, doc_id: uuid.UUID, target: str) -> None:
    doc = _load_owned(db, wallet, doc_id)
    try:
        target = auth_service.normalize_wallet(target)
    except auth_service.InvalidWallet:
        raise GrantNotFound() from None
    grant = db.scalar(
        select(DocumentGrant).where(DocumentGrant.document_id == doc.id, DocumentGrant.wallet == target)
    )
    if grant is None or grant.revoked_at is not None:
        raise GrantNotFound()
    grant.revoked_at = datetime.now(timezone.utc)
    db.commit()


# ---------- đọc tài liệu riêng ----------
def read_private_document(
    db: Session, chain: ChainClient, ipfs: PinataClient, master_key: str | None, wallet: str, doc_id: uuid.UUID
) -> tuple[Document, bytes]:
    """Trả (tài liệu, bản rõ) nếu ví được phép đọc; mọi điều kiện kiểm lại mỗi lần gọi.

    Điều kiện: là uploader hoặc có grant chưa thu hồi, VÀ đang giữ vai trò nghiệp vụ trên contract.
    Admin không mặc nhiên đọc được. RPC lỗi thì ChainUnavailable (từ chối, không đoán quyền).
    """
    doc = db.get(Document, doc_id)
    if doc is None:
        raise DocumentNotFound()
    if doc.visibility != "private":
        raise DocumentIsPublic(f"Tài liệu công khai, đọc trực tiếp từ IPFS (cid={doc.cid})")

    wallet = wallet.lower()
    allowed = doc.uploader.lower() == wallet
    if not allowed:
        grant = db.get(DocumentGrant, (doc.id, wallet))
        allowed = grant is not None and grant.revoked_at is None
    if not allowed or not chain.has_business_role(wallet):
        raise AccessDenied()

    package = ipfs.fetch(doc.cid)
    plaintext = crypto.decrypt_document(
        package, bytes(doc.aad), bytes(doc.wrapped_key), bytes(doc.wrap_iv), bytes(doc.wrap_tag),
        crypto.parse_master_key(master_key),
    )
    if upload_rules.sha256_of(plaintext) != bytes(doc.sha256):  # bản rõ phải khớp hash lúc upload
        raise crypto.CiphertextInvalid("Nội dung giải mã không khớp hash đã lưu")
    return doc, plaintext
