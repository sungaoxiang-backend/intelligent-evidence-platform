"""fix_validation_status_defaults

Revision ID: 8ad9b7c0cc48
Revises: c88d1e1d03a1
Create Date: 2025-07-29 12:02:10.155579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8ad9b7c0cc48'
down_revision: Union[str, Sequence[str], None] = 'c88d1e1d03a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 确保所有validation_status列都有默认值
    # 1. 为evidences表的validation_status设置默认值（如果还没有设置）
    op.execute("UPDATE evidences SET validation_status = 'pending' WHERE validation_status IS NULL")
    
    # 2. 为association_evidence_features表的validation_status设置默认值（如果还没有设置）
    op.execute("UPDATE association_evidence_features SET validation_status = 'pending' WHERE validation_status IS NULL")
    
    # 3. 为evidences表的evidence_status设置默认值（如果还没有设置）
    op.execute("UPDATE evidences SET evidence_status = 'uploaded' WHERE evidence_status IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    pass
