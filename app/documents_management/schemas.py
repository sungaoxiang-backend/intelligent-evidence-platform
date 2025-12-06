"""
文书管理 API 数据结构定义
完全独立实现，不依赖现有模板系统
"""
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List
from datetime import datetime


class DocumentCreateRequest(BaseModel):
    """创建文书请求"""
    
    name: str = Field(..., description="文书名称", min_length=1, max_length=200)
    description: Optional[str] = Field(None, description="文书描述")
    category: Optional[str] = Field(None, description="分类名称", max_length=100)
    content_json: Dict[str, Any] = Field(..., description="ProseMirror JSON 格式的文档内容")


class DocumentUpdateRequest(BaseModel):
    """更新文书请求"""
    
    name: Optional[str] = Field(None, description="文书名称", min_length=1, max_length=200)
    description: Optional[str] = Field(None, description="文书描述")
    category: Optional[str] = Field(None, description="分类名称", max_length=100)
    content_json: Optional[Dict[str, Any]] = Field(None, description="ProseMirror JSON 格式的文档内容")


class DocumentResponse(BaseModel):
    """文书响应"""
    
    id: int = Field(..., description="文书ID")
    name: str = Field(..., description="文书名称")
    description: Optional[str] = Field(None, description="文书描述")
    category: Optional[str] = Field(None, description="分类名称")
    content_json: Dict[str, Any] = Field(..., description="ProseMirror JSON 格式的文档内容")
    created_by_id: Optional[int] = Field(None, description="创建人ID")
    updated_by_id: Optional[int] = Field(None, description="更新人ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """文书列表响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: List[DocumentResponse] = Field(..., description="文书列表")
    total: int = Field(..., description="总数")


class DocumentDetailResponse(BaseModel):
    """文书详情响应"""
    
    code: int = Field(200, description="状态码")
    message: str = Field("查询成功", description="消息")
    data: DocumentResponse = Field(..., description="文书详情")


class DocumentExportRequest(BaseModel):
    """导出文书为 PDF 请求"""
    
    html_content: str = Field(..., description="HTML 内容（由前端从 ProseMirror JSON 转换生成）")
    filename: Optional[str] = Field(None, description="导出文件名（可选）")

