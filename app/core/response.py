from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime
import pytz

T = TypeVar('T')

class Pagination(BaseModel):
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    pages: int = Field(..., description="总页数")

class BaseResponse(BaseModel):
    code: int = Field(200, description="状态码")
    message: str = Field("success", description="消息")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(pytz.timezone('Asia/Shanghai')).isoformat(), description="时间戳")

class ListResponse(BaseResponse, Generic[T]):
    data: List[T] = Field(default_factory=list, description="数据列表")
    pagination: Optional[Pagination] = Field(None, description="分页信息")

class SingleResponse(BaseResponse, Generic[T]):
    data: Optional[T] = Field(None, description="数据")