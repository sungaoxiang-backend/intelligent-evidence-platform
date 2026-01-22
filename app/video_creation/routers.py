from typing import Annotated, List
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.deps import DBSession, get_current_staff
from app.staffs.models import Staff
from app.video_creation.models import VideoCreationSession, VideoCreationMessage
from app.video_creation.schemas import (
    SessionCreate, SessionResponse, MessageCreate, MessageResponse,
    QuickAction, VideoScriptResponse
)
from app.video_creation.services import VideoCreationService
from app.core.response import SingleResponse, ListResponse


router = APIRouter()
service = VideoCreationService()


@router.post("/sessions", response_model=SingleResponse[SessionResponse])
async def create_session(
    request: SessionCreate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """创建新会话"""
    # 使用初始消息作为会话标题（最多50字符）
    title = "新会话"
    if request.initial_message:
        title = request.initial_message[:50] + ("..." if len(request.initial_message) > 50 else "")

    # 创建会话
    session = VideoCreationSession(
        staff_id=current_staff.id,
        title=title
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return SingleResponse(data=SessionResponse.model_validate(session))


@router.get("/sessions", response_model=ListResponse[SessionResponse])
async def get_sessions(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = 0,
    limit: int = 50
):
    """获取用户会话列表"""
    query = select(VideoCreationSession).where(
        VideoCreationSession.staff_id == current_staff.id
    ).order_by(desc(VideoCreationSession.updated_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    # 为每个会话添加最后一条消息
    sessions_with_last_message = []
    for session in sessions:
        session_dict = SessionResponse.model_validate(session).model_dump()
        
        # 获取最后一条消息
        last_msg_query = select(VideoCreationMessage).where(
            VideoCreationMessage.session_id == session.id
        ).order_by(desc(VideoCreationMessage.created_at)).limit(1)
        last_msg_result = await db.execute(last_msg_query)
        last_message = last_msg_result.scalar_one_or_none()
        
        if last_message:
            session_dict["last_message"] = last_message.content[:100]  # 截取前100字符
        
        sessions_with_last_message.append(SessionResponse(**session_dict))
    
    return ListResponse(data=sessions_with_last_message, total=len(sessions))


@router.get("/sessions/{session_id}", response_model=SingleResponse[SessionResponse])
async def get_session(
    session_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """获取会话详情"""
    query = select(VideoCreationSession).where(
        VideoCreationSession.id == session_id,
        VideoCreationSession.staff_id == current_staff.id
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return SingleResponse(data=SessionResponse.model_validate(session))


@router.get("/sessions/{session_id}/messages", response_model=ListResponse[MessageResponse])
async def get_session_messages(
    session_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """获取会话消息历史"""
    # 验证会话属于当前用户
    session_query = select(VideoCreationSession).where(
        VideoCreationSession.id == session_id,
        VideoCreationSession.staff_id == current_staff.id
    )
    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    # 获取消息
    messages_query = select(VideoCreationMessage).where(
        VideoCreationMessage.session_id == session_id
    ).order_by(VideoCreationMessage.created_at)
    
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()
    
    return ListResponse(
        data=[MessageResponse.model_validate(msg) for msg in messages],
        total=len(messages)
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """删除会话"""
    query = select(VideoCreationSession).where(
        VideoCreationSession.id == session_id,
        VideoCreationSession.staff_id == current_staff.id
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    await db.delete(session)
    await db.commit()
    
    return {"success": True, "message": "会话已删除"}


@router.post("/sessions/{session_id}/chat")
async def chat_stream(
    session_id: int,
    message: MessageCreate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """
    流式聊天端点 - 使用 Server-Sent Events (SSE)
    """
    # 验证会话属于当前用户
    session_query = select(VideoCreationSession).where(
        VideoCreationSession.id == session_id,
        VideoCreationSession.staff_id == current_staff.id
    )
    session_result = await db.execute(session_query)
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    async def event_generator():
        """SSE 事件生成器"""
        async for chunk in service.stream_chat(session_id, message.content, db):
            # SSE 格式: data: {json}\n\n
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 nginx 缓冲
        }
    )


@router.get("/quick-actions", response_model=ListResponse[QuickAction])
async def get_quick_actions(
    current_staff: Annotated[Staff, Depends(get_current_staff)]
):
    """获取快捷指令列表"""
    actions = service.get_quick_actions()
    return ListResponse(data=actions, total=len(actions))
