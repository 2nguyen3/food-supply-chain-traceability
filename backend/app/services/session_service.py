"""Phiên đăng nhập (P04-06): access token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256 của token."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import AuthSession


def hash_token(token: str) -> bytes:
    return hashlib.sha256(token.encode("utf-8")).digest()


def create_session(db: Session, wallet: str, settings: Settings) -> tuple[str, datetime]:
    """Tạo phiên cho ví đã xác minh. Trả (token, expires_at); token chỉ trả về một lần."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(minutes=settings.token_ttl_minutes)
    db.add(AuthSession(wallet=wallet, token_hash=hash_token(token), expires_at=expires_at))
    db.commit()
    return token, expires_at


def wallet_for_token(db: Session, token: str) -> str | None:
    """Ví của phiên còn hiệu lực (chưa hết hạn, chưa thu hồi); không thì None. Thời gian lấy từ DB."""
    row = db.execute(
        text(
            "SELECT wallet FROM sessions "
            "WHERE token_hash = :h AND revoked_at IS NULL AND expires_at > now()"
        ),
        {"h": hash_token(token)},
    ).first()
    return row[0] if row else None


def revoke_session(db: Session, token: str) -> bool:
    """Thu hồi phiên; False nếu token không còn hiệu lực (kể cả đã thu hồi trước đó)."""
    result = db.execute(
        text(
            "UPDATE sessions SET revoked_at = now() "
            "WHERE token_hash = :h AND revoked_at IS NULL AND expires_at > now()"
        ),
        {"h": hash_token(token)},
    )
    db.commit()
    return result.rowcount == 1
