import asyncio
import mimetypes
import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from loguru import logger

from app.core.config import settings
from app.core.deps import DBSession, get_current_staff
from app.core.response import SingleResponse, ListResponse, Pagination
from app.staffs.models import Staff
from app.evidences.schemas import (
    EvidenceResponse,
    BatchDeleteRequest,
    EvidenceEditRequest
)
from app.cases import services as case_service
from app.evidences import services as evidence_service

router = APIRouter()


@router.get("/", response_model=ListResponse[EvidenceResponse])
async def read_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
    case_id: Optional[int] = None,
    search: Optional[str] = None,
):
    """获取证据列表"""
    evidences, total = await evidence_service.get_multi_with_count(
        db, skip=skip, limit=limit, case_id=case_id, search=search
    )
    return ListResponse(
        data=evidences,
        pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit)
    )


@router.get("/{evidence_id}", response_model=SingleResponse[EvidenceResponse])
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
    return SingleResponse(data=evidence)


@router.post("/batch", status_code=status.HTTP_201_CREATED, response_model=ListResponse[EvidenceResponse])
async def batch_create_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Form(...),
    files: List[UploadFile] = File(...),
):
    """批量创建证据

    允许一次上传多个文件并创建多个证据
    """
    from loguru import logger

    logger.info(f"接收批量创建证据请求: 案件ID={case_id}, 文件数量={len(files) if files else 0}")

    if not files:
        logger.warning("未提供文件")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供文件",
        )

    # 记录文件信息
    for i, file in enumerate(files):
        logger.debug(
            f"文件{i+1}: 名称={file.filename}, 内容类型={file.content_type}, 大小={file.size if hasattr(file, 'size') else '未知'}"
        )

    # 检查案件是否存在
    case = await case_service.get_by_id(db, case_id)
    if not case:
        logger.warning(f"案件不存在: ID={case_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    logger.debug(f"案件存在: ID={case_id}, 名称={case.title}")

    try:
        # 批量创建证据
        logger.info(f"开始批量创建证据: 案件ID={case_id}, 文件数量={len(files)}")
        evidences = await evidence_service.batch_create(
            db, case_id, files
        )

        if not evidences:
            # 收集文件信息用于调试
            files_info = []
            for file in files:
                try:
                    file_info = {
                        "filename": file.filename,
                        "content_type": file.content_type,
                        "size": file.size if hasattr(file, "size") else None,
                    }
                    # 尝试读取文件的前10个字节来检查是否可读
                    file.file.seek(0)
                    first_bytes = file.file.read(10)
                    file.file.seek(0)  # 重置文件指针
                    file_info["readable"] = len(first_bytes) > 0
                    file_info["first_bytes_hex"] = first_bytes.hex() if first_bytes else None
                except Exception as read_err:
                    file_info["readable"] = False
                    file_info["read_error"] = str(read_err)
                files_info.append(file_info)

            error_detail = {
                "message": "所有文件上传失败",
                "error_type": "upload_failed",
                "files_count": len(files),
                "files_info": files_info,
            }

            logger.error(f"所有文件上传失败: {error_detail}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail,
            )

        logger.info(f"批量创建证据成功: 成功数量={len(evidences)}")
        return ListResponse(data=evidences)
    except Exception as e:
        logger.error(f"批量创建证据异常: {str(e)}")
        import traceback

        logger.error(f"错误详情: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "message": f"批量创建证据失败: {str(e)}",
                "error_type": "internal_error",
                "files_count": len(files),
                "files_info": [
                    {
                        "filename": file.filename,
                        "content_type": file.content_type,
                        "size": file.size if hasattr(file, "size") else None,
                    }
                    for file in files
                ],
            },
        )


@router.put("/{evidence_id}", response_model=SingleResponse[EvidenceResponse])
async def update_evidence(
    evidence_id: int,
    evidence_in: EvidenceEditRequest,
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
    evidence = await evidence_service.update(db, evidence, evidence_in)
    return SingleResponse(data=evidence)


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    return


@router.post("/batch-delete", response_model=SingleResponse)
async def batch_delete_evidences(
    request: BatchDeleteRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """批量删除证据"""
    data = await evidence_service.batch_delete(db, request.evidence_ids)
    return SingleResponse(data=data)


@router.post("/batch-with-classification", status_code=status.HTTP_201_CREATED, response_model=ListResponse[EvidenceResponse])
async def batch_create_evidences_with_classification(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Form(...),
    files: List[UploadFile] = File(...),
):
    """批量创建证据并进行AI分类

    允许一次上传多个文件、创建多个证据并自动进行AI分类
    """
    from loguru import logger

    logger.info(f"接收批量创建证据+分类请求: 案件ID={case_id}, 文件数量={len(files) if files else 0}")

    if not files:
        logger.warning("未提供文件")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供文件",
        )

    # 检查案件是否存在
    case = await case_service.get_by_id(db, case_id)
    if not case:
        logger.warning(f"案件不存在: ID={case_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )

    try:
        # 批量创建证据并分类
        logger.info(f"开始批量创建证据+分类: 案件ID={case_id}, 文件数量={len(files)}")
        evidences = await evidence_service.batch_create_with_classification(
            db, case_id, files
        )

        if not evidences:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="所有文件上传失败",
            )

        logger.info(f"批量创建证据+分类成功: 成功数量={len(evidences)}")
        return ListResponse(data=evidences)
    except Exception as e:
        logger.error(f"批量创建证据+分类异常: {str(e)}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量创建证据+分类失败: {str(e)}",
        )
        
from app.evidences.schemas import AutoProcessRequest, EvidenceEditRequest, EvidenceResponse

@router.post("/auto-process", response_model=ListResponse[EvidenceResponse])
async def auto_process(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Form(...),
    files: List[UploadFile] = File(None),
    evidence_ids: List[int] = Form(None),
    auto_classification: bool = Form(False),
    auto_feature_extraction: bool = Form(False),
    ):
    from app.evidences.services import auto_process
    from loguru import logger
    # evidence_ids 可能是字符串列表，需转为 int
    if evidence_ids is not None:
        evidence_ids = [int(eid) for eid in evidence_ids]
    logger.info(f"收到 evidence_ids: {evidence_ids}")
    # 简单验证：必须提供其一且不能同时提供
    has_files = files is not None and len(files) > 0
    has_evidence_ids = evidence_ids is not None and len(evidence_ids) > 0
    if not has_files and not has_evidence_ids:
        raise HTTPException(status_code=400, detail="必须提供 files 或 evidence_ids")
    if has_files and has_evidence_ids:
        raise HTTPException(status_code=400, detail="files 和 evidence_ids 不能同时提供")
    # 检查案件是否存在
    case = await case_service.get_by_id(db, case_id)
    if not case:
        logger.warning(f"案件不存在: ID={case_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )
    # 校验：不能只做特征提取，必须先分类
    if auto_feature_extraction and not auto_classification:
        raise HTTPException(status_code=400, detail="不能只做特征提取，必须先分类")
    evidences = await auto_process(db, case_id=case_id, files=files, evidence_ids=evidence_ids, auto_classification=auto_classification, auto_feature_extraction=auto_feature_extraction)
    return ListResponse(data=evidences)