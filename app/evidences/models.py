from enum import Enum
from typing import Optional

from sqlalchemy import Column, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

class Evidence(Base):
    """证据模型"""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # 文件大小（字节）
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False)  # 文件扩展名
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)  # 标签
    
    # 外键
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    uploaded_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("staffs.id"), nullable=False)
    
    # 关系
    case = relationship("Case", back_populates="evidences")
    uploaded_by = relationship("Staff")