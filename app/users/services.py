from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.users.models import User
from app.users.schemas import UserCreate, UserUpdate


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


async def get_by_wechat_number(db: AsyncSession, wechat_number: str) -> Optional[User]:
    """根据微信号获取用户"""
    result = await db.execute(select(User).where(User.wechat_number == wechat_number))
    return result.scalars().first()


async def create(db: AsyncSession, obj_in: UserCreate) -> User:
    """创建新用户"""
    # 使用model_dump获取所有字段，确保包含微信字段
    create_data = obj_in.model_dump(exclude_unset=True)
    
    # 动态创建User对象，包含所有提供的字段
    db_obj = User(**create_data)
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
    return list(result.scalars().all())


async def get_multi_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100,
    sort_by: Optional[str] = None, sort_order: Optional[str] = "desc",
    user_id: Optional[int] = None
) -> Tuple[list[User], int]:
    """获取多个用户和总数，支持动态排序"""
    from loguru import logger
    
    # 添加调试日志
    logger.debug(f"User sorting parameters: sort_by={sort_by}, sort_order={sort_order}, user_id={user_id}")
    
    # 查询总数
    count_query = select(func.count()).select_from(User)
    if user_id is not None:
        logger.debug(f"Filtering by user_id: {user_id}")
        count_query = count_query.where(User.id == user_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 构建查询，使用selectinload预加载cases关系
    query = select(User).options(selectinload(User.cases))
    
    # 添加user_id筛选
    if user_id is not None:
        query = query.where(User.id == user_id)
    
    # 添加排序
    if sort_by:
        # 验证排序字段
        valid_sort_fields = {
            'created_at': User.created_at,
            'updated_at': User.updated_at,
            'name': User.name,
            'phone': User.phone,
            'id_card': User.id_card
        }
        
        if sort_by in valid_sort_fields:
            sort_column = valid_sort_fields[sort_by]
            if sort_order and sort_order.lower() == 'desc':
                logger.debug(f"Applying DESC sort on {sort_by}")
                query = query.order_by(sort_column.desc())
            else:
                logger.debug(f"Applying ASC sort on {sort_by}")
                query = query.order_by(sort_column.asc())
        else:
            # 默认按创建时间倒序
            logger.debug("Invalid sort field, using default DESC sort on created_at")
            query = query.order_by(User.created_at.desc())
    else:
        # 默认按创建时间倒序
        logger.debug("No sort field provided, using default DESC sort on created_at")
        query = query.order_by(User.created_at.desc())

    # 获取数据
    query = query.offset(skip).limit(limit)
    items_result = await db.execute(query)
    items = list(items_result.scalars().all())

    return items, total


async def update_or_create_by_wechat_number(
    db: AsyncSession, 
    wechat_number: str, 
    user_data: UserCreate
) -> Tuple[User, bool]:
    """根据微信号更新或创建用户，返回 (用户对象, 是否新创建)"""
    # 首先尝试查找现有用户
    existing_user = await get_by_wechat_number(db, wechat_number)
    
    if existing_user:
        # 更新现有用户
        updated_user = await update(db, existing_user, UserUpdate(**user_data.model_dump()))
        return updated_user, False
    else:
        # 创建新用户
        new_user = await create(db, user_data)
        return new_user, True