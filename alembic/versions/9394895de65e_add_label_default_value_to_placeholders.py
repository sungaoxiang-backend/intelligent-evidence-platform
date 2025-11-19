"""add label and default_value to template_placeholders

Revision ID: 9394895de65e
Revises: bbe23883ef56
Create Date: 2025-11-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9394895de65e'
down_revision: Union[str, Sequence[str], None] = 'bbe23883ef56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema by adding metadata fields to template_placeholders."""
    op.add_column(
        'template_placeholders',
        sa.Column('label', sa.String(length=150), nullable=True, comment='占位符显示名称'),
    )
    op.add_column(
        'template_placeholders',
        sa.Column('default_value', sa.Text(), nullable=True, comment='默认值'),
    )


def downgrade() -> None:
    """Downgrade schema by removing metadata fields."""
    op.drop_column('template_placeholders', 'default_value')
    op.drop_column('template_placeholders', 'label')

