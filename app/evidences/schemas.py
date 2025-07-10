from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# 共享属性
class EvidenceBase(BaseModel):
    """证据基础模型"""
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_extension: Optional[str] = None
    tags: Optional[List[str]] = None


# 创建时需要的属性
class EvidenceCreate(EvidenceBase):
    """证据创建模型"""
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


# 文件上传结果
class FileUploadResult(BaseModel):
    """文件上传结果模型"""
    filename: str
    url: str
    success: bool
    error: Optional[str] = None

# 批量删除请求
class BatchDeleteRequest(BaseModel):
    """批量删除请求模型"""
    evidence_ids: List[int]


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
from app.cases.schemas import Case

class EvidenceWithCase(Evidence):
    """包含案件信息的证据响应模型"""
    case: Case