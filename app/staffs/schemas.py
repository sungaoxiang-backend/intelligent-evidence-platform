from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# 共享属性
class StaffBase(BaseModel):
    """员工基础模型"""
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False


# 创建时需要的属性
class StaffCreate(StaffBase):
    """员工创建模型"""
    username: str
    email: EmailStr
    password: str = Field(..., min_length=8)


# 更新时可以修改的属性
class StaffUpdate(StaffBase):
    """员工更新模型"""
    password: Optional[str] = Field(None, min_length=8)


# API响应中的员工模型
class Staff(StaffBase):
    """员工响应模型"""
    id: int

    class Config:
        from_attributes = True


# 登录请求模型
class StaffLogin(BaseModel):
    """员工登录模型"""
    username: str
    password: str


# Token模型
class Token(BaseModel):
    """JWT Token模型"""
    access_token: str
    token_type: str


# Token中的数据模型
class TokenPayload(BaseModel):
    """JWT Token Payload模型"""
    sub: Optional[int] = None