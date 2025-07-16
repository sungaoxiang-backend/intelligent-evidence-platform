from enum import Enum
from typing import Optional

from sqlalchemy import Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text, Float, Boolean, JSON
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Evidence(Base):
    """证据模型 - 只关注证据本身的属性"""

    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # 元数据
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False)
    
    # 单个证据的特征提取结果（可选，用于存储独立的特征）
    individual_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # 外键
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    
    # 关系
    case = relationship("Case", back_populates="evidences")