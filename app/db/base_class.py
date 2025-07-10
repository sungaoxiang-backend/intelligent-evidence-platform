from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import DeclarativeBase
import pytz

class Base(DeclarativeBase):
    """SQLAlchemy 2.0 基础模型类"""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # 根据类名自动生成表名
    @declared_attr.directive
    def __tablename__(cls) -> str:
        # 如果已经定义了表名，则使用已定义的表名
        if hasattr(cls, "_tablename"):
            return cls._tablename
        # 否则根据类名生成复数形式的表名
        name = cls.__name__.lower()
        return f"{name}s"

    # 使用中国时区的默认时间生成器
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)