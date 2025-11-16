"""update_document_generation_template_id_set_null

Revision ID: c3a5868f783e
Revises: 07833b0266b9
Create Date: 2025-11-16 23:39:51.763212

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3a5868f783e'
down_revision: Union[str, Sequence[str], None] = '07833b0266b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. 删除现有的外键约束
    op.drop_constraint(
        'document_generations_template_id_fkey',
        'document_generations',
        type_='foreignkey'
    )
    
    # 2. 修改 template_id 列为可空
    # 生成记录是快照，模板删除后 template_id 应该为 NULL
    op.alter_column(
        'document_generations',
        'template_id',
        existing_type=sa.Integer(),
        nullable=True,
        comment='模板ID，NULL表示模板已删除（生成记录作为快照保留）'
    )
    
    # 3. 重新创建外键约束，使用 SET NULL
    op.create_foreign_key(
        'document_generations_template_id_fkey',
        'document_generations',
        'document_templates',
        ['template_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 1. 删除外键约束
    op.drop_constraint(
        'document_generations_template_id_fkey',
        'document_generations',
        type_='foreignkey'
    )
    
    # 2. 修改 template_id 列为不可空
    # 注意：如果存在 NULL 值，需要先处理
    op.execute("""
        UPDATE document_generations 
        SET template_id = 0 
        WHERE template_id IS NULL
    """)
    
    op.alter_column(
        'document_generations',
        'template_id',
        existing_type=sa.Integer(),
        nullable=False
    )
    
    # 3. 重新创建外键约束（默认行为，不级联删除）
    op.create_foreign_key(
        'document_generations_template_id_fkey',
        'document_generations',
        'document_templates',
        ['template_id'],
        ['id']
    )
