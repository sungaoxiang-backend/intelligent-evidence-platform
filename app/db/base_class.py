from datetime import datetime
from typing import Any

from sqlalchemy import Column, DateTime, func
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """SQLAlchemy 2.0 基础模型类"""

    id: Any

    # 根据类名自动生成表名
    @declared_attr.directive
    def __tablename__(cls) -> str:
        # 如果已经定义了表名，则使用已定义的表名
        if hasattr(cls, "_tablename"):
            return cls._tablename
        # 否则根据类名生成复数形式的表名
        name = cls.__name__.lower()
        return f"{name}s"

    # 所有模型共有的列
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        nullable=False,
    )