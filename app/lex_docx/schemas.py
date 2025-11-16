import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.schemas import BaseSchema
from app.lex_docx.models import TemplateStatus


class PlaceholderValidation(BaseModel):
    """占位符验证规则"""
    min: Optional[float] = None
    max: Optional[float] = None
    pattern: Optional[str] = None  # 正则表达式


class PlaceholderMetadata(BaseModel):
    """占位符元数据模型"""
    type: str = Field(..., description="字段类型：text, number, date, textarea, checkbox, multiselect")
    label: str = Field(..., description="字段显示标签")
    required: bool = Field(default=False, description="是否必填")
    default_value: Optional[Any] = Field(default=None, description="默认值")
    options: Optional[List[str]] = Field(default=None, description="选项列表（多选框和复选框需要）")
    validation: Optional[PlaceholderValidation] = Field(default=None, description="验证规则")

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        """验证字段类型"""
        valid_types = ['text', 'number', 'date', 'textarea', 'checkbox', 'multiselect']
        if v not in valid_types:
            raise ValueError(f'字段类型必须是以下之一：{", ".join(valid_types)}')
        return v

    @field_validator('options')
    @classmethod
    def validate_options(cls, v: Optional[List[str]], info) -> Optional[List[str]]:
        """验证选项列表（多选框和复选框需要）"""
        field_type = info.data.get('type')
        if field_type == 'multiselect':
            if not v or len(v) == 0:
                raise ValueError('多选框必须提供选项列表')
            if len(v) != len(set(v)):
                raise ValueError('选项列表不能包含重复项')
        elif field_type == 'checkbox':
            if not v or len(v) == 0:
                raise ValueError('复选框必须提供选项列表')
            if len(v) != len(set(v)):
                raise ValueError('选项列表不能包含重复项')
        elif v is not None:
            raise ValueError('只有多选框和复选框类型才需要提供选项列表')
        return v

    @field_validator('label')
    @classmethod
    def validate_label(cls, v: str) -> str:
        """验证标签"""
        if not v or not v.strip():
            raise ValueError('字段标签不能为空')
        return v.strip()


def validate_placeholder_name(name: str) -> str:
    """
    验证占位符名称的合法性
    
    Args:
        name: 占位符名称（不包含 {{ 和 }}）
        
    Returns:
        验证后的占位符名称
        
    Raises:
        ValueError: 如果占位符名称不合法
    """
    if not name or not name.strip():
        raise ValueError('占位符名称不能为空')
    
    name = name.strip()
    
    # 只允许字母、数字、下划线
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
        raise ValueError('占位符名称只能包含字母、数字和下划线，且必须以字母或下划线开头')
    
    return name


def validate_placeholder_metadata(metadata: Dict[str, PlaceholderMetadata]) -> Dict[str, PlaceholderMetadata]:
    """
    验证占位符元数据
    
    Args:
        metadata: 占位符元数据字典
        
    Returns:
        验证后的元数据字典
        
    Raises:
        ValueError: 如果元数据不合法
    """
    if not metadata:
        return metadata
    
    # 验证每个占位符的元数据
    for field_name, meta in metadata.items():
        # 验证占位符名称
        validate_placeholder_name(field_name)
        
        # 验证元数据本身（Pydantic 会自动验证）
        # 这里主要是确保类型一致性
        if meta.type == 'multiselect' and not meta.options:
            raise ValueError(f'占位符 {field_name} 的类型为多选框，但未提供选项列表')
        if meta.type == 'checkbox' and not meta.options:
            raise ValueError(f'占位符 {field_name} 的类型为复选框，但未提供选项列表')
    
    return metadata


# 模板相关 Schema

class DocumentTemplateBase(BaseModel):
    """模板基础模型"""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    content_html: Optional[str] = None
    placeholder_metadata: Optional[Dict[str, PlaceholderMetadata]] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        """验证模板名称"""
        if not v or not v.strip():
            raise ValueError('模板名称不能为空')
        return v.strip()

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """验证分类名称"""
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v

    @field_validator('placeholder_metadata')
    @classmethod
    def validate_placeholder_metadata(cls, v: Optional[Dict[str, PlaceholderMetadata]]) -> Optional[Dict[str, PlaceholderMetadata]]:
        """验证占位符元数据"""
        if v is not None:
            return validate_placeholder_metadata(v)
        return v


class DocumentTemplateCreate(DocumentTemplateBase):
    """模板创建模型"""
    pass


class DocumentTemplateUpdate(BaseModel):
    """模板更新模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    content_html: Optional[str] = None
    placeholder_metadata: Optional[Dict[str, PlaceholderMetadata]] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        """验证模板名称"""
        if v is not None:
            if not v.strip():
                raise ValueError('模板名称不能为空')
            return v.strip()
        return v

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """验证分类名称"""
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v

    @field_validator('placeholder_metadata')
    @classmethod
    def validate_placeholder_metadata(cls, v: Optional[Dict[str, PlaceholderMetadata]]) -> Optional[Dict[str, PlaceholderMetadata]]:
        """验证占位符元数据"""
        if v is not None:
            return validate_placeholder_metadata(v)
        return v


class TemplateStatusUpdate(BaseModel):
    """模板状态更新模型"""
    status: str

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        """验证状态值"""
        valid_statuses = [TemplateStatus.DRAFT, TemplateStatus.PUBLISHED]
        if v not in valid_statuses:
            raise ValueError(f'状态必须是以下之一：{", ".join(valid_statuses)}')
        return v


class DocumentTemplateResponse(BaseSchema):
    """模板响应模型"""
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    status: str
    content_path: Optional[str] = None
    content_html: Optional[str] = None
    placeholder_metadata: Optional[Dict[str, Any]] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# 文档生成相关 Schema

class DocumentGenerationCreate(BaseModel):
    """文档生成创建模型"""
    template_id: int
    form_data: Dict[str, Any]

    @field_validator('template_id')
    @classmethod
    def validate_template_id(cls, v: int) -> int:
        """验证模板ID"""
        if v <= 0:
            raise ValueError('模板ID必须大于0')
        return v

    @field_validator('form_data')
    @classmethod
    def validate_form_data(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """验证表单数据"""
        if not v:
            raise ValueError('表单数据不能为空')
        return v


class DocumentGenerationResponse(BaseSchema):
    """文档生成响应模型"""
    id: int
    template_id: int
    generated_by: int
    form_data: Dict[str, Any]
    document_url: str
    document_filename: str
    generated_at: datetime
    created_at: datetime
    updated_at: datetime


# 列表查询相关 Schema

class TemplateListQuery(BaseModel):
    """模板列表查询参数"""
    skip: int = Field(default=0, ge=0, description="跳过记录数")
    limit: int = Field(default=10, ge=1, le=100, description="每页记录数")
    search: Optional[str] = Field(default=None, description="搜索关键词（模板名称）")
    status: Optional[str] = Field(default=None, description="状态筛选")
    category: Optional[str] = Field(default=None, description="分类筛选")

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """验证状态值"""
        if v is not None:
            valid_statuses = [TemplateStatus.DRAFT, TemplateStatus.PUBLISHED]
            if v not in valid_statuses:
                raise ValueError(f'状态必须是以下之一：{", ".join(valid_statuses)}')
        return v


class GenerationListQuery(BaseModel):
    """生成记录列表查询参数"""
    skip: int = Field(default=0, ge=0, description="跳过记录数")
    limit: int = Field(default=10, ge=1, le=100, description="每页记录数")
    template_id: Optional[int] = Field(default=None, description="模板ID筛选")
    generated_by: Optional[int] = Field(default=None, description="生成人ID筛选")
    start_date: Optional[datetime] = Field(default=None, description="开始时间")
    end_date: Optional[datetime] = Field(default=None, description="结束时间")

    @field_validator('template_id', 'generated_by')
    @classmethod
    def validate_id(cls, v: Optional[int]) -> Optional[int]:
        """验证ID"""
        if v is not None and v <= 0:
            raise ValueError('ID必须大于0')
        return v

