"""add vat to ticket purchases

Revision ID: 9a8b7c6d5e4f
Revises: 61d329d6bbb5
Create Date: 2026-06-01 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9a8b7c6d5e4f"
down_revision: Union[str, None] = "f8b3c6d2e1a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ticket_purchases", sa.Column("vat", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ticket_purchases", "vat")
