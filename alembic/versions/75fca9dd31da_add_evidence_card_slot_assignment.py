"""add_evidence_card_slot_assignment

Revision ID: 75fca9dd31da
Revises: e48a96b183c8
Create Date: 2025-11-05 14:13:57.815057

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75fca9dd31da'
down_revision: Union[str, Sequence[str], None] = 'e48a96b183c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'evidence_card_slot_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('case_id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.String(length=200), nullable=False),
        sa.Column('slot_id', sa.String(length=200), nullable=False),
        sa.Column('card_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ),
        sa.ForeignKeyConstraint(['card_id'], ['evidence_cards.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_id', 'template_id', 'slot_id', name='uq_case_template_slot'),
        comment='证据卡片槽位关联表，记录卡片在槽位模板中的快照状态'
    )
    op.create_index(op.f('ix_evidence_card_slot_assignments_id'), 'evidence_card_slot_assignments', ['id'], unique=False)
    op.create_index('ix_evidence_card_slot_assignments_case_id', 'evidence_card_slot_assignments', ['case_id'], unique=False)
    op.create_index('ix_evidence_card_slot_assignments_template_id', 'evidence_card_slot_assignments', ['template_id'], unique=False)
    op.create_index('ix_evidence_card_slot_assignments_slot_id', 'evidence_card_slot_assignments', ['slot_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 安全地删除索引和表（如果存在）
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    
    # 检查表是否存在（可能是单数或复数形式）
    table_name = None
    for name in ['evidence_card_slot_assignments', 'evidence_card_slot_assignment']:
        if name in inspector.get_table_names():
            table_name = name
            break
    
    if table_name:
        # 删除索引（如果存在）
        indexes = [idx['name'] for idx in inspector.get_indexes(table_name)]
        for idx_name in ['ix_evidence_card_slot_assignments_slot_id', 'ix_evidence_card_slot_assignment_slot_id']:
            if idx_name in indexes:
                op.drop_index(idx_name, table_name=table_name)
        for idx_name in ['ix_evidence_card_slot_assignments_template_id', 'ix_evidence_card_slot_assignment_template_id']:
            if idx_name in indexes:
                op.drop_index(idx_name, table_name=table_name)
        for idx_name in ['ix_evidence_card_slot_assignments_case_id', 'ix_evidence_card_slot_assignment_case_id']:
            if idx_name in indexes:
                op.drop_index(idx_name, table_name=table_name)
        for idx_name in ['ix_evidence_card_slot_assignments_id', 'ix_evidence_card_slot_assignment_id']:
            if idx_name in indexes:
                op.drop_index(idx_name, table_name=table_name)
        
        # 删除表
        op.drop_table(table_name)
