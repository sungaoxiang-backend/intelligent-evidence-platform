# 简化版证据链模型 - 只做状态检查，不做复杂分析

from enum import Enum
from typing import Optional, List, Dict, Any

# 证据链不需要复杂的数据库模型
# 只需要简单的状态枚举即可

class EvidenceRequirementStatus(str, Enum):
    """证据要求状态"""
    MISSING = "missing"              # 缺失
    PARTIAL = "partial"              # 部分满足  
    SATISFIED = "satisfied"          # 已满足


class EvidenceChainStatus(str, Enum):
    """证据链整体状态"""
    NOT_STARTED = "not_started"      # 未开始（所有要求都缺失）
    IN_PROGRESS = "in_progress"      # 进行中（部分要求已满足）
    COMPLETED = "completed"          # 已完成（所有要求都满足）

# 不需要复杂的数据库表
# 证据链状态完全通过实时查询计算得出