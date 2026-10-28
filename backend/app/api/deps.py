from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.session import get_session
from app.services import session_service
from app.services.chain import ChainClient, get_chain_client
from app.services.ipfs import PinataClient, get_pinata_client


def bearer_token(request: Request) -> str:
    """Lấy token từ header Authorization: Bearer ...; không dùng cookie."""
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token:
        raise ApiError(401, "UNAUTHENTICATED", "Thiếu hoặc sai access token")
    return token


def current_wallet(token: str = Depends(bearer_token), db: Session = Depends(get_session)) -> str:
    """Ví của phiên hợp lệ; token sai, hết hạn hoặc đã thu hồi đều là 401 như nhau."""
    wallet = session_service.wallet_for_token(db, token)
    if wallet is None:
        raise ApiError(401, "UNAUTHENTICATED", "Thiếu hoặc sai access token")
    return wallet


def get_chain() -> ChainClient:
    return get_chain_client()


def get_ipfs() -> PinataClient:
    return get_pinata_client()
