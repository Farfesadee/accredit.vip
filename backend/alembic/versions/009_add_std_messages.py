"""Add STD (Save the Date) message tables for Event 46."""

from alembic import op
import sqlalchemy as sa


revision = '009_add_std_messages'
down_revision = '008_add_burial_rsvp_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Create STDMessageBatch table
    op.create_table(
        'std_message_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('total_sent', sa.Integer(), server_default='0', nullable=True),
        sa.Column('status', sa.String(), server_default='pending', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['event_id'], ['events.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_std_message_batches_id', 'id'),
    )

    # Create STDMessage table
    op.create_table(
        'std_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('guest_id', sa.Integer(), nullable=False),
        sa.Column('channel', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='queued', nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error', sa.String(), nullable=True),
        sa.Column('provider_message_id', sa.String(), nullable=True),
        sa.Column('webhook_payload', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['std_message_batches.id'], ),
        sa.ForeignKeyConstraint(['guest_id'], ['guests.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.Index('ix_std_messages_id', 'id'),
    )


def downgrade():
    op.drop_table('std_messages')
    op.drop_table('std_message_batches')
