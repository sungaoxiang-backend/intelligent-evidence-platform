import json
from typing import Any, Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, model_validator, Field
from app.cases.schemas import Case
from app.evidences.models import EvidenceStatus
    
    
class AutoProcessRequest(BaseModel):
    case_id: int = Field(..., description="关联案件id")
    auto_classification: bool = Field(True, description="是否自动智能分类")
    auto_feature_extraction: bool = Field(True, description="是否自动智能特征提取")
    

class EvidenceEditRequest(BaseModel):
    classification_category: Optional[str] = Field(None, description="证据分类类型")
    classification_confidence: Optional[float] = Field(None, description="证据分类置信度")
    classification_reasoning: Optional[str] = Field(None, description="证据分类推理过程")    
    evidence_features: Optional[List[Dict]] = Field(None, description="证据提取特征列表")


class BatchCheckEvidenceRequest(BaseModel):
    evidence_ids: List[int] = Field(..., description="证据id列表")

class BatchDeleteRequest(BaseModel):
    evidence_ids: List[int] = Field(..., description="证据id列表")
    

class UploadFileResponse(BaseModel):
    file_url: str = Field(..., description="证据文件url")
    file_name: str = Field(..., description="证据文件名称")
    file_size: int = Field(..., description="证据文件体积")
    file_extension: str = Field(..., description="证据文件类型")
    

class EvidenceResponse(BaseModel):
    id: int = Field(..., description="证据id")
    file_url: str = Field(..., description="证据文件url")
    file_name: str = Field(..., description="证据文件名称")
    file_size: int = Field(..., description="证据文件体积")
    file_extension: str = Field(..., description="证据文件类型")
    evidence_status: EvidenceStatus = Field(EvidenceStatus.UPLOADED.value, description="证据状态")
    
    classification_category: Optional[str] = Field(None, description="证据分类类型")
    classification_confidence: Optional[float] = Field(None, description="证据分类置信度")
    classification_reasoning: Optional[str] = Field(None, description="证据分类推理过程")
    classified_at: Optional[datetime] = Field(None, description="证据最近分类时间")
    
    evidence_features: Optional[List[Dict]] = Field(None, description="证据提取特征列表")
    features_extracted_at: Optional[datetime] = Field(None, description="证据最近特征提取时间")
    
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    
