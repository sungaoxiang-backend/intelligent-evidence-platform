"""add_document_generation_model

Revision ID: 6bf163929e0b
Revises: 9394895de65e
Create Date: 2025-11-20 12:49:13.014411

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6bf163929e0b'
down_revision: Union[str, Sequence[str], None] = '9394895de65e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 创建 document_generations 表
    op.create_table(
        'document_generations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False, comment='关联的案件ID'),
        sa.Column('template_id', sa.Integer(), nullable=False, comment='关联的模板ID'),
        sa.Column('form_data', sa.JSON(), nullable=False, comment='占位符填写数据，格式：{placeholder_name: value}'),
        sa.Column('created_by_id', sa.Integer(), nullable=True, comment='创建人ID'),
        sa.Column('updated_by_id', sa.Integer(), nullable=True, comment='最后更新人ID'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['document_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['staffs.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['staffs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_id', 'template_id', name='uq_case_template')
    )
    
    # 创建索引
    op.create_index(op.f('ix_document_generations_id'), 'document_generations', ['id'], unique=False)
    op.create_index('idx_document_generations_case_id', 'document_generations', ['case_id'], unique=False)
    op.create_index('idx_document_generations_template_id', 'document_generations', ['template_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 删除索引
    op.drop_index('idx_document_generations_template_id', table_name='document_generations')
    op.drop_index('idx_document_generations_case_id', table_name='document_generations')
    op.drop_index(op.f('ix_document_generations_id'), table_name='document_generations')
    
    # 删除表
    op.drop_table('document_generations')
