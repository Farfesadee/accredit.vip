"""add notes and tags columns to guests"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = '007_add_notes_and_tags'
down_revision = '006_add_custom_data'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('guests', sa.Column('notes', sa.String(), nullable=True))
    op.add_column('guests', sa.Column('tags', JSON, nullable=True, default=[]))


def downgrade():
    op.drop_column('guests', 'tags')
    op.drop_column('guests', 'notes')
