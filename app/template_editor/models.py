"""
模板编辑器数据模型
"""
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class DocumentTemplate(Base):
    """文书模板模型"""
    
    _tablename = "document_templates"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="文书模板名称")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文书模板描述")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, comment="分类名称")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True, comment="状态：draft/published")
    
    # ProseMirror JSON 内容
    prosemirror_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, comment="ProseMirror JSON 格式的文档内容")
    
    # 原始 DOCX 文件在 COS 中的链接
    docx_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="原始 DOCX 文件在 COS 中的 URL")
    
    # 占位符信息（JSON 格式，存储提取的占位符列表）
    placeholders: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True, comment="占位符信息，格式：{'placeholders': ['name', 'date'], 'metadata': {...}}")
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="创建人ID")
    updated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="更新人ID")
    
    # 时间戳（继承自 Base）
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    
    __table_args__ = (
        Index("idx_document_templates_status", "status"),
        Index("idx_document_templates_category", "category"),
        Index("idx_document_templates_name", "name"),
    )
