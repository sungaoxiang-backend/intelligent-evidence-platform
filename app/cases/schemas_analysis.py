from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.core.schemas import BaseSchema

class CaseInfoCommitCreate(BaseModel):
    statement: Optional[str] = None
    materials: List[Dict[str, Any]] = []

class CaseInfoCommit(BaseSchema):
    id: int
    case_id: int
    statement: Optional[str] = None
    materials: List[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class CaseInfoCommitDelete(BaseModel):
    ids: List[int]


class CaseAnalysisReport(BaseSchema):
    """案件分析报告响应模型"""
    id: int
    case_id: int
    content: Optional[Dict[str, Any]] = None  # 可为空（处理中时）
    
    # 触发元信息
    trigger_type: str  # commit_added, commit_updated, commit_removed, manual
    ref_commit_ids: List[int] = []  # 引用的 commits ID 列表
    
    # 状态追踪
    status: str  # pending, processing, completed, failed
    error_message: Optional[str] = None
    
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TriggerAnalysisRequest(BaseModel):
    """触发分析请求模型"""
    trigger_type: str = "manual"  # commit_added, commit_updated, commit_removed, manual
    commit_ids: List[int] = []  # 引用的 commits ID 列表（空则使用全量）


class TriggerAnalysisResponse(BaseModel):
    """触发分析响应模型"""
    report_id: int
    status: str
    message: str
