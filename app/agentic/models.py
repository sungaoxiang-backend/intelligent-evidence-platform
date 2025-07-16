from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text, ARRAY, JSON, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class FeatureGroup(Base):
    """特征组模型，用于关联多个证据的共同特征"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 提取的特征数据
    extracted_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # 特征提取状态
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class EvidenceFeatureGroupAssociation(Base):
    """证据与特征组的关联表"""
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # 外键
    evidence_id: Mapped[int] = mapped_column(Integer, ForeignKey("evidences.id"), nullable=False)
    feature_group_id: Mapped[int] = mapped_column(Integer, ForeignKey("feature_groups.id"), nullable=False)
    
    # 可选：在关联中存储额外信息
    relevance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 相关性得分
    position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 在特征组中的位置/顺序
