from datetime import datetime
from optparse import Option
from tokenize import OP
from typing import Optional, List, Callable, Awaitable, Any, Dict

from pydantic import BaseModel, computed_field, field_validator, Field
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
    case_parties: Optional[List[CasePartyUpdate]] = None
    


# API响应中的案件模型
class Case(BaseSchema):
    """案件响应模型"""
    id: int
    user_id: int
    case_parties: List[CasePartyResponse]
    loan_amount: float
    case_type: Optional[CaseType] = None
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
    """自动处理请求模型 - 用于API接口"""
    case_id: int
    evidence_ids: List[int]
    
    class Config:
        json_schema_extra = {
            "example": {
                "case_id": 1,
                "evidence_ids": [1, 2, 3]
            }
        }
    
    
class AutoProcessResponse(BaseModel):
    """关联证据特征响应模型"""
    id: int
    slot_group_name: str
    association_evidence_ids: List[int]
    evidence_features: List[AssociationEvidenceFeature]
    features_extracted_at: Optional[datetime]
    
    
class CaseWithAssociationEvidenceFeaturesResponse(CaseWithUser):
    association_evidence_features: Optional[List[AssociationEvidenceFeatureGroup]]


class StatementResource(BaseModel):
    """案件陈述资源, 处理观点维度时使用"""
    statement: str = Field(description="案件陈述资源")


class MaterialResource(BaseModel):
    """案件材料资源, 处理证据维度时使用"""
    materials: List[str] = Field(description="案件材料资源")


class LegalBasisResource(BaseModel):
    """法律依据资源, 处理法律维度时使用"""
    source_channel: str = Field(description="法律依据来源渠道：web_search, built_in, system_resources")
    basis: str = Field(description="法律法条依据")
    source_from: Optional[str] = Field(default=None, description="法律法条依据来源: url, built_in, path")
    priority: int = Field(default=1, description="优先级：1最高(内置), 2中(系统资源), 3最低(网络搜索)")


class SystemResource(BaseModel):
    """论点维度处理引用系统资源"""
    skills: List[str] = Field(default=[], description="系统资源技能")
    assets: List[str] = Field(default=[], description="系统资源资产")


class CaseResources(BaseModel):
    """案件引用资源（陈述或材料）"""
    statement: Optional[str] = Field(default=None, description="引用的陈述内容")
    materials: Optional[List[str]] = Field(default=None, description="引用的材料列表")


class DimensionResult(BaseModel):
    """论点维度处理结果（观点/证据维度）"""
    question: str = Field(description="维度预设问题")
    answer: str = Field(description="维度预设问题回答")
    reason: str = Field(description="维度预设问题回答原因")
    refs_case_resources: Optional[CaseResources] = Field(default=None, description="引用的案件资源")


class LegalDimensionResult(BaseModel):
    """法律维度处理结果"""
    question: str = Field(description="法律维度预设问题")
    answer: str = Field(description="法律维度问题回答")
    reason: str = Field(description="法律维度回答原因")
    refs_legal_resources: List[LegalBasisResource] = Field(description="引用的法律依据列表")


class ProbabilityInfo(BaseModel):
    """高度盖然性评估信息"""
    positive: str = Field(description="积极信息（已证明的有利事实）")
    negative: str = Field(description="消极信息（证据不足的方面）")
    conflict: str = Field(default="", description="冲突信息（证据矛盾的方面）")
    confidence_score: Optional[float] = Field(default=None, description="置信度分数 0-1")
    confidence_level: Optional[str] = Field(default=None, description="置信度级别: low/medium/high")


class ConclusionDimensionResult(BaseModel):
    """论点结论维度处理结果"""
    answer: str = Field(description="结论维度回答")
    probability_info: ProbabilityInfo = Field(description="高度盖然性评估")


# ============ 维度结构 ============

class ReasoningSection(BaseModel):
    """推理维度（观点/证据）"""
    refs_system_resources: SystemResource = Field(description="引用的系统资源")
    results: List[DimensionResult] = Field(description="推理结果列表（支持多结论）")


class LegalSection(BaseModel):
    """法律维度"""
    refs_system_resources: SystemResource = Field(description="引用的系统资源")
    results: LegalDimensionResult = Field(description="法律分析结果")


class ConclusionSection(BaseModel):
    """结论维度"""
    refs_system_resources: SystemResource = Field(description="引用的系统资源")
    results: List[ConclusionDimensionResult] = Field(description="结论结果列表（支持多结论）")


# ============ 论点块结构 ============

class ArgumentBlock(BaseModel):
    """标准论点块（4个维度）"""
    view_points: ReasoningSection = Field(description="观点维度")
    evidences: ReasoningSection = Field(description="证据维度")
    laws: LegalSection = Field(description="法律维度")
    conclusion: ConclusionSection = Field(description="结论维度")


# ============ 特殊论点结构 ============

class PartiesArgument(BaseModel):
    """当事人信息论点（嵌套：原告/被告）"""
    plaintiff: ArgumentBlock = Field(description="原告信息论点块")
    defendant: ArgumentBlock = Field(description="被告信息论点块")


class RightsObligationsArgument(BaseModel):
    """权利与义务变化过程论点（嵌套：建立/履行/打破）"""
    formation: ArgumentBlock = Field(description="权利义务建立阶段")
    performance: ArgumentBlock = Field(description="权利义务履行阶段")
    breach: ArgumentBlock = Field(description="权利义务打破阶段（违约）")


# ============ 报告结论和追问 ============

class LegalReportPursuitQuestion(BaseModel):
    """案件论证报告追问问题"""
    question: str = Field(description="追问问题内容")
    type: str = Field(description="追问问题类型: guidance(引导型), risk_warning(风险提示), clarification(澄清型)")


class LegalReportConclusion(BaseModel):
    """案件论证报告总结论"""
    refs_system_resources: SystemResource = Field(description="引用的系统资源")
    summary: str = Field(description="报告一句话总结")
    probability_info: ProbabilityInfo = Field(description="总体高度盖然性评估")
    pursuit_questions: List[LegalReportPursuitQuestion] = Field(
        description="追问问题列表（恰好3个）",
        min_length=3,
        max_length=3
    )


# ============ 完整报告结构 ============

class LegalReport(BaseModel):
    """案件论证报告（5大论点 + 总结论）"""
    case_id: str = Field(description="案件ID")
    case_title: str = Field(description="案件标题")
    
    # 5大论点
    cause_of_action: ArgumentBlock = Field(description="论点1: 案由")
    parties: PartiesArgument = Field(description="论点2: 当事人信息（原告/被告）")
    jurisdiction: ArgumentBlock = Field(description="论点3: 管辖法院")
    claims: ArgumentBlock = Field(description="论点4: 诉讼请求")
    rights_and_obligations_process: RightsObligationsArgument = Field(
        description="论点5: 权利与义务变化过程（建立/履行/打破）"
    )
    
    # 总结论
    conclusion: LegalReportConclusion = Field(description="报告总结论")