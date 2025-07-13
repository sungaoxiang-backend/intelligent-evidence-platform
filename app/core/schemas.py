from typing import Optional, Union
from pydantic import BaseModel, field_validator

class BaseSchema(BaseModel):
    """基础 Schema，处理通用的数据转换"""
    
    @field_validator('*', mode='before')
    @classmethod
    def empty_str_to_none(cls, v, info):
        """将空字符串转换为None（仅对Optional字段）"""
        # 检查字段是否为Optional类型
        field_info = cls.model_fields.get(info.field_name)
        if field_info and hasattr(field_info.annotation, '__origin__'):
            if field_info.annotation.__origin__ is Union:
                # 如果是Optional字段且值为空字符串，转换为None
                if isinstance(v, str) and v.strip() == '':
                    return None
        return v