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
    BatchCheckEvidenceRequest,
    EvidenceCardCastingRequest,
    EvidenceCardResponse,
    EvidenceCardUpdateRequest,
    EvidenceCardSlotTemplate,
    SlotAssignmentUpdateRequest,
    SlotAssignmentSnapshotResponse,
    SlotAssignmentResetRequest
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


@router.get("/case/{case_id}", response_model=ListResponse[EvidenceResponse])
async def read_evidences_by_case_id(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
):
    """获取案件的所有证据"""
    evidences, total = await evidence_service.list_evidences_by_case_id(db, case_id, search=search, skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order)
    return ListResponse(data=evidences, pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit))


@router.get("/evidence-cards", response_model=ListResponse[EvidenceCardResponse])
async def list_evidence_cards(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    case_id: int = Query(...),
    skip: int = 0,
    limit: int = 100,
    evidence_ids: Optional[List[int]] = Query(None),
    card_type: Optional[str] = None,
    card_is_associated: Optional[bool] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc",
):
    """获取证据卡片列表，支持筛选和排序
    
    Args:
        db: 数据库会话
        current_staff: 当前员工（认证）
        skip: 跳过记录数（分页）
        limit: 返回记录数限制（分页）
        case_id: 案件ID（筛选条件）
        evidence_ids: 证据ID列表（筛选条件）
        card_type: 卡片类型（筛选条件，从card_info中提取）
        card_is_associated: 是否关联提取（筛选条件，从card_info中提取）
        sort_by: 排序字段（created_at, updated_at, updated_times）
        sort_order: 排序顺序（asc, desc）
        
    Returns:
        ListResponse[EvidenceCardResponse]: 卡片列表
    """
    from app.evidences.services import get_cards_with_count
    from sqlalchemy.orm import selectinload
    
    # 获取卡片列表
    cards, total = await get_cards_with_count(
        db=db,
        skip=skip,
        limit=limit,
        case_id=case_id,
        evidence_ids=evidence_ids,
        card_type=card_type,
        card_is_associated=card_is_associated,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    # 转换为响应模型
    from app.evidences.services import get_cards_with_evidence_ids_sorted
    
    cards_with_evidence_ids = await get_cards_with_evidence_ids_sorted(db, cards)
    card_responses = []
    for card, evidence_ids in cards_with_evidence_ids:
        card_responses.append(
            EvidenceCardResponse(
                id=card.id,
                evidence_ids=evidence_ids,
                card_info=card.card_info,
                updated_times=card.updated_times,
                created_at=card.created_at.isoformat() if card.created_at else None,
                updated_at=card.updated_at.isoformat() if card.updated_at else None,
            )
        )
    
    return ListResponse(
        data=card_responses,
        pagination=Pagination(
            total=total,
            page=skip // limit + 1 if limit > 0 else 1,
            size=limit,
            pages=(total + limit - 1) // limit if limit > 0 else 1
        )
    )


@router.get("/evidence-cards/{card_id}", response_model=SingleResponse[EvidenceCardResponse])
async def get_evidence_card(
    card_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取证据卡片详情（包含关联的证据，按序号排序）
    
    Args:
        card_id: 卡片ID
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse[EvidenceCardResponse]: 卡片详情
    """
    from app.evidences.services import get_card_by_id, card_to_response
    
    card = await get_card_by_id(db, card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"证据卡片不存在: ID={card_id}",
        )
    
    # 转换为响应模型
    card_response = await card_to_response(card, db)
    
    return SingleResponse(data=card_response)


@router.put("/evidence-cards/{card_id}", response_model=SingleResponse[EvidenceCardResponse])
async def update_evidence_card(
    card_id: int,
    update_request: EvidenceCardUpdateRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新证据卡片
    
    支持以下更新操作：
    1. 更新 card_info（可以部分更新）
    2. 更新 card_features（更新 card_info 中的 card_features 数组）
    3. 更新引用证据的关系和顺序（更新关联表）
    
    Args:
        card_id: 卡片ID
        update_request: 更新请求
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse[EvidenceCardResponse]: 更新后的卡片详情
    """
    from app.evidences.services import update_card, card_to_response
    
    try:
        # 更新卡片
        card = await update_card(db, card_id, update_request)
        
        # 转换为响应模型
        card_response = await card_to_response(card, db)
        
        return SingleResponse(data=card_response)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"更新证据卡片失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新证据卡片失败: {str(e)}",
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


@router.post("/{evidence_id}/update-party-info", response_model=SingleResponse[dict])
async def update_party_info_from_evidence(
    evidence_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """手动触发从证据更新当事人信息"""
    try:
        # 获取证据
        evidence = await evidence_service.get_by_id(db, evidence_id)
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="证据不存在",
            )
        
        # 获取案件
        case = evidence.case
        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="案件不存在",
            )
        
        # 导入更新函数
        from app.evidences.services import _update_party_information_from_evidence
        
        # 执行当事人信息更新
        await _update_party_information_from_evidence(db, case, [evidence])
        
        return SingleResponse(
            data={"message": f"成功更新证据 {evidence_id} 的当事人信息"},
            message="当事人信息更新成功"
        )
        
    except Exception as e:
        logger.error(f"更新当事人信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新当事人信息失败: {str(e)}"
        )


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


@router.post("/evidence-cards/cast", response_model=SingleResponse[dict])
async def cast_evidence_cards(
    request: EvidenceCardCastingRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """
    证据卡片铸造（异步任务）
    
    接收多个证据IDs，创建异步任务进行以下操作：
    1. 证据分类（使用 EvidenceClassifier）
    2. 特征提取：
       - OCR类型证据（如营业执照、身份证、发票等）：使用 XunfeiOcrService
       - Agent类型证据（单个证据）：使用 EvidenceFeaturesExtractor
       - 关联证据（如微信聊天记录，多个证据）：使用 AssociationFeaturesExtractor
    3. 创建或更新证据卡片
    
    Args:
        request: 卡片铸造请求，包含 case_id 和 evidence_ids
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse: 包含 task_id 和状态信息的响应
    """
    from app.tasks.real_evidence_tasks import cast_evidence_cards_task
    
    # 验证案件是否存在
    case = await case_service.get_by_id(db, request.case_id)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"案件不存在: ID={request.case_id}",
        )
    
    # 验证证据是否存在
    evidences = await evidence_service.get_multi_by_ids(db, request.evidence_ids)
    if len(evidences) != len(request.evidence_ids):
        found_ids = {ev.id for ev in evidences}
        missing_ids = set(request.evidence_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"以下证据不存在: {list(missing_ids)}",
        )
    
    try:
        # 创建异步任务
        task = cast_evidence_cards_task.delay(
            case_id=request.case_id,
            evidence_ids=request.evidence_ids
        )
        
        logger.info(f"创建证据卡片铸造任务: task_id={task.id}, case_id={request.case_id}, evidence_ids={request.evidence_ids}")
        
        return SingleResponse(
            data={
                "task_id": task.id,
                "status": "started",
                "message": "证据卡片铸造任务已创建",
                "case_id": request.case_id,
                "evidence_ids": request.evidence_ids
            },
            message="证据卡片铸造任务已创建"
        )
    except Exception as e:
        logger.error(f"创建证据卡片铸造任务失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建证据卡片铸造任务失败: {str(e)}",
        )


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
    # current_staff: Annotated[Staff, Depends(get_current_staff)],
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


@router.get("/evidence-card-slot-templates/{case_id}", response_model=ListResponse[EvidenceCardSlotTemplate])
async def get_evidence_card_slot_templates(
    case_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 100,
):
    """获取案件的证据卡槽模板列表
    
    根据案件ID获取对应的证据卡槽模板配置列表，包括：
    - 案由类型
    - 案件当事人类型组合（债权人和债务人类型）
    - 主要证据类型（如果没有确立，至少返回两个槽位模板）
    
    Args:
        case_id: 案件ID
        db: 数据库会话
        current_staff: 当前员工（认证）
        skip: 跳过记录数（分页）
        limit: 返回记录数限制（分页）
        
    Returns:
        ListResponse[EvidenceCardSlotTemplate]: 证据卡槽模板列表响应
    """
    try:
        templates_response = await evidence_service.get_evidence_card_slot_templates(db, case_id)
        templates = templates_response.templates
        
        # 应用分页
        total = len(templates)
        paginated_templates = templates[skip:skip + limit]
        
        return ListResponse(
            data=paginated_templates,
            pagination=Pagination(
                total=total,
                page=skip // limit + 1 if limit > 0 else 1,
                size=len(paginated_templates),
                pages=(total + limit - 1) // limit if limit > 0 else 1
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"获取证据卡槽模板失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"获取证据卡槽模板失败: {str(e)}")


@router.get("/evidence-card-slot-assignments/{case_id}/{template_id}", response_model=SingleResponse[SlotAssignmentSnapshotResponse])
async def get_slot_assignment_snapshot(
    case_id: int,
    template_id: str,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取某个案件、某个模板的槽位快照
    
    Args:
        case_id: 案件ID
        template_id: 模板ID
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse[SlotAssignmentSnapshotResponse]: 槽位快照响应
    """
    try:
        assignments = await evidence_service.get_slot_assignment_snapshot(
            db, case_id, template_id
        )
        return SingleResponse(
            data=SlotAssignmentSnapshotResponse(
                case_id=case_id,
                template_id=template_id,
                assignments=assignments
            ),
            code=200,
            message="获取成功"
        )
    except Exception as e:
        logger.error(f"获取槽位快照失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取槽位快照失败: {str(e)}"
        )


@router.put("/evidence-card-slot-assignments/{case_id}", response_model=SingleResponse[dict])
async def update_slot_assignment(
    case_id: int,
    update_request: SlotAssignmentUpdateRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新或创建槽位关联
    
    Args:
        case_id: 案件ID
        update_request: 更新请求
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse[dict]: 更新结果
    """
    try:
        await evidence_service.update_slot_assignment(
            db,
            case_id,
            update_request.template_id,
            update_request.slot_id,
            update_request.card_id,
        )
        return SingleResponse(
            data={"message": "槽位关联已更新"},
            code=200,
            message="更新成功"
        )
    except Exception as e:
        logger.error(f"更新槽位关联失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新槽位关联失败: {str(e)}"
        )


@router.post("/evidence-card-slot-assignments/{case_id}/reset", response_model=SingleResponse[dict])
async def reset_slot_assignment_snapshot(
    case_id: int,
    reset_request: SlotAssignmentResetRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """重置某个案件、某个模板的所有槽位关联
    
    Args:
        case_id: 案件ID
        reset_request: 重置请求
        db: 数据库会话
        current_staff: 当前员工（认证）
        
    Returns:
        SingleResponse[dict]: 重置结果
    """
    try:
        deleted_count = await evidence_service.reset_slot_assignment_snapshot(
            db, case_id, reset_request.template_id
        )
        return SingleResponse(
            data={"message": f"已重置 {deleted_count} 个槽位关联"},
            code=200,
            message="重置成功"
        )
    except Exception as e:
        logger.error(f"重置槽位快照失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"重置槽位快照失败: {str(e)}"
        )

