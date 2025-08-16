# 优化版证据链响应模型

from typing import List, Optional, Union
from pydantic import BaseModel
from enum import Enum

class EvidenceRequirementStatus(str, Enum):
    """证据要求状态"""
    MISSING = "missing"      # 缺失
    PARTIAL = "partial"      # 部分满足
    SATISFIED = "satisfied"  # 完全满足

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

class EvidenceSlotDetail(BaseModel):
    """证据槽位详情"""
    slot_name: str
    is_satisfied: bool
    is_core: bool  # 是否为核心证据槽位
    # 证据来源：可能是单个证据ID，也可能是关联证据组名称
    source_type: str  # "evidence" | "association_group" | "none"
    source_id: Optional[Union[int, str]] = None  # 证据ID 或 slot_group_name
    confidence: Optional[float] = None


class EvidenceTypeRequirement(BaseModel):
    """证据类型要求"""
    evidence_type: str
    status: EvidenceRequirementStatus
    # 直接展示槽位详情，包含完整的来源信息
    slots: List[EvidenceSlotDetail]
    
    # 新增字段：核心特征和补充特征的完成情况
    core_slots_count: int = 0
    core_slots_satisfied: int = 0
    supplementary_slots_count: int = 0
    supplementary_slots_satisfied: int = 0
    core_completion_percentage: float = 0.0
    supplementary_completion_percentage: float = 0.0


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
    
    requirements: List[EvidenceTypeRequirement]


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