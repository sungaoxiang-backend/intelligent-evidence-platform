from pydantic import BaseModel, ConfigDict
from datetime import datetime
import pytz

def convert_datetime_to_shanghai(dt: datetime) -> str:
    """将datetime对象（无论是否带时区）转换为上海时区的ISO格式字符串"""
    if dt.tzinfo is None:
        # 如果是天真(naive)的datetime，根据我们的AwareDateTime设置，它实际上是UTC
        dt = pytz.utc.localize(dt)
    # 将时间转换为上海时区
    return dt.astimezone(pytz.timezone('Asia/Shanghai')).isoformat()

class BaseSchema(BaseModel):
    """
    基础 Schema.
    所有其他数据传输对象 (DTOs/Schemas) 应继承自此类.
    """
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={
            datetime: convert_datetime_to_shanghai
        }
    )

