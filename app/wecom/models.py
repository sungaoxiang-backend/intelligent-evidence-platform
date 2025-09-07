from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLAlchemyEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base_class import Base

class WeComStaffStatus(str, Enum):
    """企业微信员工状态"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISABLED = "disabled"

class ExternalContactStatus(str, Enum):
    """外部联系人状态"""
    NORMAL = "normal"           # 正常
    DELETED = "deleted"         # 已删除
    BLOCKED = "blocked"         # 被拉黑
    HALF = "half"              # 半客户关系

class ContactType(str, Enum):
    """联系类型"""
    FULL = "full"              # 完全联系
    HALF = "half"              # 半联系（免验证添加）

class WeComStaff(Base):
    """企业微信员工"""
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)  # 企业微信UserID
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[WeComStaffStatus] = mapped_column(SQLAlchemyEnum(WeComStaffStatus), default=WeComStaffStatus.ACTIVE)
    
    # 关系
    external_contacts = relationship("ExternalContact", back_populates="staff", cascade="all, delete-orphan")
    customer_sessions = relationship("CustomerSession", back_populates="staff", cascade="all, delete-orphan")

class ExternalContact(Base):
    """外部联系人（客户）"""
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    external_user_id: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)  # 企业微信ExternalUserID
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    type: Mapped[int] = mapped_column(Integer, default=1)  # 1=微信用户
    gender: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0=未知 1=男性 2=女性
    union_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # 微信unionid
    
    # 联系状态
    status: Mapped[ExternalContactStatus] = mapped_column(SQLAlchemyEnum(ExternalContactStatus), default=ExternalContactStatus.NORMAL)
    contact_type: Mapped[ContactType] = mapped_column(SQLAlchemyEnum(ContactType), default=ContactType.FULL)
    
    # 企业信息
    corp_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # 企业名称
    corp_full_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # 企业全称
    
    # 关系
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("we_com_staffs.id"), nullable=False)
    staff = relationship("WeComStaff", back_populates="external_contacts")
    customer_sessions = relationship("CustomerSession", back_populates="external_contact", cascade="all, delete-orphan")

class CustomerSession(Base):
    """客户会话（单聊）"""
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    
    # 参与方
    staff_id: Mapped[int] = mapped_column(Integer, ForeignKey("we_com_staffs.id"), nullable=False)
    external_contact_id: Mapped[int] = mapped_column(Integer, ForeignKey("external_contacts.id"), nullable=False)
    
    # 会话状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # 扩展信息
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # 来源：qr_code, contact_way, etc
    state: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # 状态参数
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)  # 扩展元数据
    
    # 关系
    staff = relationship("WeComStaff", back_populates="customer_sessions")
    external_contact = relationship("ExternalContact", back_populates="customer_sessions")

class ContactWay(Base):
    """联系我方式配置"""
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    config_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)  # 企业微信返回的config_id
    type: Mapped[int] = mapped_column(Integer, nullable=False)  # 联系方式类型
    scene: Mapped[int] = mapped_column(Integer, nullable=False)  # 场景
    
    # 样式配置
    style: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    remark: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    skip_verify: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # 状态
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    qr_code: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # 扩展信息
    state: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

class CustomerEventLog(Base):
    """客户事件日志"""
        
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)  # 事件类型
    change_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # 变更类型
    
    # 相关方
    staff_user_id: Mapped[str] = mapped_column(String(100), nullable=False)  # 企业员工UserID
    external_user_id: Mapped[str] = mapped_column(String(200), nullable=False)  # 外部用户ID
    
    # 事件数据
    event_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)  # 完整事件数据
    
    # 处理结果
    status: Mapped[str] = mapped_column(String(50), default="success")  # success/failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    processed_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # 扩展信息
    welcome_code: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    
    def __repr__(self):
        return f"<CustomerEventLog(event_type='{self.event_type}', staff='{self.staff_user_id}', external='{self.external_user_id}')>"