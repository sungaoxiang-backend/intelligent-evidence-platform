from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.case import CaseStatus, CaseType


# 共享属性
class CaseBase(BaseModel):
    """案件基础模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    case_number: Optional[str] = None
    status: Optional[CaseStatus] = None
    case_type: Optional[CaseType] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    assigned_staff_id: Optional[int] = None


# 创建时需要的属性
class CaseCreate(CaseBase):
    """案件创建模型"""
    title: str
    case_number: str
    user_id: int


# 更新时可以修改的属性
class CaseUpdate(CaseBase):
    """案件更新模型"""
    pass


# API响应中的案件模型
class Case(CaseBase):
    """案件响应模型"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 包含用户信息的案件模型
from app.schemas.user import User

class CaseWithUser(Case):
    """包含用户信息的案件响应模型"""
    user: User