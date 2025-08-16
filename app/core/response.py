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
    timestamp: str = Field(default_factory=lambda: datetime.now(pytz.timezone('Asia/Shanghai')).isoformat(), description="时间戳")

class ListResponse(BaseResponse, Generic[T]):
    data: List[T] = Field(default_factory=lambda: [], description="数据列表")
    pagination: Optional[Pagination] = Field(None, description="分页信息")
    
    def __init__(self, **data):
        # 确保code和message有默认值
        if 'code' not in data:
            data['code'] = 200
        if 'message' not in data:
            data['message'] = 'success'
        super().__init__(**data)

class SingleResponse(BaseResponse, Generic[T]):
    data: Optional[T] = Field(None, description="数据")