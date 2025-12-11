"""
文书管理数据模型
完全独立实现，不依赖现有模板系统
"""
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, JSON, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Document(Base):
    """文书模型 - 完全独立实现，不依赖现有模板系统"""
    
    __tablename__ = "documents"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="文书名称")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文书描述")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, comment="分类名称")
    
    # 状态字段：draft（草稿）或 published（发布）
    status: Mapped[str] = mapped_column(
        String(20), 
        nullable=False, 
        default="draft", 
        index=True, 
        comment="状态：draft（草稿）/published（发布）"
    )
    
    # ProseMirror JSON 内容（独立的数据格式，不依赖现有模板格式）
    content_json: Mapped[Dict[str, Any]] = mapped_column(
        JSON, 
        nullable=False, 
        comment="ProseMirror JSON 格式的文档内容"
    )
    
    # 占位符元数据（JSON格式，存储占位符的配置信息）
    placeholder_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, 
        nullable=True, 
        comment="占位符元数据，格式：{\"placeholder_name\": {\"name\": \"...\", \"type\": \"text|radio|checkbox\", \"options\": [...]}}"
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
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    
    __table_args__ = (
        Index("idx_documents_name", "name"),
        Index("idx_documents_category", "category"),
        Index("idx_documents_status", "status"),
    )


class DocumentDraft(Base):
    """文书草稿模型 - 存储某个案件+模板的表单草稿数据"""
    
    __tablename__ = "document_drafts"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # 关联案件和模板
    case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("cases.id"),
        nullable=False,
        index=True,
        comment="案件ID"
    )
    document_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("documents.id"),
        nullable=False,
        index=True,
        comment="模板ID"
    )
    
    # 表单数据（JSON格式，存储占位符的填充值）
    # 注意：此字段已废弃，新功能使用 content_json 字段
    form_data: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="表单数据，格式：{\"placeholder_name\": \"value\"}（已废弃，新功能使用 content_json）"
    )
    
    # ProseMirror JSON 内容（存储完整的文档内容副本）
    content_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="ProseMirror JSON 格式的文档内容，存储完整的文档内容副本"
    )
    
    # 页面布局设置（页边距、行间距等）
    page_layout: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="页面布局设置（页边距、行间距等）"
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
    case = relationship("Case", foreign_keys=[case_id], back_populates=None)
    document = relationship("Document", foreign_keys=[document_id], back_populates=None)
    created_by = relationship("Staff", foreign_keys=[created_by_id], back_populates=None)
    updated_by = relationship("Staff", foreign_keys=[updated_by_id], back_populates=None)
    
    __table_args__ = (
        UniqueConstraint("case_id", "document_id", name="uq_document_drafts_case_document"),
        Index("idx_document_drafts_case_id", "case_id"),
        Index("idx_document_drafts_document_id", "document_id"),
        Index("idx_document_drafts_case_document", "case_id", "document_id"),
    )

