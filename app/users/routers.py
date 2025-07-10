from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import DBSession, get_current_staff
from app.core.response import SingleResponse, ListResponse, Pagination
from app.staffs.models import Staff
from app.users.schemas import User as UserSchema, UserCreate, UserUpdate
from app.users import services as user_service

router = APIRouter()


@router.get("/", response_model=ListResponse[UserSchema])
async def read_users(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 10,
):
    """获取用户列表"""
    users, total = await user_service.get_multi_with_count(db, skip=skip, limit=limit)
    return ListResponse(
        data=users,
        pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit)
    )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=SingleResponse[UserSchema])
async def create_user(
    db: DBSession,
    user_in: UserCreate,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """创建新用户"""
    # 检查身份证号是否已存在
    if user_in.id_card:
        user = await user_service.get_by_id_card(db, id_card=user_in.id_card)
        if user:
            raise HTTPException(status_code=400, detail="身份证号已存在")

    # 检查手机号是否已存在
    if user_in.phone:
        user = await user_service.get_by_phone(db, phone=user_in.phone)
        if user:
            raise HTTPException(status_code=400, detail="手机号已存在")

    new_user = await user_service.create(db, user_in)
    return SingleResponse(data=new_user)


@router.get("/{user_id}", response_model=SingleResponse[UserSchema])
async def read_user(
    user_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取用户信息"""
    user = await user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return SingleResponse(data=user)


@router.put("/{user_id}", response_model=SingleResponse[UserSchema])
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新用户信息"""
    user = await user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查身份证号是否已存在
    if user_in.id_card and user_in.id_card != user.id_card:
        existing_user = await user_service.get_by_id_card(db, id_card=user_in.id_card)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=400, detail="身份证号已存在")

    # 检查手机号是否已存在
    if user_in.phone and user_in.phone != user.phone:
        existing_user = await user_service.get_by_phone(db, phone=user_in.phone)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=400, detail="手机号已存在")

    updated_user = await user_service.update(db, user, user_in)
    return SingleResponse(data=updated_user)


@router.delete("/{user_id}", response_model=SingleResponse)
async def delete_user(
    user_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除用户"""
    success_deleted = await user_service.delete(db, user_id)
    if not success_deleted:
        raise HTTPException(status_code=404, detail="用户不存在")
    return SingleResponse(data=None)