"""add_event_review_fields

Revision ID: e4a7b2c1d3f5
Revises: 61d329d6bbb5
Create Date: 2026-06-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4a7b2c1d3f5'
down_revision: Union[str, None] = '61d329d6bbb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("review_status", sa.String(), server_default="auto_approved"))
    op.add_column("events", sa.Column("review_note", sa.Text(), nullable=True))
    op.add_column("events", sa.Column("flagged_keywords", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "flagged_keywords")
    op.drop_column("events", "review_note")
    op.drop_column("events", "review_status")
