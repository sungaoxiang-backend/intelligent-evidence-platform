from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import get_password_hash, verify_password
from app.staffs.models import Staff
from app.staffs.schemas import StaffCreate, StaffUpdate


async def get_by_id(db: AsyncSession, staff_id: int) -> Optional[Staff]:
    """根据ID获取员工"""
    return await db.get(Staff, staff_id)


async def get_by_username(db: AsyncSession, username: str) -> Optional[Staff]:
    """根据用户名获取员工"""
    result = await db.execute(select(Staff).where(Staff.username == username))
    return result.scalars().first()


async def authenticate(db: AsyncSession, username: str, password: str) -> Optional[Staff]:
    """验证员工凭据"""
    staff = await get_by_username(db, username)
    if not staff:
        return None
    if not verify_password(password, staff.hashed_password):
        return None
    return staff


async def create(db: AsyncSession, obj_in: StaffCreate) -> Staff:
    """创建新员工"""
    db_obj = Staff(
        username=obj_in.username,
        hashed_password=get_password_hash(obj_in.password),
        is_active=obj_in.is_active,
        is_superuser=obj_in.is_superuser,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update(db: AsyncSession, db_obj: Staff, obj_in: StaffUpdate) -> Staff:
    """更新员工信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 如果更新包含密码，则哈希处理
    if "password" in update_data:
        hashed_password = get_password_hash(update_data["password"])
        del update_data["password"]
        update_data["hashed_password"] = hashed_password
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def delete(db: AsyncSession, staff_id: int) -> bool:
    """删除员工"""
    staff = await get_by_id(db, staff_id)
    if not staff:
        return False
    await db.delete(staff)
    await db.commit()
    return True


async def get_multi_with_count(db: AsyncSession, *, skip: int = 0, limit: int = 100) -> Tuple[list[Staff], int]:
    """获取多个员工及总数"""
    # 获取总数
    count_result = await db.execute(select(func.count()).select_from(Staff))
    total = count_result.scalar_one()

    # 获取分页数据
    result = await db.execute(select(Staff).offset(skip).limit(limit))
    items = result.scalars().all()
    
    return items, total