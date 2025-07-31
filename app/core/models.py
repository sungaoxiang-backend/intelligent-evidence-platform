"""
动态配置数据库模型
用于存储运行时可修改的配置
"""

from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base
import uuid


class DynamicConfig(Base):
    """动态配置表"""
    __tablename__ = "dynamic_configs"
    
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    key = Column(String(255), unique=True, index=True, nullable=False, comment="配置键")
    value = Column(JSON, nullable=False, comment="配置值")
    description = Column(Text, nullable=True, comment="配置描述")
    category = Column(String(100), default="operation", comment="配置分类: business/operation/development/system")
    role = Column(String(50), default="operator", comment="角色权限: admin/developer/operator")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    class Config:
        from_attributes = True


class ConfigAuditLog(Base):
    """配置审计日志表"""
    __tablename__ = "config_audit_logs"
    
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    config_key = Column(String(255), nullable=False, comment="配置键")
    old_value = Column(JSON, nullable=True, comment="旧值")
    new_value = Column(JSON, nullable=False, comment="新值")
    changed_by = Column(String(100), nullable=False, comment="修改人")
    change_reason = Column(Text, nullable=True, comment="修改原因")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="修改时间")
    
    class Config:
        from_attributes = True 