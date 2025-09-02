"""
文书生成模块
提供Word文档生成功能，支持模板管理和自动数据填充
"""

from .services import DocumentGenerator
from .schemas import DocumentGenerateRequest, DocumentGenerateResponse

__all__ = [
    "DocumentGenerator",
    "DocumentGenerateRequest",
    "DocumentGenerateResponse"
]
