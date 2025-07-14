from typing import Optional
import re
from pydantic import BaseModel, field_validator, ValidationError

# 共享属性
from app.core.schemas import BaseSchema

class UserBase(BaseSchema):
    """用户基础模型"""
    name: Optional[str] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    
    @field_validator('id_card')
    @classmethod
    def validate_id_card(cls, v):
        if v is None or v == "":
            return v
        
        # 去除空格
        v = v.strip()
        
        # 检查长度（15位或18位）
        if len(v) not in [15, 18]:
            raise ValueError('身份证号码必须是15位或18位')
        
        # 检查是否全为数字（18位身份证最后一位可能是X）
        if len(v) == 18:
            if not (v[:17].isdigit() and (v[17].isdigit() or v[17].upper() == 'X')):
                raise ValueError('身份证号码格式不正确')
        elif len(v) == 15:
            if not v.isdigit():
                raise ValueError('身份证号码格式不正确')
        
        return v.upper()  # 统一转换为大写
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if v is None or v == "":
            return v
        
        # 去除空格和特殊字符
        v = re.sub(r'[\s\-\(\)]', '', v)
        
        # 检查手机号格式（11位数字，以1开头）
        if not re.match(r'^1[3-9]\d{9}$', v):
            raise ValueError('手机号码格式不正确')
        
        return v


# 创建时需要的属性
class UserCreate(UserBase):
    """用户创建模型"""
    name: str


# 更新时可以修改的属性
class UserUpdate(UserBase):
    """用户更新模型"""
    pass


# API响应中的用户模型
class User(UserBase):
    """用户响应模型"""
    id: int

    class Config:
        from_attributes = True