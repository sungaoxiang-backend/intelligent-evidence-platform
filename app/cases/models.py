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
    
    # 基础状态
    DRAFT = "draft"  # 已录入系统：案件基本信息录入了系统，比如案由、债权人名称、债务人名称
    ACCEPTED = "accepted"  # 业务已受理：业务基本了解清晰，用户支付了业务订单，系统为用户建立了业务处理企微群
    DOCUMENTS_COMPLETE = "documents_complete"  # 案件文书已完备：经过系统的一系列信息录入和处理，生成了相关文书，并且用户也都全部将文书进行下载签署拍照后回传到了系统
    
    # 立案相关状态
    FILING_SUBMITTED = "filing_submitted"  # 案件立案申请已提交：用户将相关文书提交到了法院，完成立案的申请
    FILING_APPROVED = "filing_approved"  # 案件立案申请已审核通过：法院审核通过了立案申请，案件正式立案
    FILING_REJECTED = "filing_rejected"  # 案件立案申请已驳回：法院驳回了立案申请，案件无法立案
    
    # 缴费相关状态
    PAYMENT_NOTIFIED = "payment_notified"  # 案件已通知缴费：案件已经由法院公告缴费通知，等待用户缴费
    PAYMENT_COMPLETED = "payment_completed"  # 案件已缴费：用户已经缴费，等待法院调解或开庭
    
    # 审理相关状态
    MEDIATION_COMPLETED = "mediation_completed"  # 案件已调解：法院已经调解完成，案件结束
    SUMMONS_DELIVERED = "summons_delivered"  # 案件传票已送达：法院已经送达传票
    JUDGMENT_RENDERED = "judgment_rendered"  # 案件已判决：法院已经判决，案件结束
    
    # 强制执行相关状态（可选）
    ENFORCEMENT_APPLIED = "enforcement_applied"  # 案件强制执行申请：用户在系统中表明想要申请强制执行
    ENFORCEMENT_DOCUMENT_SIGNED = "enforcement_document_signed"  # 案件强制执行申请书已签署：用户已经签署和上传了强执执行申请书
    ENFORCEMENT_DOCUMENT_SUBMITTED = "enforcement_document_submitted"  # 案件强执执行申请书已提交法院：用户已经上传了强执执行申请书到法院
    ENFORCEMENT_APPROVED = "enforcement_approved"  # 法院强执执行申请已通过：法院通过了用户提交的强执执行申请
    ENFORCEMENT_TERMINATED = "enforcement_terminated"  # 法院已终结裁定：用户上传了法院的终结裁定书
    
    

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