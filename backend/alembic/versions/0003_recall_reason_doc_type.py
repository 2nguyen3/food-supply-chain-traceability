"""Thêm doc_type recall_reason (lý do thu hồi lô, do Admin upload)

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

from alembic import op

revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD = "doc_type IN ('certificate', 'image', 'metadata', 'invoice', 'incident_report')"
NEW = "doc_type IN ('certificate', 'image', 'metadata', 'invoice', 'incident_report', 'recall_reason')"


def upgrade() -> None:
    op.drop_constraint('ck_documents_doc_type', 'documents', type_='check')
    op.create_check_constraint('ck_documents_doc_type', 'documents', NEW)


def downgrade() -> None:
    op.drop_constraint('ck_documents_doc_type', 'documents', type_='check')
    op.create_check_constraint('ck_documents_doc_type', 'documents', OLD)
