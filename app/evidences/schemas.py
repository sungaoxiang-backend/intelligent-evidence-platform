import json
from typing import Any, Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, model_validator, Field, computed_field
from app.cases.schemas import Case
from app.evidences.models import EvidenceStatus, EvidenceRole
from app.agentic.agents.evidence_extractor_v2 import SlotExtraction
from app.core.schemas import BaseSchema
    
    
class AutoProcessRequest(BaseModel):
    case_id: int = Field(..., description="关联案件id")
    auto_classification: bool = Field(True, description="是否自动智能分类")
    auto_feature_extraction: bool = Field(True, description="是否自动智能特征提取")
    

class EvidenceEditRequest(BaseModel):
    evidence_role: Optional[EvidenceRole] = Field(None, description="证据角色")
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
    

class EvidenceResponse(BaseSchema):
    id: int = Field(..., description="证据id")
    file_url: str = Field(..., description="证据文件url")
    file_name: str = Field(..., description="证据文件名称")
    file_size: int = Field(..., description="证据文件体积")
    file_extension: str = Field(..., description="证据文件类型")
    evidence_status: EvidenceStatus = Field(default=EvidenceStatus.UPLOADED, description="证据状态")
    evidence_role: Optional[str] = Field(None, description="证据角色，可选值：creditor（债权人）、debtor（债务人）")
    
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
        3. 支持组合验证：required为字符串时，指向的字段组中至少有一个有值
        """
        if not self.evidence_features:
            return False
        
        # # 处理组合验证：构建字段引用图，找到所有连通分量
        # field_groups = self._build_field_groups()
        
        # # 验证每个组：组内至少有一个字段有值
        # for group in field_groups:
        #     has_group_value = False
        #     for field_name in group:
        #         feature = next((f for f in self.evidence_features if f["slot_name"] == field_name), None)
        #         if feature and feature.get("slot_value", "") not in ["未知", ""]:
        #             has_group_value = True
        #             break
        #     if not has_group_value:
        #         return False
        
        # 验证单个必需字段（保持原有逻辑）
        for feature in self.evidence_features:
            slot_required = feature.get("slot_required", True)
            slot_value = feature.get("slot_value", "")
            
            # 只处理布尔值的required
            if isinstance(slot_required, bool) and slot_required:
                has_value = slot_value != "未知" and str(slot_value).strip() != ""
                if not has_value:
                    return False
        
        return True
    
    # def _build_field_groups(self) -> List[List[str]]:
    #     """构建字段引用图，返回所有连通分量（字段组）"""
    #     if not self.evidence_features:
    #         return []
        
    #     # 构建邻接表
    #     graph = {}
    #     for feature in self.evidence_features:
    #         slot_name = feature["slot_name"]
    #         slot_required = feature.get("slot_required")
            
    #         # 只处理需要分组的字段（slot_required为字符串）
    #         if isinstance(slot_required, str):
    #             if slot_name not in graph:
    #                 graph[slot_name] = []
    #             if slot_required not in graph:
    #                 graph[slot_required] = []
    #             # 添加双向边
    #             graph[slot_name].append(slot_required)
    #             graph[slot_required].append(slot_name)
        
    #     # 使用DFS找到所有连通分量
    #     visited = set()
    #     groups = []
        
    #     for field_name in graph:
    #         if field_name not in visited:
    #             group = []
    #             self._dfs(field_name, graph, visited, group)
    #             if group:  # 只添加非空组
    #                 groups.append(group)
        
    #     return groups
    
    # def _dfs(self, field_name: str, graph: dict, visited: set, group: list):
    #     """深度优先搜索，找到连通分量"""
    #     if field_name in visited:
    #         return
    #     
    #     visited.add(field_name)
    #     group.append(field_name)
    #     
    #     # 遍历所有相邻字段
    #     for neighbor in graph.get(field_name, []):
    #         if neighbor not in visited:
    #             self._dfs(neighbor, graph, visited, group)
    

class EvidenceCardCastingRequest(BaseModel):
    """证据卡片铸造请求模型"""
    case_id: int = Field(..., description="案件ID")
    evidence_ids: List[int] = Field(..., min_items=1, description="证据ID列表（至少一个）")


class EvidenceCardResponse(BaseModel):
    """证据卡片响应模型"""
    id: int = Field(..., description="卡片ID")
    evidence_ids: List[int] = Field(..., description="关联的证据ID列表（按序号排序）")
    card_info: Optional[Dict[str, Any]] = Field(None, description="卡片信息，包含类型、特征等")
    updated_times: int = Field(..., description="更新次数")
    created_at: Optional[str] = Field(None, description="创建时间（ISO格式）")
    updated_at: Optional[str] = Field(None, description="更新时间（ISO格式）")


class CardFeatureUpdate(BaseModel):
    """卡片特征更新模型"""
    slot_name: str = Field(..., description="特征名称（slot_name）")
    slot_value: Any = Field(..., description="特征值（slot_value）")


class ReferencedEvidenceUpdate(BaseModel):
    """引用证据更新模型"""
    evidence_id: int = Field(..., description="证据ID")
    sequence_number: int = Field(..., description="序号（从0开始）")


class EvidenceCardUpdateRequest(BaseModel):
    """证据卡片更新请求模型"""
    card_info: Optional[Dict[str, Any]] = Field(None, description="卡片信息更新（card_info字段）")
    card_features: Optional[List[CardFeatureUpdate]] = Field(None, description="卡片特征更新列表（更新card_info中的card_features）")
    referenced_evidences: Optional[List[ReferencedEvidenceUpdate]] = Field(None, description="引用证据更新列表（更新关联关系和顺序）")
