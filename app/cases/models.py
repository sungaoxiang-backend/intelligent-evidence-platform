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

class CaseStatus(str, Enum):
    """案件状态枚举"""
    DRAFT = "draft"  # 草稿，初始创建
    INFO_ENTERED = "info_entered"  # 基础信息录入完成
    EVIDENCE_ANNOTATED = "evidence_annotated"  # 证据材料AI智能标注完成
    DOCUMENTS_GENERATED = "documents_generated"  # 文书生成完成
    # SUBMITTED = "submitted"  # 案件已提交
    # FILED = "filed"  # 案件已立案
    # IN_PROGRESS = "in_progress"  # 进行中（诉中通用）
    # CLOSED = "closed"  # 案件已结案
    # ARCHIVED = "archived"  # 已归档

class Case(Base):
    """案件模型"""

    # 基础信息
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_type: Mapped[Optional[CaseType]] = mapped_column(
            SQLAlchemyEnum(CaseType), nullable=True
        )
    case_status: Mapped[CaseStatus] = mapped_column(
            SQLAlchemyEnum(CaseStatus), nullable=False, default=CaseStatus.DRAFT
        )

    # 当事人信息
    creditor_name: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    debtor_name: Mapped[Optional[str]] = mapped_column(String(50), index=True, nullable=True)
    creditor_type: Mapped[Optional[PartyType]] = mapped_column(
        SQLAlchemyEnum(PartyType), nullable=True
    )
    debtor_type: Mapped[Optional[PartyType]] = mapped_column(
        SQLAlchemyEnum(PartyType), nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 外键
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="cases")
    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")