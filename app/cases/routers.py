from typing import Annotated, Optional
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Case

from app.core.deps import DBSession, get_current_staff
from app.core.response import SingleResponse, ListResponse, Pagination
from app.staffs.models import Staff
from app.cases.schemas import Case as CaseSchema, CaseCreate, CaseUpdate
from app.cases import services as case_service
from app.users import services as user_service
from app.cases.schemas import CaseRegistrationRequest, CaseRegistrationResponse
from app.cases.services import register_case_with_user

router = APIRouter()


@router.get("/", response_model=ListResponse[CaseSchema])
async def read_cases(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 10,
    user_id: Optional[int] = None
):
    """获取案件列表"""
    time.sleep(2)
    # 构建查询条件
    filters = {}
    if user_id is not None:
        filters["user_id"] = user_id

    # 获取案件列表
    cases, total = await case_service.get_multi_with_count(db, skip=skip, limit=limit, **filters)

    return ListResponse(
        data=cases,
        pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit)
    )


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=SingleResponse[CaseSchema])
async def create_case(
    db: DBSession,
    case_in: CaseCreate,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """创建新案件"""
    # 检查用户是否存在
    user = await user_service.get_by_id(db, case_in.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 创建案件
    new_case = await case_service.create(db, case_in)
    return SingleResponse(data=new_case)


@router.get("/{case_id}", response_model=SingleResponse[CaseSchema])
async def read_case(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取案件信息"""
    case = await case_service.get_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")
    return SingleResponse(data=case)


@router.put("/{case_id}", response_model=SingleResponse[CaseSchema])
async def update_case(
    case_id: int,
    case_in: CaseUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新案件信息"""
    case = await case_service.get_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="案件不存在")

    updated_case = await case_service.update(db, case, case_in)
    return SingleResponse(data=updated_case)


@router.delete("/{case_id}", response_model=SingleResponse[CaseSchema])
async def delete_case(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除案件"""
    success_deleted = await case_service.delete(db, case_id)
    if not success_deleted:
        raise HTTPException(status_code=404, detail="案件不存在")
    return SingleResponse()


@router.post("/registration", response_model=SingleResponse[CaseRegistrationResponse])
async def register_case(
    request: CaseRegistrationRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """综合录入案件和用户"""

    result = await register_case_with_user(db, request)
    return SingleResponse(data=result)