from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.evidence import EvidenceType


# 共享属性
class EvidenceBase(BaseModel):
    """证据基础模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    evidence_type: Optional[EvidenceType] = None
    tags: Optional[List[str]] = None


# 创建时需要的属性
class EvidenceCreate(EvidenceBase):
    """证据创建模型"""
    title: str
    case_id: int
    # 文件相关信息由API处理


# 更新时可以修改的属性
class EvidenceUpdate(EvidenceBase):
    """证据更新模型"""
    pass


# 文件上传响应
class FileUploadResponse(BaseModel):
    """文件上传响应模型"""
    file_url: str
    file_name: str
    file_size: int
    file_extension: str


# API响应中的证据模型
class Evidence(EvidenceBase):
    """证据响应模型"""
    id: int
    case_id: int
    uploaded_by_id: int
    file_url: str
    file_name: str
    file_size: int
    file_extension: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 包含案件信息的证据模型
from app.schemas.case import Case

class EvidenceWithCase(Evidence):
    """包含案件信息的证据响应模型"""
    case: Case