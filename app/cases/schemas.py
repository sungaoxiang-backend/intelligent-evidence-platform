from datetime import datetime
from optparse import Option
from tokenize import OP
from typing import Optional, List, Callable, Awaitable

from pydantic import BaseModel
from app.core.schemas import BaseSchema
from app.cases.models import CaseType, PartyType, CaseStatus
from app.users.schemas import User



# 创建时需要的属性
class CaseCreate(BaseModel):
    """案件创建模型"""
    user_id: int
    case_type: Optional[CaseType] = None
    creditor_name: str
    creditor_type: Optional[PartyType] = None
    debtor_name: Optional[str] = None
    debtor_type: Optional[PartyType] = None
    description: Optional[str] = None


# 更新时可以修改的属性
class CaseUpdate(BaseModel):
    """案件更新模型"""
    description: Optional[str] = None
    case_type: Optional[CaseType] = None
    creditor_name: Optional[str] = None
    creditor_type: Optional[PartyType] = None
    debtor_name: Optional[str] = None
    debtor_type: Optional[PartyType] = None



# API响应中的案件模型
class Case(BaseSchema):
    """案件响应模型"""
    id: int
    user_id: int
    creditor_name: str
    description: Optional[str] = None
    case_type: Optional[CaseType] = None
    creditor_type: Optional[PartyType] = None
    debtor_name: Optional[str] = None
    debtor_type: Optional[PartyType] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CaseWithUser(Case):
    user: User


# 综合案件录入模型
class CaseRegistrationRequest(BaseModel):
    """案件综合录入请求模型"""
    # 用户信息 - 复用UserCreate模型的字段
    user_name: str
    user_id_card: Optional[str] = None
    user_phone: Optional[str] = None
    
    # 案件信息 - 不包含title，将自动生成
    description: Optional[str] = None
    case_type: CaseType
    creditor_name: str
    creditor_type: Optional[PartyType] = None
    debtor_name: str
    debtor_type: Optional[PartyType] = None


# 综合案件录入响应模型
class CaseRegistrationResponse(BaseModel):
    """案件综合录入响应模型"""
    user: User
    case: Case
    is_new_user: bool  # 标识是否创建了新用户


class AssociationEvidenceFeature(BaseModel):
    """关联证据特征模型 - 单个slot信息"""
    slot_name: str
    slot_value: str
    slot_value_from_url: List[str]
    confidence: float
    reasoning: str


class AssociationEvidenceFeatureGroup(BaseModel):
    """关联证据特征组模型 - 整个slot_group信息"""
    id: int
    slot_group_name: str
    association_evidence_ids: List[int]
    evidence_feature_status: str
    evidence_features: List[AssociationEvidenceFeature]
    features_extracted_at: datetime
    validation_status: str
    case_id: int


class AssociationEvidenceFeatureUpdateRequest(BaseModel):
    """关联证据特征更新请求模型"""
    slot_group_name: Optional[str] = None
    evidence_feature_status: Optional[str] = None
    validation_status: Optional[str] = None
    evidence_features: Optional[List[AssociationEvidenceFeature]] = None

    class Config:
        from_attributes = True

class AssociationEvidenceFeatureCreate(BaseModel):
    """关联证据特征创建模型"""
    slot_group_name: str
    association_evidence_ids: List[int]
    evidence_features: List[AssociationEvidenceFeature]
    

class AutoProcessRequest(BaseModel):
    """自动处理请求模型"""
    case_id: int
    evidence_ids: List[int]
    send_progress: Optional[Callable[[dict], Awaitable[None]]] = None
    
    
class AutoProcessResponse(BaseModel):
    """关联证据特征响应模型"""
    id: int
    slot_group_name: str
    association_evidence_ids: List[int]
    evidence_features: List[AssociationEvidenceFeature]
    features_extracted_at: Optional[datetime]
    
    
class CaseWithAssociationEvidenceFeaturesResponse(CaseWithUser):
    association_evidence_features: Optional[List[AssociationEvidenceFeatureGroup]]