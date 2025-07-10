from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.users.schemas import UserCreate, UserUpdate, User as UserSchema
from app.users import services as user_service

router = APIRouter()


@router.get("/", response_model=List[UserSchema])
async def read_users(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
):
    """获取用户列表"""
    users = await user_service.get_multi(db, skip=skip, limit=limit)
    return users


@router.post("/", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="身份证号已存在",
            )
    
    # 检查手机号是否已存在
    if user_in.phone:
        user = await user_service.get_by_phone(db, phone=user_in.phone)
        if user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手机号已存在",
            )
    
    return await user_service.create(db, user_in)


@router.get("/{user_id}", response_model=UserSchema)
async def read_user(
    user_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取用户信息"""
    user = await user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    return user


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新用户信息"""
    user = await user_service.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    # 检查身份证号是否已存在
    if user_in.id_card and user_in.id_card != user.id_card:
        existing_user = await user_service.get_by_id_card(db, id_card=user_in.id_card)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="身份证号已存在",
            )
    
    # 检查手机号是否已存在
    if user_in.phone and user_in.phone != user.phone:
        existing_user = await user_service.get_by_phone(db, phone=user_in.phone)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="手机号已存在",
            )
    
    return await user_service.update(db, user, user_in)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除用户"""
    success = await user_service.delete(db, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )