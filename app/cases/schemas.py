from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.cases.models import CaseType, PartyType


# 共享属性
class CaseBase(BaseModel):
    """案件基础模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    case_number: Optional[str] = None
    case_type: Optional[CaseType] = None
    creaditor_name: Optional[str] = None
    creditor_type: Optional[PartyType] = None
    debtor_name: Optional[str] = None
    debtor_type: Optional[PartyType] = None
    assigned_staff_id: Optional[int] = None


# 创建时需要的属性
class CaseCreate(CaseBase):
    """案件创建模型"""
    title: str
    case_number: str
    creaditor_name: str
    debtor_name: str
    case_type: CaseType
    user_id: int


# 更新时可以修改的属性
class CaseUpdate(BaseModel):
    """案件更新模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    case_number: Optional[str] = None  # 添加这一行
    case_type: Optional[CaseType] = None
    creaditor_name: Optional[str] = None
    creditor_type: Optional[PartyType] = None
    debtor_name: Optional[str] = None
    debtor_type: Optional[PartyType] = None
    assigned_staff_id: Optional[int] = None
    # 注意：不包括 case_number 和 user_id，这些通常不应该在更新时修改


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
from app.users.schemas import User

class CaseWithUser(Case):
    """包含用户信息的案件响应模型"""
    user: User