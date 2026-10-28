"""Mã hóa tài liệu riêng (P04-04): AES-256-GCM, data key bọc bằng MASTER_KEY.

Mỗi tài liệu: data key 32 byte + IV 12 byte ngẫu nhiên (không dùng lại IV với cùng key).
AAD = schemaVersion|documentId|uploader (lưu đúng byte AAD trong DB). Gói lên IPFS chỉ gồm
phiên bản, IV, tag và ciphertext, KHÔNG kèm khóa. Data key bọc bằng MASTER_KEY (AES-GCM, IV mới):
DB lưu wrapped_key, wrap_iv, wrap_tag. Tag sai thì từ chối hoàn toàn. Không bao giờ log khóa.
"""
import base64
import binascii
import os
import re
import uuid
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY_BYTES = 32
IV_BYTES = 12
TAG_BYTES = 16
PACKAGE_MAGIC = b"FTE"  # + 1 byte schema_version + iv + tag + ciphertext
HEADER_BYTES = len(PACKAGE_MAGIC) + 1 + IV_BYTES + TAG_BYTES
_HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")


class CryptoConfigError(Exception):
    """MASTER_KEY thiếu hoặc sai định dạng."""


class CiphertextInvalid(Exception):
    """Gói mã hóa hỏng, bị sửa, hoặc không giải mã được (tag sai, khóa sai, AAD sai)."""


@dataclass(frozen=True)
class EncryptedDocument:
    package: bytes      # bytes để upload lên IPFS (không chứa khóa)
    aad: bytes          # lưu vào documents.aad
    wrapped_key: bytes  # documents.wrapped_key (32 byte)
    wrap_iv: bytes      # documents.wrap_iv (12 byte)
    wrap_tag: bytes     # documents.wrap_tag (16 byte)


def parse_master_key(value: str | None) -> bytes:
    """MASTER_KEY là 32 byte, viết dạng hex (64 ký tự) hoặc base64."""
    if not value:
        raise CryptoConfigError("Thiếu MASTER_KEY")
    value = value.strip()
    if _HEX64.match(value):
        return bytes.fromhex(value)
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raw = b""
    if len(raw) != KEY_BYTES:
        raise CryptoConfigError("MASTER_KEY phải là 32 byte (hex 64 ký tự hoặc base64)")
    return raw


def build_aad(schema_version: int, document_id: uuid.UUID, uploader: str) -> bytes:
    return f"{schema_version}|{document_id}|{uploader.lower()}".encode("utf-8")


def encrypt_document(
    plaintext: bytes, document_id: uuid.UUID, uploader: str, schema_version: int, master_key: bytes
) -> EncryptedDocument:
    if not 0 <= schema_version <= 255:
        raise ValueError("schema_version phải nằm trong 0..255")
    aad = build_aad(schema_version, document_id, uploader)

    data_key = AESGCM.generate_key(bit_length=256)
    iv = os.urandom(IV_BYTES)
    sealed = AESGCM(data_key).encrypt(iv, plaintext, aad)  # ciphertext || tag
    ciphertext, tag = sealed[:-TAG_BYTES], sealed[-TAG_BYTES:]
    package = PACKAGE_MAGIC + bytes([schema_version]) + iv + tag + ciphertext

    wrap_iv = os.urandom(IV_BYTES)
    wrapped = AESGCM(master_key).encrypt(wrap_iv, data_key, None)
    return EncryptedDocument(
        package=package, aad=aad, wrapped_key=wrapped[:-TAG_BYTES], wrap_iv=wrap_iv, wrap_tag=wrapped[-TAG_BYTES:]
    )


def decrypt_document(package: bytes, aad: bytes, wrapped_key: bytes, wrap_iv: bytes, wrap_tag: bytes,
                     master_key: bytes) -> bytes:
    """Giải mã; mọi lỗi (gói hỏng, tag sai, khóa sai, AAD sai) đều thành CiphertextInvalid."""
    if len(package) < HEADER_BYTES or not package.startswith(PACKAGE_MAGIC):
        raise CiphertextInvalid("Gói mã hóa không hợp lệ")
    offset = len(PACKAGE_MAGIC) + 1
    iv = package[offset:offset + IV_BYTES]
    tag = package[offset + IV_BYTES:offset + IV_BYTES + TAG_BYTES]
    ciphertext = package[HEADER_BYTES:]
    try:
        data_key = AESGCM(master_key).decrypt(wrap_iv, wrapped_key + wrap_tag, None)
        return AESGCM(data_key).decrypt(iv, ciphertext + tag, aad)
    except (InvalidTag, ValueError):
        raise CiphertextInvalid("Không giải mã được tài liệu") from None
