# 优化版证据链响应模型

from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime

class EvidenceRequirementStatus(str, Enum):
    SATISFIED = "satisfied"
    PARTIAL = "partial"
    MISSING = "missing"

class EvidenceSlotDetail(BaseModel):
    slot_name: str
    is_satisfied: bool
    is_core: bool
    source_type: str  # "evidence", "association_group", "none"
    source_id: Optional[Union[int, str]]  # 整数：证据ID，字符串：关联特征组名称
    confidence: Optional[float]
    slot_proofread_at: Optional[datetime]
    slot_is_consistent: Optional[bool]
    slot_expected_value: Optional[str]
    slot_proofread_reasoning: Optional[str]

class EvidenceTypeRequirement(BaseModel):
    evidence_type: str
    status: EvidenceRequirementStatus
    slots: List[EvidenceSlotDetail]
    core_slots_count: int
    core_slots_satisfied: int
    supplementary_slots_count: int
    supplementary_slots_satisfied: int
    core_completion_percentage: float
    supplementary_completion_percentage: float

class RoleBasedRequirement(BaseModel):
    """角色相关的证据要求"""
    evidence_type: str  # 如 "身份证 (债权人)"
    role: str  # "creditor" 或 "debtor"
    status: EvidenceRequirementStatus
    slots: List[EvidenceSlotDetail]
    core_slots_count: int
    core_slots_satisfied: int
    supplementary_slots_count: int
    supplementary_slots_satisfied: int
    core_completion_percentage: float
    supplementary_completion_percentage: float

class RoleGroupRequirement(BaseModel):
    """角色组要求 - 多个角色都需要满足"""
    evidence_type: str  # 如 "身份证"
    type: str = "role_group"
    roles: List[str]  # ["creditor", "debtor"]
    status: EvidenceRequirementStatus
    sub_requirements: List[RoleBasedRequirement]
    core_slots_count: int
    core_slots_satisfied: int
    supplementary_slots_count: int
    supplementary_slots_satisfied: int
    core_completion_percentage: float
    supplementary_completion_percentage: float

class OrGroupRequirement(BaseModel):
    """或组要求 - 满足其中一个即可"""
    evidence_type: str  # 如 "身份证 或 中华人民共和国居民户籍档案"
    type: str = "or_group"
    sub_groups: List[Union[RoleGroupRequirement, EvidenceTypeRequirement]]
    status: EvidenceRequirementStatus
    core_slots_count: int
    core_slots_satisfied: int
    supplementary_slots_count: int
    supplementary_slots_satisfied: int
    core_completion_percentage: float
    supplementary_completion_percentage: float

# 联合类型，支持所有可能的证据要求类型
EvidenceRequirement = Union[
    EvidenceTypeRequirement, 
    RoleGroupRequirement, 
    OrGroupRequirement
]

class EvidenceChainStatus(str, Enum):
    """证据链状态"""
    NOT_STARTED = "not_started"  # 未开始
    IN_PROGRESS = "in_progress"  # 进行中
    COMPLETED = "completed"      # 已完成

class EvidenceChainFeasibilityStatus(str, Enum):
    """证据链可行性状态"""
    INCOMPLETE = "incomplete"    # 不可行（核心特征不完备）
    FEASIBLE = "feasible"        # 可行（核心特征完备，但补充特征不完备）
    ACTIVATED = "activated"      # 已激活（核心特征和补充特征都完备）

class EvidenceChain(BaseModel):
    """证据链"""
    chain_id: str
    chain_name: str
    status: EvidenceChainStatus
    completion_percentage: float
    
    # 新增字段：可行性相关
    feasibility_status: EvidenceChainFeasibilityStatus
    feasibility_completion: float  # 可行性完成度（基于核心特征）
    supplementary_completion: float  # 补充特征完成度
    is_feasible: bool  # 是否可行
    is_activated: bool  # 是否已激活
    
    # 核心特征统计
    core_requirements_count: int  # 有核心特征要求的证据类型数量
    core_requirements_satisfied: int  # 核心特征完备的证据类型数量
    
    requirements: List[EvidenceRequirement]


class EvidenceChainDashboard(BaseModel):
    """证据链看板"""
    case_id: int
    chains: List[EvidenceChain]
    overall_completion: float
    
    # 可行性统计
    overall_feasibility_completion: float  # 整体可行性完成度
    feasible_chains_count: int  # 可行的证据链数量
    activated_chains_count: int  # 已激活的证据链数量
    
    # 简单的统计信息
    total_requirements: int
    satisfied_requirements: int
    missing_requirements: int