import json
from typing import Any, Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, model_validator, Field, computed_field
from app.cases.schemas import Case
from app.evidences.models import EvidenceStatus
from app.agentic.agents.evidence_extractor_v2 import SlotExtraction

    
    
class AutoProcessRequest(BaseModel):
    case_id: int = Field(..., description="关联案件id")
    auto_classification: bool = Field(True, description="是否自动智能分类")
    auto_feature_extraction: bool = Field(True, description="是否自动智能特征提取")
    

class EvidenceEditRequest(BaseModel):
    classification_category: Optional[str] = Field(None, description="证据分类类型")
    classification_reasoning: Optional[str] = Field(None, description="证据分类推理过程")    
    evidence_features: Optional[List[SlotExtraction]] = Field(None, description="证据提取特征列表")


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
    
    evidence_features: Optional[List[Dict[str, Any]]] = Field(None, description="证据提取特征列表（包含校对信息）")
    features_extracted_at: Optional[datetime] = Field(None, description="证据最近特征提取时间")
    
    # 包含case信息用于校对
    case: Optional[Case] = Field(None, description="关联案件信息")
    
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
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
            slot_required = feature.get("slot_required", True)  # 默认为必需
            slot_value = feature.get("slot_value", "")
            if slot_required:
                # 检查是否有值
                has_value = slot_value != "未知" and str(slot_value).strip() != ""
                if not has_value:
                    return False
        return True
    

    
