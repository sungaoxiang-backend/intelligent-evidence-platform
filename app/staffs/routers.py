from typing import Annotated, List
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import DBSession, get_current_active_superuser, get_current_staff
from app.staffs.models import Staff
from app.staffs.schemas import Staff as StaffSchema, StaffCreate, StaffUpdate, Token
from app.core.config import settings
from app.core.security import create_access_token
from app.staffs import services as staff_service
from app.core.response import SingleResponse, ListResponse, Pagination

router = APIRouter()
login_router = APIRouter()


@login_router.post("/access-token", response_model=SingleResponse[Token])
async def login_access_token(db: DBSession, form_data: OAuth2PasswordRequestForm = Depends()):
    """获取OAuth2兼容的令牌（员工登录）"""
    staff = await staff_service.authenticate(db, form_data.username, form_data.password)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不正确",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="用户未激活"
        )
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return SingleResponse(data={
        "access_token": create_access_token(
            staff.id, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    })


@router.get("/me", response_model=SingleResponse[StaffSchema])
async def read_staff_me(current_staff: Annotated[Staff, Depends(get_current_staff)]):
    """获取当前登录员工信息"""
    return SingleResponse(data=current_staff)


@router.put("/me", response_model=SingleResponse[StaffSchema])
async def update_staff_me(
    db: DBSession,
    staff_in: StaffUpdate,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """更新当前登录员工信息"""
    current_staff = await staff_service.update(db, current_staff, staff_in)
    return SingleResponse(data=current_staff)


@router.get("", response_model=ListResponse[StaffSchema])
async def read_staff_list(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_active_superuser)],
    skip: int = 0,
    limit: int = 100,
):
    """获取员工列表（仅超级管理员）"""
    staff_list, total = await staff_service.get_multi_with_count(db, skip=skip, limit=limit)
    return ListResponse(
        data=staff_list,
        pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit)
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SingleResponse[StaffSchema])
async def create_staff(
    db: DBSession,
    staff_in: StaffCreate,
    current_staff: Annotated[Staff, Depends(get_current_active_superuser)],
):
    """创建新员工（仅超级管理员）"""
    # 检查用户名是否已存在
    staff = await staff_service.get_by_username(db, username=staff_in.username)
    if staff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在",
        )
    
    new_staff = await staff_service.create(db, staff_in)
    return SingleResponse(data=new_staff)


@router.get("/{staff_id}", response_model=SingleResponse[StaffSchema])
async def read_staff(
    staff_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取员工信息"""
    # 普通员工只能查看自己的信息
    if not current_staff.is_superuser and current_staff.id != staff_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有足够的权限",
        )
    
    staff = await staff_service.get_by_id(db, staff_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="员工不存在",
        )
    return SingleResponse(data=staff)


@router.put("/{staff_id}", response_model=SingleResponse[StaffSchema])
async def update_staff(
    staff_id: int,
    staff_in: StaffUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_active_superuser)],
):
    """更新员工信息（仅超级管理员）"""
    staff = await staff_service.get_by_id(db, staff_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="员工不存在",
        )
    updated_staff = await staff_service.update(db, staff, staff_in)
    return SingleResponse(data=updated_staff)


@router.delete("/{staff_id}", response_model=SingleResponse)
async def delete_staff(
    staff_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_active_superuser)],
):
    """删除员工（仅超级管理员）"""
    # 不能删除自己
    if current_staff.id == staff_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己",
        )
    
    success_deleted = await staff_service.delete(db, staff_id)
    if not success_deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="员工不存在",
        )
    return SingleResponse(data=None)