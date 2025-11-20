"""
文书生成数据模型
"""
from typing import Optional, Dict, Any, TYPE_CHECKING
from datetime import datetime

from sqlalchemy import String, ForeignKey, JSON, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

if TYPE_CHECKING:
    from app.cases.models import Case
    from app.template_editor.models import DocumentTemplate
    from app.staffs.models import Staff


class DocumentGeneration(Base):
    """文书生成模型
    
    用于记录基于模板为特定案件生成文书的草稿和状态。
    每个案件的每个模板只能有一个文书生成记录（唯一约束）。
    """
    
    __tablename__ = "document_generations"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # 外键关联
    case_id: Mapped[int] = mapped_column(
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的案件ID"
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("document_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="关联的模板ID"
    )
    
    # 表单数据（JSON 格式存储占位符填写内容）
    form_data: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="占位符填写数据，格式：{placeholder_name: value}"
    )
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("staffs.id"),
        nullable=True,
        comment="创建人ID"
    )
    updated_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("staffs.id"),
        nullable=True,
        comment="最后更新人ID"
    )
    
    # 时间戳（继承自 Base）
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    case = relationship("Case", back_populates="document_generations")
    template = relationship("DocumentTemplate", back_populates=None)
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    
    __table_args__ = (
        # 唯一约束：同一案件下的同一模板只能有一个文书生成记录
        UniqueConstraint("case_id", "template_id", name="uq_case_template"),
        Index("idx_document_generations_case_id", "case_id"),
        Index("idx_document_generations_template_id", "template_id"),
    )

