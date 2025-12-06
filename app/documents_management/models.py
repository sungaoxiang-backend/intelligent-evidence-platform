"""
文书管理数据模型
完全独立实现，不依赖现有模板系统
"""
from typing import Optional, Dict, Any
from datetime import datetime

from sqlalchemy import String, Text, ForeignKey, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Document(Base):
    """文书模型 - 完全独立实现，不依赖现有模板系统"""
    
    __tablename__ = "documents"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True, comment="文书名称")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文书描述")
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True, comment="分类名称")
    
    # ProseMirror JSON 内容（独立的数据格式，不依赖现有模板格式）
    content_json: Mapped[Dict[str, Any]] = mapped_column(
        JSON, 
        nullable=False, 
        comment="ProseMirror JSON 格式的文档内容"
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
    )

