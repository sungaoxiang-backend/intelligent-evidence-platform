from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import DBSession, get_current_active_superuser, get_current_staff
from app.models.staff import Staff
from app.schemas.staff import StaffCreate, StaffUpdate, Staff as StaffSchema
from app.services import staff as staff_service

router = APIRouter()


@router.get("/staff/me", response_model=StaffSchema)
async def read_staff_me(current_staff: Annotated[Staff, Depends(get_current_staff)]):
    """获取当前登录员工信息"""
    return current_staff


@router.put("/staff/me", response_model=StaffSchema)
async def update_staff_me(
    db: DBSession,
    staff_in: StaffUpdate,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新当前登录员工信息"""
    return await staff_service.update(db, current_staff, staff_in)


@router.get("/staff", response_model=List[StaffSchema])
async def read_staff_list(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_active_superuser)],
    skip: int = 0,
    limit: int = 100,
):
    """获取员工列表（仅超级管理员）"""
    staff_list = await staff_service.get_multi(db, skip=skip, limit=limit)
    return staff_list


@router.post("/staff", response_model=StaffSchema, status_code=status.HTTP_201_CREATED)
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
    
    # 检查邮箱是否已存在
    staff = await staff_service.get_by_email(db, email=staff_in.email)
    if staff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已存在",
        )
    
    return await staff_service.create(db, staff_in)


@router.get("/staff/{staff_id}", response_model=StaffSchema)
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
    return staff


@router.put("/staff/{staff_id}", response_model=StaffSchema)
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
    return await staff_service.update(db, staff, staff_in)


@router.delete("/staff/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    
    success = await staff_service.delete(db, staff_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="员工不存在",
        )