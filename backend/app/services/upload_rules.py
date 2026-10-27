"""Luật upload tài liệu (P04-02): giới hạn kích thước, kiểm nội dung thật, quyền người upload.

Thuần nghiệp vụ, không biết HTTP. Tầng API ánh xạ lỗi: FileTooLarge → 413 FILE_TOO_LARGE,
UnsupportedContent → 415 UNSUPPORTED_CONTENT, InvalidDocType → 422 INVALID_REQUEST,
RoleRequired → 403 ROLE_REQUIRED, ChainUnavailable → 503 CHAIN_UNAVAILABLE.
"""
import hashlib
import json
from typing import BinaryIO

from app.services.chain import ChainClient
from app.services.metadata import MetadataInvalid, check_metadata

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

PDF_MAGIC = b"%PDF-"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG"

# doc_type -> vai trò on-chain bắt buộc của người upload
ROLE_FOR_DOC_TYPE = {
    "certificate": "FARMER_ROLE",
    "image": "FARMER_ROLE",
    "metadata": "FARMER_ROLE",
    "invoice": "FARMER_ROLE",
    "incident_report": "RETAILER_ROLE",
}
# visibility suy ra từ doc_type, client không gửi
PRIVATE_DOC_TYPES = frozenset({"invoice"})


class InvalidDocType(Exception):
    pass


class FileTooLarge(Exception):
    pass


class UnsupportedContent(Exception):
    pass


class RoleRequired(Exception):
    def __init__(self, role: str):
        super().__init__(f"Cần vai trò {role}")
        self.role = role


def visibility_for(doc_type: str) -> str:
    _require_doc_type(doc_type)
    return "private" if doc_type in PRIVATE_DOC_TYPES else "public"


def read_limited(stream: BinaryIO, limit: int = MAX_UPLOAD_BYTES) -> bytes:
    """Đọc tối đa `limit` byte; vượt thì ném FileTooLarge (không nạp cả tệp khổng lồ vào bộ nhớ)."""
    data = stream.read(limit + 1)
    if len(data) > limit:
        raise FileTooLarge(f"Tệp vượt {limit} byte")
    return data


def validate_content(doc_type: str, content: bytes) -> str:
    """Kiểm kích thước và nội dung thật (magic bytes / parse JSON). Trả mime_type."""
    _require_doc_type(doc_type)
    if len(content) > MAX_UPLOAD_BYTES:
        raise FileTooLarge(f"Tệp vượt {MAX_UPLOAD_BYTES} byte")

    if doc_type in ("certificate", "invoice"):
        if not content.startswith(PDF_MAGIC):
            raise UnsupportedContent("Cần tệp PDF")
        return "application/pdf"
    if doc_type == "image":
        if content.startswith(JPEG_MAGIC):
            return "image/jpeg"
        if content.startswith(PNG_MAGIC):
            return "image/png"
        raise UnsupportedContent("Cần ảnh JPEG hoặc PNG")
    if doc_type == "metadata":
        try:
            check_metadata(content)
        except MetadataInvalid as exc:
            raise UnsupportedContent(str(exc)) from None
        return "application/json"
    try:  # incident_report
        json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise UnsupportedContent("Cần JSON hợp lệ mã hóa UTF-8") from None
    return "application/json"


def sha256_of(content: bytes) -> bytes:
    """SHA-256 trên byte gốc nhận được (không parse rồi ghi lại JSON)."""
    return hashlib.sha256(content).digest()


def require_uploader_role(chain: ChainClient, wallet: str, doc_type: str) -> None:
    """Đọc vai trò on-chain mỗi lần. RPC lỗi thì ChainUnavailable lan lên, không đoán quyền."""
    _require_doc_type(doc_type)
    role = ROLE_FOR_DOC_TYPE[doc_type]
    if not chain.has_role(wallet, role):
        raise RoleRequired(role)


def _require_doc_type(doc_type: str) -> None:
    if doc_type not in ROLE_FOR_DOC_TYPE:
        raise InvalidDocType(f"doc_type không hợp lệ: {doc_type}")
