from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class CaseStatus(str, Enum):
    """案件状态枚举"""
    PENDING = "pending"  # 待处理
    IN_PROGRESS = "in_progress"  # 处理中
    RESOLVED = "resolved"  # 已解决
    CLOSED = "closed"  # 已关闭


class CaseType(str, Enum):
    """案件类型枚举"""
    DEBT = "debt"  # 债务纠纷
    CONTRACT = "contract"  # 合同纠纷
    OTHER = "other"  # 其他


class Case(Base):
    """案件模型"""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    case_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    status: Mapped[CaseStatus] = mapped_column(
        SQLAlchemyEnum(CaseStatus), default=CaseStatus.PENDING, nullable=False
    )
    case_type: Mapped[CaseType] = mapped_column(
        SQLAlchemyEnum(CaseType), default=CaseType.OTHER, nullable=False
    )
    start_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # 外键
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_staff_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=True)
    
    # 关系
    user = relationship("User", back_populates="cases")
    assigned_staff = relationship("Staff")
    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")