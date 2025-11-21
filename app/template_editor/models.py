"""
模板编辑器数据模型
"""
from typing import Optional, Dict, Any, List
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, JSON, Index, UniqueConstraint, Table, Column, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


# 多对多关系的中间表
template_placeholder_association = Table(
    "template_placeholder_associations",
    Base.metadata,
    Column("template_id", Integer, ForeignKey("document_templates.id"), primary_key=True),
    Column("placeholder_id", Integer, ForeignKey("template_placeholders.id"), primary_key=True),
    Index("idx_template_placeholder_template_id", "template_id"),
    Index("idx_template_placeholder_placeholder_id", "placeholder_id"),
)


class DocumentTemplate(Base):
    """文书模板模型"""
    
    __tablename__ = "document_templates"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="文书模板名称")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文书模板描述")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, comment="分类名称")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True, comment="状态：draft/published")
    
    # ProseMirror JSON 内容
    prosemirror_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, comment="ProseMirror JSON 格式的文档内容")
    
    # 原始 DOCX 文件在 COS 中的链接
    docx_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="原始 DOCX 文件在 COS 中的 URL")
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="创建人ID")
    updated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="更新人ID")
    
    # 时间戳（继承自 Base）
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    # 多对多关系：模板和占位符
    placeholders = relationship(
        "TemplatePlaceholder",
        secondary=template_placeholder_association,
        back_populates="templates"
    )
    # 一对多关系：模板和文书生成记录
    document_generations = relationship(
        "DocumentGeneration",
        back_populates="template",
        lazy="noload"  # 默认不加载，避免性能问题
    )
    
    __table_args__ = (
        Index("idx_document_templates_status", "status"),
        Index("idx_document_templates_category", "category"),
        Index("idx_document_templates_name", "name"),
    )


class TemplatePlaceholder(Base):
    """模板占位符模型"""
    
    __tablename__ = "template_placeholders"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="占位符名称（唯一，如：{{姓名}} 对应 name 字段）",
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False, comment="占位符类型：text, textarea, select, radio, checkbox, date, number, file")
    options: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True, comment="选项列表（用于 select, radio, checkbox 类型）")
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="创建人ID")
    updated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True, comment="更新人ID")
    
    # 时间戳（继承自 Base）
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    
    # 关系
    templates = relationship(
        "DocumentTemplate",
        secondary=template_placeholder_association,
        back_populates="placeholders"
    )
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    
    __table_args__ = (
        Index("idx_template_placeholders_name", "name"),
    )
