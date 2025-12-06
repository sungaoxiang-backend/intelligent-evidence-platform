"""add_documents_table

Revision ID: 0256cace79e6
Revises: 05792ba825b0
Create Date: 2025-12-06 12:18:24.855914

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0256cace79e6'
down_revision: Union[str, Sequence[str], None] = '05792ba825b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 创建 documents 表
    op.create_table('documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False, comment='文书名称'),
        sa.Column('description', sa.Text(), nullable=True, comment='文书描述'),
        sa.Column('category', sa.String(length=100), nullable=True, comment='分类名称'),
        sa.Column('content_json', sa.JSON(), nullable=False, comment='ProseMirror JSON 格式的文档内容'),
        sa.Column('created_by_id', sa.Integer(), nullable=True, comment='创建人ID'),
        sa.Column('updated_by_id', sa.Integer(), nullable=True, comment='最后更新人ID'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['staffs.id'], ),
        sa.ForeignKeyConstraint(['updated_by_id'], ['staffs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_documents_name', 'documents', ['name'], unique=False)
    op.create_index('idx_documents_category', 'documents', ['category'], unique=False)
    op.create_index(op.f('ix_documents_id'), 'documents', ['id'], unique=False)
    op.create_index(op.f('ix_documents_name'), 'documents', ['name'], unique=False)
    op.create_index(op.f('ix_documents_category'), 'documents', ['category'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_documents_category'), table_name='documents')
    op.drop_index(op.f('ix_documents_name'), table_name='documents')
    op.drop_index(op.f('ix_documents_id'), table_name='documents')
    op.drop_index('idx_documents_category', table_name='documents')
    op.drop_index('idx_documents_name', table_name='documents')
    op.drop_table('documents')
