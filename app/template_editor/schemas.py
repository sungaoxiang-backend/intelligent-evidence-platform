"""
模板编辑器 API 数据结构定义
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from datetime import datetime


class ParseDocxResponse(BaseModel):
    """解析 docx 响应"""

    code: int = Field(200, description="状态码")
    message: str = Field("解析成功", description="消息")
    data: Dict[str, Any] = Field(..., description="ProseMirror JSON 格式的文档")


class ExportDocxRequest(BaseModel):
    """导出 docx 请求"""

    prosemirror_json: Dict[str, Any] = Field(
        ..., description="ProseMirror JSON 格式的文档"
    )
    filename: Optional[str] = Field(
        None, description="导出文件名（可选）"
    )


class ExportDocxResponse(BaseModel):
    """导出 docx 响应"""

    code: int = Field(200, description="状态码")
    message: str = Field("导出成功", description="消息")
    data: Optional[Dict[str, Any]] = Field(None, description="响应数据")


# 模板管理相关的 Schema

class TemplateCreateRequest(BaseModel):
    """创建模板请求"""
    
    name: str = Field(..., description="模板名称", min_length=1, max_length=200)
    description: Optional[str] = Field(None, description="模板描述")
    category: Optional[str] = Field(None, description="分类名称", max_length=100)
    status: str = Field("draft", description="状态：draft/published")
    prosemirror_json: Dict[str, Any] = Field(..., description="ProseMirror JSON 格式的文档内容")
    docx_url: Optional[str] = Field(None, description="原始 DOCX 文件在 COS 中的 URL")


class TemplateUpdateRequest(BaseModel):
    """更新模板请求"""
    
    name: Optional[str] = Field(None, description="模板名称", min_length=1, max_length=200)
    description: Optional[str] = Field(None, description="模板描述")
    category: Optional[str] = Field(None, description="分类名称", max_length=100)
    status: Optional[str] = Field(None, description="状态：draft/published")
    prosemirror_json: Optional[Dict[str, Any]] = Field(None, description="ProseMirror JSON 格式的文档内容")
    docx_url: Optional[str] = Field(None, description="原始 DOCX 文件在 COS 中的 URL")


class PlaceholderInfo(BaseModel):
    """占位符信息"""
    
    placeholders: List[str] = Field(..., description="占位符名称列表")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="占位符元数据")


class TemplateResponse(BaseModel):
    """模板响应"""
    
    id: int = Field(..., description="模板ID")
    name: str = Field(..., description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    category: Optional[str] = Field(None, description="分类名称")
    status: str = Field(..., description="状态：draft/published")
    prosemirror_json: Dict[str, Any] = Field(..., description="ProseMirror JSON 格式的文档内容")
    docx_url: Optional[str] = Field(None, description="原始 DOCX 文件在 COS 中的 URL")
    placeholders: Optional[PlaceholderInfo] = Field(None, description="占位符信息")
    created_by_id: Optional[int] = Field(None, description="创建人ID")
    updated_by_id: Optional[int] = Field(None, description="更新人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class TemplateListResponse(BaseModel):
    """模板列表响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: List[TemplateResponse] = Field(..., description="模板列表")
    total: int = Field(..., description="总数")


class TemplateDetailResponse(BaseModel):
    """模板详情响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: TemplateResponse = Field(..., description="模板详情")


class ParseAndSaveRequest(BaseModel):
    """解析并保存模板请求"""
    
    name: str = Field(..., description="模板名称", min_length=1, max_length=200)
    description: Optional[str] = Field(None, description="模板描述")
    category: Optional[str] = Field(None, description="分类名称", max_length=100)
    status: str = Field("draft", description="状态：draft/published")
    save_to_cos: bool = Field(True, description="是否将 DOCX 文件保存到 COS")

