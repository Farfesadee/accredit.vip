"""add post event details

Revision ID: b6f2c8a91a04
Revises: a8d4f6c2b901
Create Date: 2026-05-30 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b6f2c8a91a04"
down_revision: Union[str, None] = "a8d4f6c2b901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("pass_packages", sa.JSON(), nullable=True))
    op.add_column("events", sa.Column("lineup", sa.JSON(), nullable=True))
    op.add_column("events", sa.Column("after_party_enabled", sa.Boolean(), nullable=True, server_default=sa.text("false")))
    op.add_column("events", sa.Column("after_party_location", sa.String(), nullable=True))
    op.add_column("events", sa.Column("after_party_time", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "after_party_time")
    op.drop_column("events", "after_party_location")
    op.drop_column("events", "after_party_enabled")
    op.drop_column("events", "lineup")
    op.drop_column("events", "pass_packages")
