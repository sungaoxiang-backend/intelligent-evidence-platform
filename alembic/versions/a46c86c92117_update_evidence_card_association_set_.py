"""update_evidence_card_association_set_null

Revision ID: a46c86c92117
Revises: 75fca9dd31da
Create Date: 2025-11-06 13:54:48.390101

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a46c86c92117'
down_revision: Union[str, Sequence[str], None] = '75fca9dd31da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 删除现有的复合主键约束
    op.drop_constraint('evidence_card_evidence_association_pkey', 'evidence_card_evidence_association', type_='primary')
    
    # 2. 删除现有的外键约束
    op.drop_constraint('evidence_card_evidence_association_evidence_card_id_fkey', 'evidence_card_evidence_association', type_='foreignkey')
    op.drop_constraint('evidence_card_evidence_association_evidence_id_fkey', 'evidence_card_evidence_association', type_='foreignkey')
    
    # 3. 添加自增ID列作为主键
    # 先添加可空列
    op.add_column('evidence_card_evidence_association', sa.Column('id', sa.Integer(), nullable=True))
    
    # 设置初始值（使用row_number）
    op.execute("""
        UPDATE evidence_card_evidence_association
        SET id = subquery.row_num
        FROM (
            SELECT 
                evidence_card_id,
                evidence_id,
                ROW_NUMBER() OVER (ORDER BY evidence_card_id, evidence_id) as row_num
            FROM evidence_card_evidence_association
        ) AS subquery
        WHERE evidence_card_evidence_association.evidence_card_id = subquery.evidence_card_id
        AND evidence_card_evidence_association.evidence_id = subquery.evidence_id
    """)
    
    # 设置为不可空
    op.alter_column('evidence_card_evidence_association', 'id', nullable=False)
    
    # 创建主键
    op.create_primary_key('evidence_card_evidence_association_pkey', 'evidence_card_evidence_association', ['id'])
    
    # 创建序列并设置为默认值（使列自增）
    # 需要将多个SQL语句拆分成多个op.execute()调用
    op.execute("CREATE SEQUENCE evidence_card_evidence_association_id_seq OWNED BY evidence_card_evidence_association.id")
    op.execute("ALTER TABLE evidence_card_evidence_association ALTER COLUMN id SET DEFAULT nextval('evidence_card_evidence_association_id_seq')")
    op.execute("SELECT setval('evidence_card_evidence_association_id_seq', COALESCE((SELECT MAX(id) FROM evidence_card_evidence_association), 1))")
    
    # 4. 修改列属性为可空，并添加注释
    op.alter_column('evidence_card_evidence_association', 'evidence_card_id',
                   existing_type=sa.Integer(),
                   nullable=True,
                   comment='证据卡片ID，null表示卡片已删除')
    op.alter_column('evidence_card_evidence_association', 'evidence_id',
                   existing_type=sa.Integer(),
                   nullable=True,
                   comment='证据ID，null表示证据已删除')
    
    # 5. 重新创建外键约束，使用SET NULL
    op.create_foreign_key('evidence_card_evidence_association_evidence_card_id_fkey',
                         'evidence_card_evidence_association', 'evidence_cards',
                         ['evidence_card_id'], ['id'],
                         ondelete='SET NULL')
    op.create_foreign_key('evidence_card_evidence_association_evidence_id_fkey',
                         'evidence_card_evidence_association', 'evidences',
                         ['evidence_id'], ['id'],
                         ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    # 1. 删除外键约束
    op.drop_constraint('evidence_card_evidence_association_evidence_card_id_fkey', 'evidence_card_evidence_association', type_='foreignkey')
    op.drop_constraint('evidence_card_evidence_association_evidence_id_fkey', 'evidence_card_evidence_association', type_='foreignkey')
    
    # 2. 删除自增ID列
    op.drop_constraint('evidence_card_evidence_association_pkey', 'evidence_card_evidence_association', type_='primary')
    # 删除序列
    op.execute("DROP SEQUENCE IF EXISTS evidence_card_evidence_association_id_seq")
    op.drop_column('evidence_card_evidence_association', 'id')
    
    # 3. 修改列属性为不可空
    op.alter_column('evidence_card_evidence_association', 'evidence_card_id',
                   existing_type=sa.Integer(),
                   nullable=False)
    op.alter_column('evidence_card_evidence_association', 'evidence_id',
                   existing_type=sa.Integer(),
                   nullable=False)
    
    # 4. 重新创建复合主键约束
    op.create_primary_key('evidence_card_evidence_association_pkey', 'evidence_card_evidence_association', ['evidence_card_id', 'evidence_id'])
    
    # 5. 重新创建外键约束，使用CASCADE
    op.create_foreign_key('evidence_card_evidence_association_evidence_card_id_fkey',
                         'evidence_card_evidence_association', 'evidence_cards',
                         ['evidence_card_id'], ['id'],
                         ondelete='CASCADE')
    op.create_foreign_key('evidence_card_evidence_association_evidence_id_fkey',
                         'evidence_card_evidence_association', 'evidences',
                         ['evidence_id'], ['id'],
                         ondelete='CASCADE')
