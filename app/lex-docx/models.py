from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any

from sqlalchemy import String, Text, ForeignKey, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base_class import Base


class TemplateStatus(str, Enum):
    """模板状态枚举"""
    DRAFT = "draft"  # 草稿
    PUBLISHED = "published"  # 已发布


class DocumentTemplate(Base):
    """文档模板模型"""
    __tablename__ = "document_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=TemplateStatus.DRAFT, index=True)
    content_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    placeholder_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=True)

    # 关系
    creator = relationship("Staff", foreign_keys=[created_by], backref="created_templates")
    updater = relationship("Staff", foreign_keys=[updated_by], backref="updated_templates")
    generations = relationship("DocumentGeneration", back_populates="template", cascade="all, delete-orphan")

    # 索引
    __table_args__ = (
        Index("idx_document_templates_status", "status"),
        Index("idx_document_templates_category", "category"),
        Index("idx_document_templates_name", "name"),
    )


class DocumentGeneration(Base):
    """文档生成记录模型"""
    __tablename__ = "document_generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(Integer, ForeignKey("document_templates.id"), nullable=False, index=True)
    generated_by: Mapped[int] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=False, index=True)
    form_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    document_url: Mapped[str] = mapped_column(String(500), nullable=False)
    document_filename: Mapped[str] = mapped_column(String(200), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(nullable=False, default=datetime.now)

    # 关系
    template = relationship("DocumentTemplate", back_populates="generations")
    generator = relationship("Staff", foreign_keys=[generated_by], backref="generated_documents")

    # 索引
    __table_args__ = (
        Index("idx_document_generations_template_id", "template_id"),
        Index("idx_document_generations_generated_by", "generated_by"),
        Index("idx_document_generations_generated_at", "generated_at"),
    )

