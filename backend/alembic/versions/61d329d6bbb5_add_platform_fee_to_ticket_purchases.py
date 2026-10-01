"""add_platform_fee_to_ticket_purchases

Revision ID: 61d329d6bbb5
Revises: 4b7d2e9f1c6a
Create Date: 2026-05-31 21:16:06.143302

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61d329d6bbb5'
down_revision: Union[str, None] = '4b7d2e9f1c6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ticket_purchases", sa.Column("platform_fee", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ticket_purchases", "platform_fee")
