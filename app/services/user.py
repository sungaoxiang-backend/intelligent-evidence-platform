from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """根据ID获取用户"""
    return await db.get(User, user_id)


async def get_by_id_card(db: AsyncSession, id_card: str) -> Optional[User]:
    """根据身份证号获取用户"""
    result = await db.execute(select(User).where(User.id_card == id_card))
    return result.scalars().first()


async def get_by_phone(db: AsyncSession, phone: str) -> Optional[User]:
    """根据手机号获取用户"""
    result = await db.execute(select(User).where(User.phone == phone))
    return result.scalars().first()


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """根据邮箱获取用户"""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def create(db: AsyncSession, obj_in: UserCreate) -> User:
    """创建新用户"""
    db_obj = User(
        name=obj_in.name,
        id_card=obj_in.id_card,
        phone=obj_in.phone,
        email=obj_in.email,
        address=obj_in.address,
        is_active=obj_in.is_active,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update(db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
    """更新用户信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def delete(db: AsyncSession, user_id: int) -> bool:
    """删除用户"""
    user = await get_by_id(db, user_id)
    if not user:
        return False
    await db.delete(user)
    await db.commit()
    return True


async def get_multi(db: AsyncSession, *, skip: int = 0, limit: int = 100) -> list[User]:
    """获取多个用户"""
    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()