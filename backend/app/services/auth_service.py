"""Đăng nhập bằng chữ ký ví (P04-05): tạo challenge và kiểm chữ ký, consume nonce nguyên tử.

Message dựng lại từ các cột đã lưu (client không gửi message) theo khuôn EIP-4361.
Việc cấp access token (P04-06) nằm ở bước sau khi `verify_challenge` trả ví hợp lệ.
"""
import secrets
from datetime import datetime, timedelta, timezone

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, is_checksum_address
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import AuthNonce

NONCE_TTL = timedelta(minutes=5)
STATEMENT = "Đăng nhập Food Supply Chain Traceability. Chữ ký này không tạo giao dịch và không tốn phí."


class InvalidWallet(Exception):
    pass


class NonceInvalid(Exception):
    """Nonce không tồn tại, hết hạn, đã dùng hoặc không thuộc ví này (dùng chung một lỗi)."""


class SignatureInvalid(Exception):
    pass


def normalize_wallet(wallet: str) -> str:
    """Trả địa chỉ viết thường. Chữ hoa/thường lẫn lộn thì phải đúng checksum."""
    if not isinstance(wallet, str) or len(wallet) != 42 or not wallet.startswith("0x") or not is_address(wallet):
        raise InvalidWallet("Địa chỉ ví không hợp lệ")
    body = wallet[2:]
    if body != body.lower() and body != body.upper() and not is_checksum_address(wallet):
        raise InvalidWallet("Sai checksum địa chỉ ví")
    return wallet.lower()


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_message(row: AuthNonce) -> str:
    """Dựng thông điệp ký từ các cột đã lưu; challenge và verify dùng chung hàm này."""
    return (
        f"{row.domain} wants you to sign in with your Ethereum account:\n{row.wallet}\n\n{STATEMENT}\n\n"
        f"URI: https://{row.domain}\nChain ID: {row.chain_id}\nNonce: {row.nonce}\n"
        f"Issued At: {_iso(row.issued_at)}\nExpiration Time: {_iso(row.expires_at)}"
    )


def create_challenge(db: Session, wallet: str, settings: Settings, now: datetime | None = None) -> AuthNonce:
    if not settings.auth_domain or settings.chain_id is None:
        raise RuntimeError("Thiếu AUTH_DOMAIN hoặc CHAIN_ID trong cấu hình")
    now = (now or datetime.now(timezone.utc)).replace(microsecond=0)
    row = AuthNonce(
        wallet=normalize_wallet(wallet),
        nonce=secrets.token_urlsafe(24),
        domain=settings.auth_domain,
        chain_id=settings.chain_id,
        issued_at=now,
        expires_at=now + NONCE_TTL,
    )
    db.add(row)
    db.commit()
    return row


def verify_challenge(db: Session, wallet: str, nonce: str, signature: str) -> str:
    """Kiểm chữ ký rồi consume nonce nguyên tử; trả địa chỉ ví (viết thường).

    Chữ ký sai không đốt nonce. Hai request đồng thời cùng nonce: chỉ một request thắng.
    """
    wallet = normalize_wallet(wallet)
    row = db.scalar(select(AuthNonce).where(AuthNonce.nonce == nonce, AuthNonce.wallet == wallet))
    if row is None or row.used_at is not None:
        raise NonceInvalid()

    try:
        signer = Account.recover_message(encode_defunct(text=build_message(row)), signature=signature)
    except Exception:
        raise SignatureInvalid() from None
    if signer.lower() != wallet:
        raise SignatureInvalid()

    result = db.execute(
        text(
            "UPDATE auth_nonces SET used_at = now() "
            "WHERE nonce = :n AND wallet = :w AND used_at IS NULL AND expires_at > now()"
        ),
        {"n": nonce, "w": wallet},
    )
    db.commit()
    if result.rowcount != 1:
        raise NonceInvalid()
    return wallet
