"""add theme_color to events

Revision ID: 005_add_theme_color
Revises: merge_001_merge_heads
Create Date: 2026-06-15 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '005_add_theme_color'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('events', sa.Column('theme_color', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'theme_color')
