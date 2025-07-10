import asyncio
import mimetypes
import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from loguru import logger

from app.core.config import settings
from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.evidences.schemas import (
    BatchDeleteRequest,
    Evidence as EvidenceSchema,
    EvidenceCreate,
    EvidenceUpdate,
    EvidenceWithCase,
)
from app.cases import services as case_service
from app.evidences import services as evidence_service

router = APIRouter()

@router.get("/", response_model=List[EvidenceSchema])
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


@router.get("/with-cases", response_model=List[EvidenceWithCase])
async def read_evidences_with_cases(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
):
    """获取证据列表，包含案件信息"""
    return await evidence_service.get_multi_with_cases(db, skip=skip, limit=limit)


@router.get("/{evidence_id}", response_model=EvidenceSchema)
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


@router.get("/{evidence_id}/with-case", response_model=EvidenceWithCase)
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


@router.post("/batch", response_model=List[EvidenceSchema], status_code=status.HTTP_201_CREATED)
async def batch_create_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Form(...),
    tags: Optional[str] = Form(None),
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
        logger.debug(f"文件{i+1}: 名称={file.filename}, 内容类型={file.content_type}, 大小={file.size if hasattr(file, 'size') else '未知'}")
    
    # 处理tags字符串，转换为列表
    tags_list = None
    if tags:
        try:
            # 尝试解析JSON格式的tags
            import json
            tags_list = json.loads(tags)
            logger.debug(f"解析JSON格式的tags: {tags_list}")
        except json.JSONDecodeError:
            # 如果不是JSON格式，按逗号分隔
            tags_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
            logger.debug(f"解析逗号分隔的tags: {tags_list}")
    
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
            db, case_id, tags_list, files, current_staff.id
        )
        
        if not evidences:
            # 收集文件信息用于调试
            files_info = []
            for file in files:
                try:
                    file_info = {
                        "filename": file.filename,
                        "content_type": file.content_type,
                        "size": file.size if hasattr(file, 'size') else None
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
                "files_info": files_info
            }
            
            logger.error(f"所有文件上传失败: {error_detail}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail,
            )
        
        logger.info(f"批量创建证据成功: 成功数量={len(evidences)}")
        return evidences
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
                        "size": file.size if hasattr(file, 'size') else None
                    } for file in files
                ]
            },
        )


@router.put("/{evidence_id}", response_model=EvidenceSchema)
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


@router.delete("/batch")
async def batch_delete_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    delete_request: BatchDeleteRequest,
):
    """批量删除证据
    
    允许一次删除多个证据
    """
    if not delete_request.evidence_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供证据ID列表",
        )
    
    # 批量删除证据
    result = await evidence_service.batch_delete(db, delete_request.evidence_ids)
    
    return result