from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.cases.schemas import Case as CaseSchema, CaseCreate, CaseUpdate, CaseWithUser
from app.cases import services as case_service
from app.users import services as user_service

router = APIRouter()


@router.get("/", response_model=List[CaseSchema])
async def read_cases(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
    user_id: Optional[int] = None,
    assigned_staff_id: Optional[int] = None,
):
    """获取案件列表"""
    # 构建查询条件
    filters = {}
    if user_id is not None:
        filters["user_id"] = user_id
    
    # 获取案件列表
    cases = await case_service.get_multi(db, skip=skip, limit=limit, **filters)
    
    # 过滤分配给特定员工的案件
    if assigned_staff_id is not None:
        cases = [case for case in cases if case.assigned_staff_id == assigned_staff_id]
    
    return cases


@router.get("/with-users", response_model=List[CaseWithUser])
async def read_cases_with_users(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
):
    """获取案件列表，包含用户信息"""
    return await case_service.get_multi_with_users(db, skip=skip, limit=limit)


@router.post("/", response_model=CaseSchema, status_code=status.HTTP_201_CREATED)
async def create_case(
    db: DBSession,
    case_in: CaseCreate,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """创建新案件"""
    # 检查用户是否存在
    user = await user_service.get_by_id(db, case_in.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    # 检查案件编号是否已存在
    existing_case = await case_service.get_by_case_number(db, case_in.case_number)
    if existing_case:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="案件编号已存在",
        )
    
    # 验证债权人和债务人信息
    if not case_in.creaditor_name or not case_in.debtor_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="债权人和债务人信息不能为空",
        )
    
    # 创建案件
    return await case_service.create(db, case_in)


@router.get("/{case_id}", response_model=CaseSchema)
async def read_case(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取案件信息"""
    case = await case_service.get_by_id(db, case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    return case


@router.get("/{case_id}/with-user", response_model=CaseWithUser)
async def read_case_with_user(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取案件信息，包含用户信息"""
    case = await case_service.get_by_id_with_user(db, case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    return case


@router.put("/{case_id}", response_model=CaseSchema)
async def update_case(
    case_id: int,
    case_in: CaseUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新案件信息"""
    case = await case_service.get_by_id(db, case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    
    # 检查案件编号是否已存在
    if case_in.case_number and case_in.case_number != case.case_number:
        existing_case = await case_service.get_by_case_number(db, case_in.case_number)
        if existing_case and existing_case.id != case_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="案件编号已存在",
            )
    
    return await case_service.update(db, case, case_in)


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除案件"""
    success = await case_service.delete(db, case_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
