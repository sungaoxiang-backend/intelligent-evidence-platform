"""
配置管理API路由
提供配置的CRUD操作
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from sqlalchemy import select, update

from app.db.session import get_db
from app.core.config_manager import config_manager
from app.core.models import DynamicConfig, ConfigAuditLog


router = APIRouter(prefix="/config", tags=["配置管理"])


class DynamicConfigCreate(BaseModel):
    """创建动态配置请求模型"""
    key: str
    value: Any
    description: Optional[str] = None
    category: str = "operation"  # business/operation/development/system
    role: str = "operator"  # admin/developer/operator


class DynamicConfigUpdate(BaseModel):
    """更新动态配置请求模型"""
    value: Any
    description: Optional[str] = None
    category: Optional[str] = None
    role: Optional[str] = None
    change_reason: Optional[str] = None


class DynamicConfigResponse(BaseModel):
    """动态配置响应模型"""
    id: str
    key: str
    value: Any
    description: Optional[str] = None
    category: str
    role: str
    is_active: bool
    created_at: str
    updated_at: str


class ConfigAuditLogResponse(BaseModel):
    """配置审计日志响应模型"""
    id: str
    config_key: str
    old_value: Optional[Any] = None
    new_value: Any
    changed_by: str
    change_reason: Optional[str] = None
    created_at: str


# 业务配置相关端点
@router.get("/business")
async def get_business_config():
    """获取业务逻辑配置（YAML）"""
    try:
        business_config = config_manager.load_business_config()
        return {
            "evidence_types": business_config.evidence_types,
            "extraction_rules": business_config.extraction_rules,
            "classification_thresholds": business_config.classification_thresholds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载业务配置失败: {str(e)}")

@router.post("/business/reload")
async def reload_business_config():
    """重新加载业务配置"""
    try:
        config_manager.reload_business_config()
        return {"message": "业务配置重新加载成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重新加载业务配置失败: {str(e)}")

# 动态配置相关端点
@router.get("/dynamic", response_model=List[DynamicConfigResponse])
async def get_all_dynamic_configs(db: AsyncSession = Depends(get_db)):
    """获取所有动态配置"""
    configs = await config_manager.get_configs_by_category("operation", db)
    return [
        DynamicConfigResponse(
            id=config.id,
            key=config.key,
            value=config.value,
            description=config.description,
            category=config.category,
            role=config.role,
            is_active=config.is_active,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat()
        )
        for config in configs
    ]

@router.get("/dynamic/{category}", response_model=List[DynamicConfigResponse])
async def get_configs_by_category(category: str, db: AsyncSession = Depends(get_db)):
    """根据分类获取配置"""
    configs = await config_manager.get_configs_by_category(category, db)
    return [
        DynamicConfigResponse(
            id=config.id,
            key=config.key,
            value=config.value,
            description=config.description,
            category=config.category,
            role=config.role,
            is_active=config.is_active,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat()
        )
        for config in configs
    ]

@router.get("/dynamic/role/{role}", response_model=List[DynamicConfigResponse])
async def get_configs_by_role(role: str, db: AsyncSession = Depends(get_db)):
    """根据角色获取配置"""
    configs = await config_manager.get_configs_by_role(role, db)
    return [
        DynamicConfigResponse(
            id=config.id,
            key=config.key,
            value=config.value,
            description=config.description,
            category=config.category,
            role=config.role,
            is_active=config.is_active,
            created_at=config.created_at.isoformat(),
            updated_at=config.updated_at.isoformat()
        )
        for config in configs
    ]

@router.get("/dynamic/{key}")
async def get_dynamic_config(key: str, db: AsyncSession = Depends(get_db)):
    """获取特定动态配置"""
    config_value = await config_manager.get_dynamic_config(key, db)
    if config_value is None:
        raise HTTPException(status_code=404, detail="配置不存在")
    return {"key": key, "value": config_value}

@router.post("/dynamic")
async def create_dynamic_config(
    config: DynamicConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建动态配置"""
    success = await config_manager.set_dynamic_config(
        key=config.key,
        value=config.value,
        category=config.category,
        role=config.role,
        description=config.description,
        db=db
    )
    if success:
        return {"message": "配置创建成功"}
    else:
        raise HTTPException(status_code=500, detail="配置创建失败")

@router.put("/dynamic/{key}")
async def update_dynamic_config(
    key: str,
    config_update: DynamicConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新动态配置"""
    # 获取现有配置
    existing_config = await db.execute(
        select(DynamicConfig).where(DynamicConfig.key == key)
    )
    existing = existing_config.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    # 更新配置
    success = await config_manager.set_dynamic_config(
        key=key,
        value=config_update.value,
        category=config_update.category or existing.category,
        role=config_update.role or existing.role,
        description=config_update.description,
        db=db
    )
    
    if success:
        return {"message": "配置更新成功"}
    else:
        raise HTTPException(status_code=500, detail="配置更新失败")

@router.delete("/dynamic/{key}")
async def delete_dynamic_config(key: str, db: AsyncSession = Depends(get_db)):
    """删除动态配置（软删除）"""
    result = await db.execute(
        select(DynamicConfig).where(DynamicConfig.key == key)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    # 软删除
    await db.execute(
        update(DynamicConfig)
        .where(DynamicConfig.key == key)
        .values(is_active=False)
    )
    
    # 从缓存中移除
    config_manager.reload_dynamic_config()
    
    await db.commit()
    return {"message": "配置删除成功"}

# 审计日志相关端点
@router.get("/audit-logs", response_model=List[ConfigAuditLogResponse])
async def get_audit_logs(
    config_key: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取配置审计日志"""
    query = select(ConfigAuditLog).order_by(ConfigAuditLog.created_at.desc()).limit(limit)
    
    if config_key:
        query = query.where(ConfigAuditLog.config_key == config_key)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        ConfigAuditLogResponse(
            id=log.id,
            config_key=log.config_key,
            old_value=log.old_value,
            new_value=log.new_value,
            changed_by=log.changed_by,
            change_reason=log.change_reason,
            created_at=log.created_at.isoformat()
        )
        for log in logs
    ] 