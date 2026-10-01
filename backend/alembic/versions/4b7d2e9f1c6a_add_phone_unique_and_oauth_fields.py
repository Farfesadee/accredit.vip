"""add phone unique and oauth fields to users

Revision ID: 4b7d2e9f1c6a
Revises: 3d5e9c2a8f4b
Create Date: 2026-05-31 13:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "4b7d2e9f1c6a"
down_revision: Union[str, None] = "3d5e9c2a8f4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("oauth_provider", sa.String(), nullable=True))
    op.add_column("users", sa.Column("oauth_id", sa.String(), nullable=True))
    op.execute("UPDATE users SET phone = NULL WHERE phone IN (SELECT phone FROM users GROUP BY phone HAVING COUNT(*) > 1) AND id NOT IN (SELECT MIN(id) FROM users GROUP BY phone)")
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])


def downgrade() -> None:
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_column("users", "oauth_id")
    op.drop_column("users", "oauth_provider")
