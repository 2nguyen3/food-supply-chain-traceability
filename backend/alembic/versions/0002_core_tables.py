"""core tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0002'
down_revision: Union[str, Sequence[str], None] = '0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'auth_nonces',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('wallet', sa.CHAR(length=42), nullable=False),
        sa.Column('nonce', sa.Text(), nullable=False),
        sa.Column('domain', sa.Text(), nullable=False),
        sa.Column('chain_id', sa.BigInteger(), nullable=False),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name='pk_auth_nonces'),
        sa.UniqueConstraint('nonce', name='uq_auth_nonces_nonce'),
    )

    op.create_table(
        'sessions',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('wallet', sa.CHAR(length=42), nullable=False),
        sa.Column('token_hash', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name='pk_sessions'),
        sa.UniqueConstraint('token_hash', name='uq_sessions_token_hash'),
    )

    op.create_table(
        'documents',
        sa.Column('id', sa.Uuid(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('uploader', sa.CHAR(length=42), nullable=False),
        sa.Column('token_id', sa.Numeric(precision=78, scale=0), nullable=True),
        sa.Column('bind_tx_hash', sa.CHAR(length=66), nullable=True),
        sa.Column('visibility', sa.Text(), nullable=False),
        sa.Column('doc_type', sa.Text(), nullable=False),
        sa.Column('cid', sa.Text(), nullable=False),
        sa.Column('sha256', sa.LargeBinary(), nullable=False),
        sa.Column('mime_type', sa.Text(), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False),
        sa.Column('schema_version', sa.Integer(), nullable=False),
        sa.Column('aad', sa.LargeBinary(), nullable=True),
        sa.Column('wrapped_key', sa.LargeBinary(), nullable=True),
        sa.Column('wrap_iv', sa.LargeBinary(), nullable=True),
        sa.Column('wrap_tag', sa.LargeBinary(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("visibility IN ('public', 'private')", name='ck_documents_visibility'),
        sa.CheckConstraint(
            "doc_type IN ('certificate', 'image', 'metadata', 'invoice', 'incident_report')",
            name='ck_documents_doc_type',
        ),
        sa.PrimaryKeyConstraint('id', name='pk_documents'),
    )
    op.create_index('ix_documents_token_id', 'documents', ['token_id'])
    op.create_index('ix_documents_uploader', 'documents', ['uploader'])

    op.create_table(
        'document_grants',
        sa.Column('document_id', sa.Uuid(), nullable=False),
        sa.Column('wallet', sa.CHAR(length=42), nullable=False),
        sa.Column('granted_by', sa.CHAR(length=42), nullable=False),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], name='fk_document_grants_document_id_documents'),
        sa.PrimaryKeyConstraint('document_id', 'wallet', name='pk_document_grants'),
    )


def downgrade() -> None:
    op.drop_table('document_grants')
    op.drop_index('ix_documents_uploader', table_name='documents')
    op.drop_index('ix_documents_token_id', table_name='documents')
    op.drop_table('documents')
    op.drop_table('sessions')
    op.drop_table('auth_nonces')
