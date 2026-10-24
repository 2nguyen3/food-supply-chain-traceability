import uuid
from datetime import datetime

from sqlalchemy import (
    CHAR,
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    Numeric,
    Text,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuthNonce(Base):
    __tablename__ = "auth_nonces"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    wallet: Mapped[str] = mapped_column(CHAR(42), nullable=False)
    nonce: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    domain: Mapped[str] = mapped_column(Text, nullable=False)
    chain_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuthSession(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    wallet: Mapped[str] = mapped_column(CHAR(42), nullable=False)
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint("visibility IN ('public', 'private')", name="ck_documents_visibility"),
        CheckConstraint(
            "doc_type IN ('certificate', 'image', 'metadata', 'invoice', 'incident_report')",
            name="ck_documents_doc_type",
        ),
        Index("ix_documents_token_id", "token_id"),
        Index("ix_documents_uploader", "uploader"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    uploader: Mapped[str] = mapped_column(CHAR(42), nullable=False)
    token_id: Mapped[int | None] = mapped_column(Numeric(78, 0), nullable=True)
    bind_tx_hash: Mapped[str | None] = mapped_column(CHAR(66), nullable=True)
    visibility: Mapped[str] = mapped_column(Text, nullable=False)
    doc_type: Mapped[str] = mapped_column(Text, nullable=False)
    cid: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    aad: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    wrapped_key: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    wrap_iv: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    wrap_tag: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class DocumentGrant(Base):
    __tablename__ = "document_grants"

    document_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("documents.id"), primary_key=True, nullable=False
    )
    wallet: Mapped[str] = mapped_column(CHAR(42), primary_key=True, nullable=False)
    granted_by: Mapped[str] = mapped_column(CHAR(42), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
