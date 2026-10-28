from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: UUID
    doc_type: str
    visibility: str
    status: str  # draft | bound
    cid: str
    sha256: str
    mime_type: str
    size_bytes: int
    uploader: str
    token_id: str | None
    created_at: datetime


class BindRequest(BaseModel):
    token_id: str
    tx_hash: str | None = None


class BindResponse(BaseModel):
    id: UUID
    status: str
    token_id: str
    bind_tx_hash: str | None


class GrantRequest(BaseModel):
    wallet: str


class GrantOut(BaseModel):
    document_id: UUID
    wallet: str
    granted_by: str
    granted_at: datetime
    revoked_at: datetime | None
