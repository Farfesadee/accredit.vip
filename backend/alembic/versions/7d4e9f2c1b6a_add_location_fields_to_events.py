"""add location fields to events

Revision ID: 7d4e9f2c1b6a
Revises: 9a8b7c6d5e4f
Create Date: 2026-06-03 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "7d4e9f2c1b6a"
down_revision: Union[str, None] = "9a8b7c6d5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("events", sa.Column("city", sa.String(), nullable=True))
    op.add_column("events", sa.Column("state", sa.String(), nullable=True))
    op.add_column("events", sa.Column("country", sa.String(), server_default="Nigeria", nullable=True))
    op.add_column("events", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("events", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "longitude")
    op.drop_column("events", "latitude")
    op.drop_column("events", "country")
    op.drop_column("events", "state")
    op.drop_column("events", "city")
