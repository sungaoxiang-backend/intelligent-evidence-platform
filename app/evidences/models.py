from enum import Enum
from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy import Enum as SQLAlchemyEnum, ForeignKey, Integer, String, Text, Float, Boolean, JSON, DateTime
from sqlalchemy.dialects.postgresql import JSONB  # 使用JSONB替代JSON以获得更好的性能
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.cases.models import VaildationStatus

class EvidenceStatus(str, Enum):
    """证据状态"""
    UPLOADED = "uploaded"          # 已上传
    CLASSIFIED = "classified"      # 已分类
    FEATURES_EXTRACTED = "features_extracted"  # 特征已提取
    CHECKED = "checked"        # 已审核
    

class Evidence(Base):
    """证据模型"""    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_extension: Mapped[str] = mapped_column(String(20), nullable=False)
    evidence_status: Mapped[str] = mapped_column(String(20), default=EvidenceStatus.UPLOADED)
    validation_status: Mapped[str] = mapped_column(String(20), default=VaildationStatus.PENDING)
    
    # 分类元数据
    classification_category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    classification_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    classification_reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    classified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    
    # 特征提取元数据
    evidence_features: Mapped[Optional[List[Dict]]] = mapped_column(JSONB, nullable=True)
    features_extracted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    
    # 关系
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id"), nullable=False)
    case = relationship("Case", back_populates="evidences")