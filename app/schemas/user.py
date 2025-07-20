from typing import Optional

from pydantic import BaseModel, EmailStr


# 共享属性
class UserBase(BaseModel):
    """用户基础模型"""
    name: Optional[str] = None
    id_card: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    is_active: Optional[bool] = True


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