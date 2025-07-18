from typing import Any, Optional, List, Dict, Union
from datetime import datetime
from pydantic import BaseModel, Field


# FeatureGroup相关模型
class FeatureGroupBase(BaseModel):
    """特征组基础模型"""
    name: str
    description: Optional[str] = None


class FeatureGroupCreate(FeatureGroupBase):
    """特征组创建模型"""
    extracted_features: Optional[Dict[str, Any]] = None
    is_processed: bool = False


class FeatureGroupUpdate(BaseModel):
    """特征组更新模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    extracted_features: Optional[Dict[str, Any]] = None
    is_processed: Optional[bool] = None


class FeatureGroup(FeatureGroupBase):
    """特征组响应模型"""
    id: int
    extracted_features: Optional[Dict[str, Any]] = None
    is_processed: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 关联表相关模型
class EvidenceFeatureAssociationBase(BaseModel):
    """证据与特征组关联基础模型"""
    evidence_id: int
    feature_group_id: int
    relevance_score: Optional[float] = None
    position: Optional[int] = None


class EvidenceFeatureAssociationCreate(EvidenceFeatureAssociationBase):
    """证据与特征组关联创建模型"""
    pass


class EvidenceFeatureAssociationUpdate(BaseModel):
    """证据与特征组关联更新模型"""
    relevance_score: Optional[float] = None
    position: Optional[int] = None


class EvidenceFeatureAssociation(EvidenceFeatureAssociationBase):
    """证据与特征组关联响应模型"""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 简化的组合模型 - 只包含ID引用，不直接嵌套对象
class FeatureGroupWithEvidenceIds(FeatureGroup):
    """包含关联证据ID的特征组模型"""
    evidence_ids: List[int] = []


class EvidenceFeatureGroupSummary(BaseModel):
    """证据与特征组关联摘要模型"""
    evidence_id: int
    feature_group_ids: List[int] = []
    total_associations: int = 0


# 批量操作模型
class BatchFeatureGroupRequest(BaseModel):
    """批量特征组操作请求模型"""
    feature_group_ids: List[int]


class BatchEvidenceFeatureAssociationRequest(BaseModel):
    """批量关联操作请求模型"""
    evidence_ids: List[int]
    feature_group_id: int
    relevance_score: Optional[float] = None


# 特征提取结果模型
class FeatureExtractionResult(BaseModel):
    """特征提取结果模型，用于代理返回结果"""
    feature_name: str
    feature_value: Any
    confidence: Optional[float] = None
    reasoning: Optional[str] = None


class FeatureExtractionResponse(BaseModel):
    """特征提取响应模型，用于API响应"""
    evidence_id: int
    features: Dict[str, Any]
    is_processed: bool = True
    processing_time: Optional[float] = None
    message: Optional[str] = None


# WebSocket进度更新模型
class FeatureExtractionProgressUpdate(BaseModel):
    """特征提取进度更新模型，用于WebSocket通信"""
    evidence_id: int
    feature_group_id: Optional[int] = None
    progress: float  # 0.0 到 1.0
    status: str  # "processing", "completed", "failed"
    message: Optional[str] = None
    current_step: Optional[str] = None
    total_steps: Optional[int] = None
    current_step_progress: Optional[float] = None


# 如果需要完整的组合数据，通过专门的服务层方法提供
class FeatureGroupDetailResponse(BaseModel):
    """特征组详情响应模型 - 通过服务层组装"""
    feature_group: FeatureGroup
    associated_evidences: List[Dict[str, Any]] = []  # 简化的证据信息
    association_count: int = 0


class EvidenceClassificationByUrlsRequest(BaseModel):
    urls: List[str]


class EvidenceFeatureExtractionRequest(BaseModel):
    """证据特征提取请求"""
    urls: List[str]
    evidence_type: str
    consider_correlations: bool = False


class EvidenceFeatureExtractionByUrlsRequest(BaseModel):
    """通过URL进行证据特征提取的请求"""
    urls: List[str]
    evidence_type: str
    consider_correlations: bool = False

