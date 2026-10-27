from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import bearer_token, current_wallet
from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.db.session import get_session
from app.schemas.auth import ChallengeRequest, ChallengeResponse, VerifyRequest, VerifyResponse
from app.services import auth_service, session_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/challenge", response_model=ChallengeResponse)
def challenge(
    body: ChallengeRequest,
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    try:
        row = auth_service.create_challenge(db, body.wallet, settings)
    except auth_service.InvalidWallet as exc:
        raise ApiError(422, "INVALID_WALLET", str(exc)) from None
    return ChallengeResponse(
        wallet=row.wallet,
        nonce=row.nonce,
        domain=row.domain,
        chain_id=row.chain_id,
        issued_at=row.issued_at,
        expires_at=row.expires_at,
        message=auth_service.build_message(row),
    )


@router.post("/verify", response_model=VerifyResponse)
def verify(
    body: VerifyRequest,
    db: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    try:
        wallet = auth_service.verify_challenge(db, body.wallet, body.nonce, body.signature)
    except auth_service.InvalidWallet as exc:
        raise ApiError(422, "INVALID_WALLET", str(exc)) from None
    except auth_service.NonceInvalid:
        raise ApiError(401, "NONCE_INVALID", "Nonce không hợp lệ hoặc đã hết hạn") from None
    except auth_service.SignatureInvalid:
        raise ApiError(401, "SIGNATURE_INVALID", "Chữ ký không khớp với ví") from None
    token, expires_at = session_service.create_session(db, wallet, settings)
    return VerifyResponse(access_token=token, expires_at=expires_at, wallet=wallet)


@router.post("/logout", status_code=204)
def logout(
    token: str = Depends(bearer_token),
    _wallet: str = Depends(current_wallet),
    db: Session = Depends(get_session),
):
    session_service.revoke_session(db, token)
    return Response(status_code=204)
