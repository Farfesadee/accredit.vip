"""add_data_management_tables

Revision ID: f8b3c6d2e1a4
Revises: e4a7b2c1d3f5
Create Date: 2026-06-01 10:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8b3c6d2e1a4'
down_revision: Union[str, None] = 'e4a7b2c1d3f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create data_groups table
    op.create_table(
        'data_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_data_groups_id', 'data_groups', ['id'], unique=False)

    # Create data_profiles table
    op.create_table(
        'data_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(), nullable=False),
        sa.Column('last_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('age_range', sa.String(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('income_level', sa.String(), nullable=True),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('consent_given', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('consent_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['group_id'], ['data_groups.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_data_profiles_id', 'data_profiles', ['id'], unique=False)
    op.create_index('ix_data_profiles_email', 'data_profiles', ['email'], unique=False)

    # Create data_requests table
    op.create_table(
        'data_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('requester_name', sa.String(), nullable=False),
        sa.Column('requester_email', sa.String(), nullable=False),
        sa.Column('requester_org', sa.String(), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['data_groups.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_data_requests_id', 'data_requests', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_data_requests_id', table_name='data_requests')
    op.drop_table('data_requests')
    op.drop_index('ix_data_profiles_email', table_name='data_profiles')
    op.drop_index('ix_data_profiles_id', table_name='data_profiles')
    op.drop_table('data_profiles')
    op.drop_index('ix_data_groups_id', table_name='data_groups')
    op.drop_table('data_groups')
