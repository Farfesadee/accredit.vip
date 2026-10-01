"""merge 7d4e9f2c1b6a and f8b3c6d2e1a4 heads

Revision ID: merge_001
Revises: 7d4e9f2c1b6a, f8b3c6d2e1a4
Create Date: 2026-06-15 15:00:00.000000
"""
from alembic import op

revision = "merge_001"
down_revision = ("7d4e9f2c1b6a", "f8b3c6d2e1a4")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
