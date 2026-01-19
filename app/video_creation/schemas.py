from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# 会话相关 Schemas
class SessionCreate(BaseModel):
    """创建会话请求"""
    initial_message: Optional[str] = Field(None, description="初始消息（可选）")


class SessionResponse(BaseModel):
    """会话响应"""
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None
    
    class Config:
        from_attributes = True


# 消息相关 Schemas
class MessageCreate(BaseModel):
    """发送消息请求"""
    content: str = Field(..., description="消息内容")


class MessageResponse(BaseModel):
    """消息响应"""
    id: int
    role: str
    content: str
    message_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# 流式输出相关 Schemas
class StreamChunk(BaseModel):
    """流式输出数据块"""
    type: str = Field(..., description="事件类型: text, tool_call, skill_hit, thinking, error, done")
    content: str = Field(..., description="事件内容")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")


# 快捷指令相关 Schemas
class QuickAction(BaseModel):
    """快捷指令"""
    id: str
    label: str
    prompt: str
    description: str
    icon: str  # lucide-react icon name


# 脚本相关 Schemas
class VideoScriptResponse(BaseModel):
    """视频脚本响应"""
    id: int
    session_id: int
    message_id: int
    script_type: str
    script_content: str
    source_article_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
