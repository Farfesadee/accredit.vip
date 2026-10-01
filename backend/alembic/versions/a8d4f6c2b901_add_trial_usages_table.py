"""add trial usages table

Revision ID: a8d4f6c2b901
Revises: 77cc140053c0
Create Date: 2026-05-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8d4f6c2b901"
down_revision: Union[str, None] = "77cc140053c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trial_usages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trial_type", sa.String(), nullable=False),
        sa.Column("fingerprint_hash", sa.String(), nullable=False),
        sa.Column("client_hash", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fingerprint_hash", "trial_type", name="uq_trial_fingerprint_type"),
        sa.UniqueConstraint("client_hash", "trial_type", name="uq_trial_client_type"),
    )
    op.create_index(op.f("ix_trial_usages_id"), "trial_usages", ["id"], unique=False)
    op.create_index(op.f("ix_trial_usages_fingerprint_hash"), "trial_usages", ["fingerprint_hash"], unique=False)
    op.create_index(op.f("ix_trial_usages_client_hash"), "trial_usages", ["client_hash"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_trial_usages_client_hash"), table_name="trial_usages")
    op.drop_index(op.f("ix_trial_usages_fingerprint_hash"), table_name="trial_usages")
    op.drop_index(op.f("ix_trial_usages_id"), table_name="trial_usages")
    op.drop_table("trial_usages")
