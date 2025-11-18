"""
模板编辑器 API 数据结构定义
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


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

