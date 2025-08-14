from typing import Optional
from enum import Enum
from sqlalchemy import Boolean, Column, Integer, String, Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base

class User(Base):
    """用户模型"""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    wechat_nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    wechat_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    wechat_avatar: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    id_card: Mapped[Optional[str]] = mapped_column(String(18), unique=True, index=True, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True, nullable=True)
    
    # 关系
    cases = relationship("Case", back_populates="user", cascade="all, delete-orphan")