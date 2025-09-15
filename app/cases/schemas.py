from datetime import datetime
from optparse import Option
from tokenize import OP
from typing import Optional, List, Callable, Awaitable, Any, Dict

from pydantic import BaseModel, computed_field, field_validator
from app.core.schemas import BaseSchema
from app.cases.models import CaseType, PartyType, CaseStatus
from app.users.schemas import User


class CasePartyCreate(BaseModel):
    """案件当事人创建模型"""
    party_name: str
    party_role: str
    party_type: PartyType
    
    # 主体信息
    name: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[str] = None
    nation: Optional[str] = None
    address: Optional[str] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    
    # 公司或个体工商户信息
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_code: Optional[str] = None
    
    # 银行信息
    owner_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_phone: Optional[str] = None
    
    @field_validator('party_name')
    @classmethod
    def validate_party_name(cls, v):
        if not v or not v.strip():
            raise ValueError('当事人名称不能为空')
        return v.strip()
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v, info):
        party_type = info.data.get('party_type')
        if party_type in [PartyType.PERSON, PartyType.INDIVIDUAL, PartyType.COMPANY]:
            if not v or not v.strip():
                raise ValueError(f'当当事人类型为{party_type.value}时，{cls._get_name_field_description(party_type)}不能为空')
        return v.strip() if v else v
    
    @field_validator('company_name')
    @classmethod
    def validate_company_name(cls, v, info):
        party_type = info.data.get('party_type')
        if party_type in [PartyType.INDIVIDUAL, PartyType.COMPANY]:
            if not v or not v.strip():
                raise ValueError(f'当当事人类型为{party_type.value}时，{cls._get_company_name_field_description(party_type)}不能为空')
        return v.strip() if v else v
    
    @classmethod
    def _get_name_field_description(cls, party_type: PartyType) -> str:
        """获取name字段的描述"""
        descriptions = {
            PartyType.PERSON: "自然人姓名",
            PartyType.INDIVIDUAL: "经营者名称", 
            PartyType.COMPANY: "法定代表人名称"
        }
        return descriptions.get(party_type, "姓名")
    
    @classmethod
    def _get_company_name_field_description(cls, party_type: PartyType) -> str:
        """获取company_name字段的描述"""
        descriptions = {
            PartyType.INDIVIDUAL: "个体工商户名称",
            PartyType.COMPANY: "公司名称"
        }
        return descriptions.get(party_type, "公司名称")
    
    
class CasePartyUpdate(BaseModel):
    """案件当事人更新模型"""
    party_name: Optional[str] = None
    party_role: Optional[str] = None
    party_type: Optional[PartyType] = None
    
     # 主体信息
    name: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[str] = None
    nation: Optional[str] = None
    address: Optional[str] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    
    # 公司或个体工商户信息
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_code: Optional[str] = None
    
    # 银行信息
    owner_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_phone: Optional[str] = None
    
    
class CasePartyResponse(BaseSchema):
    """案件当事人模型"""
    id: int
    party_name: str
    party_role: str
    party_type: PartyType
    
    # 主体信息
    name: Optional[str] = None
    gender: Optional[str] = None
    birthday: Optional[str] = None
    nation: Optional[str] = None
    address: Optional[str] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    
    # 公司或个体工商户信息
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_code: Optional[str] = None
    
    # 银行信息
    owner_name: Optional[str] = None
    bank_address: Optional[str] = None
    bank_account: Optional[str] = None
    bank_phone: Optional[str] = None


# 创建时需要的属性
class CaseCreate(BaseModel):
    """案件创建模型"""
    user_id: int
    case_parties: List[CasePartyCreate]
    loan_amount: float
    case_type: CaseType
    loan_date: Optional[datetime] = None
    court_name: Optional[str] = None
    description: Optional[str] = None
    
    @field_validator('case_parties')
    @classmethod
    def validate_case_parties(cls, v):
        """验证当事人配置：必须有一个债权人和一个债务人"""
        if not v or len(v) != 2:
            raise ValueError('案件必须包含两个当事人：一个债权人(creditor)和一个债务人(debtor)')
        
        party_roles = [party.party_role for party in v]
        expected_roles = {'creditor', 'debtor'}
        
        if set(party_roles) != expected_roles:
            raise ValueError('案件必须包含一个债权人(creditor)和一个债务人(debtor)')
        
        return v


# 更新时可以修改的属性
class CaseUpdate(BaseModel):
    """案件更新模型"""
    user_id: Optional[int] = None
    loan_amount: Optional[float] = None
    case_type: Optional[CaseType] = None
    case_status: Optional[CaseStatus] = None
    loan_date: Optional[datetime] = None
    court_name: Optional[str] = None
    description: Optional[str] = None


# API响应中的案件模型
class Case(BaseSchema):
    """案件响应模型"""
    id: int
    user_id: int
    case_parties: List[CasePartyResponse]
    loan_amount: float
    case_type: CaseType
    case_status: CaseStatus
    loan_date: Optional[datetime] = None
    court_name: Optional[str] = None
    description: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CaseWithUser(Case):
    user: User


class AssociationEvidenceFeature(BaseModel):
    """关联证据特征模型 - 单个slot信息"""
    slot_name: str
    slot_desc: str
    slot_value_type: str
    slot_required: bool
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
    evidence_features: List[Dict[str, Any]]  # 改为Dict以支持动态校对字段
    features_extracted_at: datetime
    case_id: int
    
    @computed_field
    @property
    def features_complete(self) -> bool:
        """判断特征提取是否完整
        
        判断标准：
        1. 所有required=true的slot_value都不是"未知"
        2. 如果字段有校对信息，必须校对成功(slot_is_consistent=True)
        """
        if not self.evidence_features:
            return False
        
        for feature in self.evidence_features:
            slot_required = feature.get("slot_required", True)
            slot_value = feature.get("slot_value", "")
            # slot_proofread_at = feature.get("slot_proofread_at")
            # slot_is_consistent = feature.get("slot_is_consistent")
            
            if slot_required:
                # 检查是否有值
                has_value = slot_value != "未知" and str(slot_value).strip() != ""
                if not has_value:
                    return False
                
                # # 如果有校对信息，检查校对是否成功
                # if slot_proofread_at and not slot_is_consistent:
                #     return False
        
        return True


class AssociationEvidenceFeatureUpdateRequest(BaseModel):
    """关联证据特征更新请求模型"""
    slot_group_name: Optional[str] = None
    association_evidence_ids: Optional[List[int]] = None
    evidence_feature_status: Optional[str] = None
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