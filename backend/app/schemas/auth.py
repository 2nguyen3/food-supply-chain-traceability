from datetime import datetime

from pydantic import BaseModel


class ChallengeRequest(BaseModel):
    wallet: str


class ChallengeResponse(BaseModel):
    wallet: str
    nonce: str
    domain: str
    chain_id: int
    issued_at: datetime
    expires_at: datetime
    message: str


class VerifyRequest(BaseModel):
    wallet: str
    nonce: str
    signature: str


class VerifyResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    wallet: str
