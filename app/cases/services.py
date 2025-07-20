from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.cases.models import Case as CaseModel
from app.cases.schemas import CaseCreate, CaseUpdate, Case as CaseSchema

from app.users.services import get_by_id_card, get_by_phone, create as create_user
from app.users.schemas import UserCreate
from app.cases.schemas import CaseRegistrationRequest, CaseRegistrationResponse
from app.users.schemas import User as UserSchema


async def get_by_id(db: AsyncSession, case_id: int) -> Optional[CaseModel]:
    """根据ID获取案件"""
    return await db.get(CaseModel, case_id)


async def create(db: AsyncSession, obj_in: CaseCreate) -> CaseModel:
    """创建新案件"""
    db_obj = CaseModel(
        description=obj_in.description,
        case_type=obj_in.case_type,
        creditor_name=obj_in.creditor_name,
        creditor_type=obj_in.creditor_type,
        debtor_name=obj_in.debtor_name,
        debtor_type=obj_in.debtor_type,
        user_id=obj_in.user_id,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update(db: AsyncSession, db_obj: CaseModel, obj_in: CaseUpdate) -> CaseModel:
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


async def get_multi_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, user_id: Optional[int] = None
) -> Tuple[list[CaseModel], int]:
    """获取多个案件和总数"""
    query = select(CaseModel)
    if user_id is not None:
        query = query.where(CaseModel.user_id == user_id)

    # 查询总数
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    # 查询数据
    items_query = query.offset(skip).limit(limit)
    items_result = await db.execute(items_query)
    items = items_result.scalars().all()

    return items, total


async def register_case_with_user(db: AsyncSession, obj_in: CaseRegistrationRequest) -> CaseRegistrationResponse:
    """综合录入案件和用户"""
    # 1. 检查用户是否已存在（通过身份证号或手机号）
    is_new_user = False
    existing_user = None
    if obj_in.user_id_card:
        existing_user = await get_by_id_card(db, obj_in.user_id_card)
    if obj_in.user_phone:
        existing_user = await get_by_phone(db, obj_in.user_phone)
    
    # 2. 如果用户不存在，创建新用户
    if not existing_user:
        user_in = UserCreate(
            name=obj_in.user_name,
            id_card=obj_in.user_id_card,
            phone=obj_in.user_phone
        )
        user = await create_user(db, user_in)
        is_new_user = True
    else:
        user = existing_user
    
    # 3. 自动生成title: "债权人 VS 债务人 的 案件类型"
    title = f"{obj_in.creditor_name} vs {obj_in.debtor_name}"
    
    # 4. 创建案件
    case_in = CaseCreate(
        user_id=user.id,
        title=title,  # 使用自动生成的title
        description=obj_in.description,
        case_type=obj_in.case_type,
        creditor_name=obj_in.creditor_name,
        creditor_type=obj_in.creditor_type,
        debtor_name=obj_in.debtor_name,
        debtor_type=obj_in.debtor_type
    )
    case = await create(db, case_in)
    
    # 5. 构建响应
    return CaseRegistrationResponse(
        user=UserSchema.model_validate(user),
        case=CaseSchema.model_validate(case),
        is_new_user=is_new_user
    )
