from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

class PartyType(str, Enum):
    """当事人类型枚举"""
    PERSON = "person" # 个人
    COMPANY = "company" # 公司
    INDIVIDUAL = "individual" # 个体工商户

class CaseType(str, Enum):
    """案件类型枚举"""
    DEBT = "debt"  # 借款纠纷
    CONTRACT = "contract"  # 合同纠纷


class Case(Base):
    """案件模型"""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creaditor_name: Mapped[str] = mapped_column(String(50),  index=True, nullable=False)
    creditor_type: Mapped[PartyType] = mapped_column(
        SQLAlchemyEnum(PartyType), nullable=True, default=None
    )
    debtor_name: Mapped[str] = mapped_column(String(50),  index=True, nullable=False)
    debtor_type: Mapped[PartyType] = mapped_column(
        SQLAlchemyEnum(PartyType), nullable=True, default=None
    )
    title: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    case_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    case_type: Mapped[CaseType] = mapped_column(
        SQLAlchemyEnum(CaseType), nullable=False
    )
    # 外键
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_staff_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=True)
    
    # 关系
    user = relationship("User", back_populates="cases")
    assigned_staff = relationship("Staff")
    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")