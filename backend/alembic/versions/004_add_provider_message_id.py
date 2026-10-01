"""add_provider_message_id_to_invite_messages

Revision ID: 004
Revises: merge_001
Create Date: 2026-06-15 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "merge_001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invite_messages", sa.Column("provider_message_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("invite_messages", "provider_message_id")
