from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict

from sqlalchemy import Column, DateTime, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

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

class AssociationEvidenceFeatureStatus(str, Enum):
    """关联证据特征状态枚举"""
    FEATURES_EXTRACTED = "features_extracted"  # 特征已提取
    CHECKED = "checked"  # 已审核
    
    
class VaildationStatus(str, Enum):
    """验证状态枚举"""
    PENDING = "pending"  # 待验证
    VALID = "valid"  # 有效
    INVALID = "invalid"  # 无效
    

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
    loan_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=0.0)
    loan_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    court_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # 外键
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 关系
    user = relationship("User", back_populates="cases")
    evidences = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    association_evidence_features = relationship("AssociationEvidenceFeature", back_populates="case", cascade="all, delete-orphan")
    case_parties = relationship("CaseParty", back_populates="case", cascade="all, delete-orphan")


class CaseParty(Base):
    """案件当事人模型"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # 当事人信息
    party_name: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    party_role: Mapped[str] = mapped_column(String(50), nullable=False)
    party_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # 主体信息
    name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    birthday: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    id_card: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # 公司或个体工商户信息
    company_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    company_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 银行信息
    owner_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # 外键
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="case_parties")
    
    
class AssociationEvidenceFeature(Base):
    """关联证据特征模型"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    slot_group_name: Mapped[str] = mapped_column(String(50), nullable=False)
    association_evidence_ids: Mapped[List[int]] = mapped_column(JSONB, nullable=False)
    evidence_feature_status: Mapped[str] = mapped_column(String(20), default=AssociationEvidenceFeatureStatus.FEATURES_EXTRACTED)
    evidence_features: Mapped[List[Dict]] = mapped_column(JSONB, nullable=False)
    features_extracted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)    
    validation_status: Mapped[str] = mapped_column(String(20), default=VaildationStatus.PENDING)

    
    # 关系
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="association_evidence_features")