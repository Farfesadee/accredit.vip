"""add payment_type and guest_id to payments

Revision ID: 3d5e9c2a8f4b
Revises: a1f237b19e70
Create Date: 2026-05-31 12:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "3d5e9c2a8f4b"
down_revision: Union[str, None] = "a1f237b19e70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("payment_type", sa.String(), server_default="publish", nullable=False))
    op.add_column("payments", sa.Column("guest_id", sa.Integer(), sa.ForeignKey("guests.id"), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "guest_id")
    op.drop_column("payments", "payment_type")
