import asyncio
import mimetypes
import uuid
from typing import Annotated, List, Optional, Callable, Awaitable, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status, WebSocket, WebSocketDisconnect
from loguru import logger

from app.core.config import settings
from app.core.deps import DBSession, get_current_staff
from app.core.response import SingleResponse, ListResponse, Pagination
from app.staffs.models import Staff
from app.evidences.schemas import (
    EvidenceResponse,
    BatchDeleteRequest,
    EvidenceEditRequest,
    BatchCheckEvidenceRequest
)
from app.cases import services as case_service
from app.evidences import services as evidence_service

router = APIRouter()


@router.get("", response_model=ListResponse[EvidenceResponse])
async def read_evidences(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
    case_id: Optional[int] = None,
    search: Optional[str] = None,
    evidence_ids: Optional[List[int]] = Query(None),
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
):
    """获取证据列表，支持动态排序"""
    if evidence_ids:
        # 如果提供了evidence_ids，直接根据ID获取
        evidences = []
        for evidence_id in evidence_ids:
            evidence = await evidence_service.get_by_id(db, evidence_id)
            if evidence:
                evidences.append(evidence)
        return ListResponse(
            data=evidences,
            pagination=Pagination(total=len(evidences), page=1, size=len(evidences), pages=1)
        )
    else:
        # 原有的分页查询逻辑，支持排序
        evidences, total = await evidence_service.get_multi_with_count(
            db, skip=skip, limit=limit, case_id=case_id, search=search,
            sort_by=sort_by, sort_order=sort_order
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

@router.post("/batch-check", response_model=ListResponse[EvidenceResponse])
async def batch_check_evidences(
    request: BatchCheckEvidenceRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """批量检查证据"""
    evidences = await evidence_service.batch_check_evidence(db, request.evidence_ids)
    return ListResponse(data=evidences)


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
from app.evidences.models import EvidenceStatus

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
    
    # 由于 EvidenceResponse 现在继承了 BaseSchema，Pydantic 可以自动处理转换
    # 只需要确保 case 关系被正确加载
    for evidence in evidences:
        if evidence.case_id and not evidence.case:
            evidence.case = await case_service.get_by_id(db, evidence.case_id)
    
    return ListResponse(data=evidences)


@router.websocket("/ws/auto-process")
async def websocket_auto_process(websocket: WebSocket):
    await websocket.accept()
    connection_id = id(websocket)  # 为每个连接生成唯一ID
    logger.info(f"WebSocket连接已建立 [ID: {connection_id}]")
    
    try:
        # 接收JSON格式的请求
        data = await websocket.receive_json()
        logger.info(f"收到WebSocket请求 [ID: {connection_id}]: {data}")
        
        # 解析请求参数
        case_id = data.get("case_id")
        evidence_ids = data.get("evidence_ids", [])
        auto_classification = data.get("auto_classification", False)
        auto_feature_extraction = data.get("auto_feature_extraction", False)
        
        if not case_id:
            await websocket.send_json({"error": "必须提供case_id"})
            return
        
        # 验证案件是否存在且用户有权限
        try:
            from app.db.session import async_session_factory
            from app.cases.services import get_by_id
            
            async with async_session_factory() as db:
                case = await get_by_id(db, case_id)
                if not case:
                    await websocket.send_json({"error": "案件不存在"})
                    return
        except Exception as e:
            logger.error(f"验证案件权限失败 [ID: {connection_id}]: {e}")
            await websocket.send_json({"error": "验证案件权限失败"})
            return
                
        # 使用回调发送进度
        async def send_progress(update_data: dict):
            try:
                await websocket.send_json(update_data)
                logger.debug(f"发送进度 [ID: {connection_id}]: {update_data}")
            except Exception as e:
                logger.error(f"发送进度失败 [ID: {connection_id}]: {e}")
        
        try:
            from app.evidences.services import auto_process
            
            # 创建数据库会话
            async with async_session_factory() as db:
                logger.info(f"开始处理证据 [ID: {connection_id}, Case: {case_id}, Evidence IDs: {evidence_ids}]")
                
                evidences = await auto_process(
                    db=db,
                    case_id=case_id,
                    files=None,
                    evidence_ids=evidence_ids,
                    auto_classification=auto_classification,
                    auto_feature_extraction=auto_feature_extraction,
                    send_progress=send_progress
                )
                
                logger.info(f"处理完成 [ID: {connection_id}]: 成功处理 {len(evidences)} 个证据")
            
        except Exception as e:
            logger.error(f"处理过程中出错 [ID: {connection_id}]: {e}")
            try:
                await websocket.send_json({
                    "status": "error",
                    "message": str(e)
                })
            except Exception as send_error:
                logger.error(f"发送错误消息失败 [ID: {connection_id}]: {send_error}")
        finally:
            # 确保连接正常关闭
            try:
                await websocket.close(code=1000, reason="处理完成")
            except Exception as close_error:
                logger.error(f"关闭WebSocket连接失败 [ID: {connection_id}]: {close_error}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket客户端断开连接 [ID: {connection_id}]")
    except Exception as e:
        logger.error(f"WebSocket错误 [ID: {connection_id}]: {e}")
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass

