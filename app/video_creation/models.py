from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base_class import Base


class MessageRole(str, Enum):
    """消息角色枚举"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ScriptType(str, Enum):
    """脚本类型枚举"""
    A_CASE = "A"  # A类-案件复盘
    B_MISCONCEPTION = "B"  # B类-咨询误解
    C_GAP = "C"  # C类-缺口模板


class VideoCreationSession(Base):
    """视频创作会话模型"""
    __tablename__ = "video_creation_sessions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="新会话")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=datetime.now, 
        onupdate=datetime.now, 
        nullable=False
    )
    
    # 关系
    staff = relationship("Staff", backref="video_creation_sessions")
    messages = relationship(
        "VideoCreationMessage", 
        back_populates="session", 
        cascade="all, delete-orphan",
        order_by="VideoCreationMessage.created_at"
    )
    scripts = relationship(
        "VideoScript", 
        back_populates="session", 
        cascade="all, delete-orphan"
    )


class VideoCreationMessage(Base):
    """视频创作消息模型"""
    __tablename__ = "video_creation_messages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("video_creation_sessions.id"), 
        nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(
        SQLAlchemyEnum(MessageRole), 
        nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # message_metadata 包含: tool_calls, skill_hits, streaming_status
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    
    # 关系
    session = relationship("VideoCreationSession", back_populates="messages")


class VideoScript(Base):
    """视频脚本模型"""
    __tablename__ = "video_scripts"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("video_creation_sessions.id"), 
        nullable=False
    )
    message_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("video_creation_messages.id"), 
        nullable=False
    )
    script_type: Mapped[ScriptType] = mapped_column(
        SQLAlchemyEnum(ScriptType), 
        nullable=False
    )
    script_content: Mapped[str] = mapped_column(Text, nullable=False)
    source_article_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)
    
    # 关系
    session = relationship("VideoCreationSession", back_populates="scripts")
    message = relationship("VideoCreationMessage")
