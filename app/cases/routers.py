from typing import Annotated, Optional, Callable, Awaitable
import time

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy import Case
from fastapi import Form, File, UploadFile
from typing import List
from loguru import logger

from app.core.deps import DBSession, get_current_staff
from app.core.response import SingleResponse, ListResponse, Pagination
from app.staffs.models import Staff
from app.cases.schemas import Case as CaseSchema, CaseCreate, CaseUpdate, CaseWithUser, AutoProcessRequest, AutoProcessResponse, CaseWithAssociationEvidenceFeaturesResponse, AssociationEvidenceFeatureUpdateRequest
from app.cases import services as case_service
from app.users import services as user_service
from app.cases.schemas import CaseRegistrationRequest, CaseRegistrationResponse
from app.cases.services import register_case_with_user

router = APIRouter()


@router.get("", response_model=ListResponse[CaseWithUser])
async def read_cases(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 10,
    user_id: Optional[int] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
):
    """获取案件列表，支持动态排序"""
    time.sleep(2)
    # 构建查询条件
    filters = {}
    if user_id is not None:
        filters["user_id"] = user_id

    # 获取案件列表，支持排序
    cases, total = await case_service.get_multi_with_count(
        db, 
        skip=skip, 
        limit=limit, 
        sort_by=sort_by,
        sort_order=sort_order,
        **filters
    )

    return ListResponse(
        data=cases,
        pagination=Pagination(total=total, page=skip // limit + 1, size=limit, pages=(total + limit - 1) // limit)
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SingleResponse[CaseSchema])
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


@router.get("/{case_id}", response_model=SingleResponse[CaseWithAssociationEvidenceFeaturesResponse])
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


@router.put("/association-features/{feature_id}", response_model=SingleResponse[dict])
async def update_association_evidence_feature(
    feature_id: int,
    update_request: AssociationEvidenceFeatureUpdateRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新关联证据特征"""
    # 获取特征记录
    feature = await case_service.get_association_evidence_feature_by_id(db, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="关联证据特征不存在")
    
    # 更新特征
    update_data = update_request.model_dump(exclude_unset=True)
    updated_feature = await case_service.update_association_evidence_feature(db, feature_id, update_data)
    
    if not updated_feature:
        raise HTTPException(status_code=500, detail="更新失败")
    
    return SingleResponse(data={"message": "关联证据特征更新成功", "feature_id": feature_id})


@router.get("/association-features/{feature_id}", response_model=SingleResponse[dict])
async def get_association_evidence_feature(
    feature_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取关联证据特征详情"""
    feature = await case_service.get_association_evidence_feature_by_id(db, feature_id)
    if not feature:
        raise HTTPException(status_code=404, detail="关联证据特征不存在")
    
    return SingleResponse(data=feature)


@router.post("/registration", response_model=SingleResponse[CaseRegistrationResponse])
async def register_case(
    request: CaseRegistrationRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """综合录入案件和用户"""

    result = await register_case_with_user(db, request)
    return SingleResponse(data=result)


@router.post("/auto-process", response_model=ListResponse[AutoProcessResponse])
async def auto_process(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    request: AutoProcessRequest,
):
    """创建关联证据特征"""

    # 检查案件是否存在
    case = await case_service.get_by_id(db, request.case_id)
    if not case:
        logger.warning(f"案件不存在: ID={request.case_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="案件不存在",
        )

    result = await case_service.auto_process(db, request.case_id, request.evidence_ids)
    return ListResponse(data=result)


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
            # 创建数据库会话
            async with async_session_factory() as db:
                logger.info(f"开始处理案件推理 [ID: {connection_id}, Case: {case_id}, Evidence IDs: {evidence_ids}]")
                
                result = await case_service.auto_process(
                    db=db,
                    case_id=case_id,
                    evidence_ids=evidence_ids,
                    send_progress=send_progress
                )
                
                logger.info(f"处理完成 [ID: {connection_id}]: 成功处理 {len(result)} 个关联特征")
            
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
