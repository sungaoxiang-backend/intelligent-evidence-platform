from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.cases.models import Case
from app.cases.schemas import CaseCreate, CaseUpdate


async def get_by_id(db: AsyncSession, case_id: int) -> Optional[Case]:
    """根据ID获取案件"""
    return await db.get(Case, case_id)


async def get_by_id_with_user(db: AsyncSession, case_id: int) -> Optional[Case]:
    """根据ID获取案件，包含用户信息"""
    result = await db.execute(
        select(Case).where(Case.id == case_id).options(joinedload(Case.user))
    )
    return result.scalars().first()


async def get_by_case_number(db: AsyncSession, case_number: str) -> Optional[Case]:
    """根据案件编号获取案件"""
    result = await db.execute(select(Case).where(Case.case_number == case_number))
    return result.scalars().first()


async def create(db: AsyncSession, obj_in: CaseCreate) -> Case:
    """创建新案件"""
    db_obj = Case(
        title=obj_in.title,
        description=obj_in.description,
        case_number=obj_in.case_number,
        case_type=obj_in.case_type,
        creaditor_name=obj_in.creaditor_name,
        creditor_type=obj_in.creditor_type,
        debtor_name=obj_in.debtor_name,
        debtor_type=obj_in.debtor_type,
        user_id=obj_in.user_id,
        assigned_staff_id=obj_in.assigned_staff_id,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update(db: AsyncSession, db_obj: Case, obj_in: CaseUpdate) -> Case:
    """更新案件信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def delete(db: AsyncSession, case_id: int) -> bool:
    """删除案件"""
    case = await get_by_id(db, case_id)
    if not case:
        return False
    await db.delete(case)
    await db.commit()
    return True


async def get_multi(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, user_id: Optional[int] = None
) -> list[Case]:
    """获取多个案件"""
    query = select(Case)
    if user_id is not None:
        query = query.where(Case.user_id == user_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_multi_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, user_id: Optional[int] = None
) -> Tuple[list[Case], int]:
    """获取多个案件和总数"""
    query = select(Case)
    if user_id is not None:
        query = query.where(Case.user_id == user_id)

    # 查询总数
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    # 查询数据
    items_query = query.offset(skip).limit(limit)
    items_result = await db.execute(items_query)
    items = items_result.scalars().all()

    return items, total


async def get_multi_with_users(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> list[Case]:
    """获取多个案件，包含用户信息"""
    query = select(Case).options(joinedload(Case.user)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_multi_with_users_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> Tuple[list[Case], int]:
    """获取多个案件（包含用户信息）和总数"""
    # 查询总数
    total_query = select(func.count()).select_from(Case)
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    # 查询数据
    items_query = select(Case).options(joinedload(Case.user)).offset(skip).limit(limit)
    items_result = await db.execute(items_query)
    items = items_result.scalars().all()

    return items, total
