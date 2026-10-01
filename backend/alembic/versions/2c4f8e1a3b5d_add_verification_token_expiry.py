"""add verification_token_expires_at to users

Revision ID: 2c4f8e1a3b5d
Revises: 9e1f3c4d5b6a
Create Date: 2026-05-30 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2c4f8e1a3b5d"
down_revision: Union[str, None] = "9e1f3c4d5b6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("verification_token_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "verification_token_expires_at")
