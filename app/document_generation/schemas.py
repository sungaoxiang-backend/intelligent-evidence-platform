"""
文书生成 API 数据结构定义
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Any, Dict, Optional, List
from datetime import datetime


# ==================== 请求 Schemas ====================

class DocumentGenerationCreateRequest(BaseModel):
    """创建文书生成记录请求"""
    
    case_id: int = Field(..., description="案件ID", gt=0)
    template_id: int = Field(..., description="模板ID", gt=0)


class DocumentGenerationUpdateRequest(BaseModel):
    """更新文书生成草稿请求"""
    
    form_data: Dict[str, Any] = Field(
        ..., 
        description="占位符填写数据，格式：{name: value}"
    )


class DocumentGenerationExportRequest(BaseModel):
    """导出文书请求"""
    
    filename: Optional[str] = Field(
        None, 
        description="导出文件名（不含扩展名）",
        max_length=200
    )


# ==================== 响应 Schemas ====================

class CaseBasicInfo(BaseModel):
    """案件基本信息（用于嵌套）"""
    
    id: int
    case_type: Optional[str] = None
    case_status: str
    description: Optional[str] = None
    loan_amount: Optional[float] = None
    court_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class TemplateBasicInfo(BaseModel):
    """模板基本信息（用于嵌套）"""
    
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: str
    
    model_config = ConfigDict(from_attributes=True)


class PlaceholderInfo(BaseModel):
    """占位符信息"""
    
    id: int
    name: str
    type: str
    options: Optional[List[Dict[str, str]]] = None
    
    model_config = ConfigDict(from_attributes=True)


class TemplateDetailInfo(BaseModel):
    """模板详细信息（包含占位符）"""
    
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: str
    prosemirror_json: Dict[str, Any]
    docx_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    placeholders: List[PlaceholderInfo] = []
    
    model_config = ConfigDict(from_attributes=True)


class DocumentGenerationResponse(BaseModel):
    """文书生成记录响应"""
    
    id: int
    case_id: int
    template_id: int
    form_data: Dict[str, Any]
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DocumentGenerationDetailResponse(BaseModel):
    """文书生成详情响应（包含完整的模板和案件信息）"""
    
    id: int
    case_id: int
    template_id: int
    form_data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    # 关联数据
    case: CaseBasicInfo
    template: TemplateDetailInfo
    
    model_config = ConfigDict(from_attributes=True)


class PublishedTemplateListResponse(BaseModel):
    """已发布模板列表响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: List[TemplateDetailInfo] = Field(..., description="模板列表")
    total: int = Field(..., description="总数")


class DocumentGenerationDetailApiResponse(BaseModel):
    """文书生成详情 API 响应（带标准格式）"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("操作成功", description="消息")
    data: DocumentGenerationDetailResponse = Field(..., description="文书生成详情")


class DocumentGenerationApiResponse(BaseModel):
    """文书生成记录 API 响应（带标准格式）"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("操作成功", description="消息")
    data: DocumentGenerationResponse = Field(..., description="文书生成记录")


class ExportDocumentResponse(BaseModel):
    """导出文书响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("生成成功", description="消息")
    data: Dict[str, str] = Field(
        ..., 
        description="响应数据，包含 url 和 filename"
    )

