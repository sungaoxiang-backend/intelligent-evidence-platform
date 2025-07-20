import json
from typing import Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, model_validator
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

from app.core.schemas import BaseSchema

class EvidenceBase(BaseModel):
    """证据基础模型"""
    file_name: str
    file_size: int
    file_extension: str
    
class EvidenceCreate(EvidenceBase):
    """证据创建模型"""
    case_id: int
    # 文件相关信息由API处理

class EvidenceUpdate(BaseModel):
    """证据更新模型"""
    evidence_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_reasoning: Optional[str] = None
    is_classified: Optional[bool] = None

class Evidence(BaseSchema, EvidenceBase):
    """证据响应模型"""
    id: int
    case_id: int
    file_url: str
    
    # AI分类结果
    evidence_type: Optional[str] = None
    classification_confidence: Optional[float] = None
    classification_reasoning: Optional[str] = None
    is_classified: bool = False
    
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    def unpack_individual_features(cls, data: Any) -> Any:
        if hasattr(data, "individual_features"):
            features = data.individual_features
            if features:
                # Pydantic v2 from_attributes 模式下，如果 individual_features 是字符串，需要先解析
                if isinstance(features, str):
                    try:
                        features = json.loads(features)
                    except json.JSONDecodeError:
                        features = {}
                
                if isinstance(features, dict):
                    data.evidence_type = features.get("evidence_type")
                    data.classification_confidence = features.get("confidence")
                    data.classification_reasoning = features.get("reasoning")
                    data.is_classified = True
        return data

    class Config:
        from_attributes = True

class EvidenceWithCase(Evidence):
    """包含案件信息的证据模型"""
    case: Optional[Case] = None