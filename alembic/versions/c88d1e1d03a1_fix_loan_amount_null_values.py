"""fix_loan_amount_null_values

Revision ID: c88d1e1d03a1
Revises: a52fdcbe18c1
Create Date: 2025-07-29 11:23:33.809783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c88d1e1d03a1'
down_revision: Union[str, Sequence[str], None] = 'a52fdcbe18c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 修复loan_amount的NULL值
    op.execute("UPDATE cases SET loan_amount = 0.0 WHERE loan_amount IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    # 不需要回滚，因为这是数据修复
    pass
