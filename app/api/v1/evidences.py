from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.core.deps import DBSession, get_current_staff
from app.models.staff import Staff
from app.schemas.evidence import (
    Evidence as EvidenceSchema,
    EvidenceCreate,
    EvidenceUpdate,
    EvidenceWithCase,
    FileUploadResponse,
)
from app.services import case as case_service
from app.services import evidence as evidence_service

router = APIRouter()


@router.get("/evidences", response_model=List[EvidenceSchema])
async def read_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
    case_id: Optional[int] = None,
):
    """获取证据列表"""
    evidences = await evidence_service.get_multi(
        db, skip=skip, limit=limit, case_id=case_id
    )
    return evidences


@router.get("/evidences/with-cases", response_model=List[EvidenceWithCase])
async def read_evidences_with_cases(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
):
    """获取证据列表，包含案件信息"""
    return await evidence_service.get_multi_with_cases(db, skip=skip, limit=limit)


@router.post("/evidences/upload-file", response_model=FileUploadResponse)
async def upload_file(
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    file: UploadFile = File(...),
):
    """上传文件"""
    return await evidence_service.upload_file(
        file.file, file.filename, current_staff.id
    )


@router.post("/evidences", response_model=EvidenceSchema, status_code=status.HTTP_201_CREATED)
async def create_evidence(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    evidence_in: EvidenceCreate,
    file: UploadFile = File(...),
):
    """创建新证据"""
    # 检查案件是否存在
    case = await case_service.get_by_id(db, evidence_in.case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    
    # 上传文件
    file_data = await evidence_service.upload_file(
        file.file, file.filename, current_staff.id
    )
    
    # 创建证据
    return await evidence_service.create(
        db, evidence_in, file_data, current_staff.id
    )


@router.get("/evidences/{evidence_id}", response_model=EvidenceSchema)
async def read_evidence(
    evidence_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取证据信息"""
    evidence = await evidence_service.get_by_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )
    return evidence


@router.get("/evidences/{evidence_id}/with-case", response_model=EvidenceWithCase)
async def read_evidence_with_case(
    evidence_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取证据信息，包含案件信息"""
    evidence = await evidence_service.get_by_id_with_case(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )
    return evidence


@router.put("/evidences/{evidence_id}", response_model=EvidenceSchema)
async def update_evidence(
    evidence_id: int,
    evidence_in: EvidenceUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新证据信息"""
    evidence = await evidence_service.get_by_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )
    return await evidence_service.update(db, evidence, evidence_in)


@router.delete("/evidences/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除证据"""
    success = await evidence_service.delete(db, evidence_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="证据不存在",
        )