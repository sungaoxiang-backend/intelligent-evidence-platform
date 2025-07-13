from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.cases.schemas import Case

class FileUploadResponse(BaseModel):
    """文件上传响应模型"""
    file_url: str
    file_name: str
    file_size: int
    file_extension: str

class BatchDeleteRequest(BaseModel):
    """批量删除请求模型"""
    evidence_ids: List[int]

class EvidenceBase(BaseModel):
    """证据基础模型"""
    file_name: str
    file_size: int
    file_extension: str
    tags: Optional[List[str]] = None
    
class EvidenceCreate(EvidenceBase):
    """证据创建模型"""
    case_id: int
    # 文件相关信息由API处理

class EvidenceUpdate(BaseModel):
    """证据更新模型"""
    tags: Optional[List[str]] = None
    evidence_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_reasoning: Optional[str] = None
    is_classified: Optional[bool] = None

class Evidence(EvidenceBase):
    """证据响应模型"""
    id: int
    case_id: int
    uploaded_by_id: int
    file_url: str
    file_name: str
    file_size: int
    file_extension: str
    
    # AI分类结果
    evidence_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_reasoning: Optional[str] = None
    is_classified: bool = False
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EvidenceWithCase(Evidence):
    """包含案件信息的证据模型"""
    case: Optional[Case] = None  # 使用Case schema而不是dict