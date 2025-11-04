"""
分层配置管理器
支持环境配置、业务规则配置和动态配置的统一管理
"""

import os
import yaml
import json
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.core.models import DynamicConfig, ConfigAuditLog
import uuid
from datetime import datetime

class BusinessConfig(BaseModel):
    evidence_types: Dict[str, Dict[str, Any]]
    extraction_rules: Dict[str, Any]
    classification_thresholds: Dict[str, float]
    class Config:
        extra = "allow"

class EvidenceTypesConfig(BaseModel):
    metadata: Dict[str, Any]
    evidence_types: Dict[str, Dict[str, Any]]
    class Config:
        extra = "allow"

class EvidenceChainsConfig(BaseModel):
    """证据链配置模型"""
    metadata: Dict[str, Any]
    evidence_chains: List[Dict[str, Any]]
    class Config:
        extra = "allow"

class EvidenceCardSlotsConfig(BaseModel):
    """证据卡槽配置模型"""
    metadata: Dict[str, Any]
    case_causes: Dict[str, str]
    key_evidence_types: Dict[str, str]
    party_types: Dict[str, str]
    evidence_card_templates: List[Dict[str, Any]]
    scenario_rules: List[Dict[str, Any]]
    class Config:
        extra = "allow"

class DynamicConfig(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None
    category: str = "general"  # "business", "operation", "development", "system"
    role: str = "operator"  # "admin", "developer", "operator"
    is_active: bool = True

class ConfigManager:
    def __init__(self):
        self._business_config: Optional[BusinessConfig] = None
        self._evidence_types_config: Optional[EvidenceTypesConfig] = None
        self._evidence_chains_config: Optional[EvidenceChainsConfig] = None
        self._evidence_card_slots_config: Optional[EvidenceCardSlotsConfig] = None
        self._config_cache: Dict[str, Any] = {}
        self._business_config_path = "app/core/business_config.yaml"
        self._evidence_types_path = "app/core/evidence_types_v2.yaml"
        self._evidence_chains_path = "app/core/evidence_chains.yaml"
        self._evidence_card_slots_path = "app/evidences/evidence_card_slots.yaml"
    
    def load_business_config(self) -> BusinessConfig:
        """加载业务逻辑配置（YAML文件）"""
        if self._business_config is None:
            if os.path.exists(self._business_config_path):
                with open(self._business_config_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    self._business_config = BusinessConfig(**data)
            else:
                raise FileNotFoundError(f"业务配置文件不存在: {self._business_config_path}")
        return self._business_config
    
    def load_evidence_types_config(self) -> EvidenceTypesConfig:
        """加载证据类型配置（YAML文件）"""
        if self._evidence_types_config is None:
            if os.path.exists(self._evidence_types_path):
                with open(self._evidence_types_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    self._evidence_types_config = EvidenceTypesConfig(**data)
            else:
                raise FileNotFoundError(f"证据类型配置文件不存在: {self._evidence_types_path}")
        return self._evidence_types_config
    
    def load_evidence_chains_config(self) -> EvidenceChainsConfig:
        """加载证据链配置（YAML文件）"""
        if self._evidence_chains_config is None:
            if os.path.exists(self._evidence_chains_path):
                with open(self._evidence_chains_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    if data is None:
                        raise ValueError(f"证据链配置文件为空: {self._evidence_chains_path}")
                    self._evidence_chains_config = EvidenceChainsConfig(**data)
            else:
                raise FileNotFoundError(f"证据链配置文件不存在: {self._evidence_chains_path}")
        return self._evidence_chains_config
    
    def load_evidence_card_slots_config(self) -> EvidenceCardSlotsConfig:
        """加载证据卡槽配置（YAML文件）"""
        if self._evidence_card_slots_config is None:
            if os.path.exists(self._evidence_card_slots_path):
                with open(self._evidence_card_slots_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    if data is None:
                        raise ValueError(f"证据卡槽配置文件为空: {self._evidence_card_slots_path}")
                    self._evidence_card_slots_config = EvidenceCardSlotsConfig(**data)
            else:
                raise FileNotFoundError(f"证据卡槽配置文件不存在: {self._evidence_card_slots_path}")
        return self._evidence_card_slots_config
    
    async def get_dynamic_config(self, key: str, db: Optional[AsyncSession] = None) -> Optional[Any]:
        """获取动态配置（数据库）"""
        # 先从缓存获取
        if key in self._config_cache:
            return self._config_cache[key]
        
        # 如果提供了数据库连接，从数据库获取
        if db:
            result = await db.execute(
                select(DynamicConfig).where(
                    DynamicConfig.key == key,
                    DynamicConfig.is_active == True
                )
            )
            config = result.scalar_one_or_none()
            if config:
                self._config_cache[key] = config.value
                return config.value
        
        return None
    
    async def set_dynamic_config(
        self, 
        key: str, 
        value: Any, 
        category: str = "operation",
        role: str = "operator",
        description: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> bool:
        """设置动态配置（数据库）"""
        config_id = str(uuid.uuid4())
        
        if db:
            # 检查是否已存在
            existing = await db.execute(
                select(DynamicConfig).where(DynamicConfig.key == key)
            )
            existing_config = existing.scalar_one_or_none()
            
            if existing_config:
                # 记录审计日志
                audit_log = ConfigAuditLog(
                    id=str(uuid.uuid4()),
                    config_key=key,
                    old_value=existing_config.value,
                    new_value=value,
                    changed_by=role,
                    change_reason=f"配置更新: {description or '无说明'}"
                )
                db.add(audit_log)
                
                # 更新现有配置
                await db.execute(
                    update(DynamicConfig)
                    .where(DynamicConfig.key == key)
                    .values(
                        value=value,
                        category=category,
                        role=role,
                        description=description,
                        updated_at=datetime.utcnow()
                    )
                )
            else:
                # 创建新配置
                new_config = DynamicConfig(
                    id=config_id,
                    key=key,
                    value=value,
                    category=category,
                    role=role,
                    description=description
                )
                db.add(new_config)
            
            await db.commit()
        
        # 更新缓存
        self._config_cache[key] = value
        return True
    
    async def get_configs_by_category(self, category: str, db: AsyncSession) -> List[DynamicConfig]:
        """根据分类获取配置"""
        result = await db.execute(
            select(DynamicConfig).where(
                DynamicConfig.category == category,
                DynamicConfig.is_active == True
            )
        )
        return result.scalars().all()
    
    async def get_configs_by_role(self, role: str, db: AsyncSession) -> List[DynamicConfig]:
        """根据角色获取配置"""
        result = await db.execute(
            select(DynamicConfig).where(
                DynamicConfig.role == role,
                DynamicConfig.is_active == True
            )
        )
        return result.scalars().all()
    
    def get_evidence_type_config(self, evidence_type: str) -> Optional[Dict[str, Any]]:
        """获取特定证据类型的配置（从YAML）"""
        evidence_config = self.load_evidence_types_config()
        return evidence_config.evidence_types.get(evidence_type)
    
    def get_all_evidence_types(self) -> Dict[str, Dict[str, Any]]:
        """获取所有证据类型配置（从YAML）"""
        evidence_config = self.load_evidence_types_config()
        return evidence_config.evidence_types
    
    def get_evidence_types_metadata(self) -> Dict[str, Any]:
        """获取证据类型配置的元数据"""
        evidence_config = self.load_evidence_types_config()
        return evidence_config.metadata
    
    def get_evidence_type_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """根据key获取证据类型配置"""
        evidence_types = self.get_all_evidence_types()
        return evidence_types.get(key)
    
    def get_evidence_type_by_type_name(self, type_name: str) -> Optional[Dict[str, Any]]:
        """根据type名称获取证据类型配置"""
        evidence_types = self.get_all_evidence_types()
        for key, config in evidence_types.items():
            if config.get("type") == type_name:
                return config
        return None
    
    def get_extraction_slots_for_evidence_type(self, evidence_type_key: str) -> List[Dict[str, Any]]:
        """获取特定证据类型的提取词槽配置"""
        evidence_type_config = self.get_evidence_type_by_key(evidence_type_key)
        if evidence_type_config:
            return evidence_type_config.get("extraction_slots", [])
        return []
    
    def get_extraction_slots_for_evidence_types(self, evidence_type_keys: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """批量获取多个证据类型的提取词槽配置"""
        evidence_types = self.get_all_evidence_types()
        result = {}
        for key in evidence_type_keys:
            config = evidence_types.get(key)
            if config:
                result[key] = config.get("extraction_slots", [])
            else:
                result[key] = []
        return result
    
    def get_extraction_slots_by_chinese_types(self, chinese_types: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """根据中文type列表批量获取提取词槽配置"""
        evidence_types = self.get_all_evidence_types()
        result = {}
        for chinese_type in chinese_types:
            # 找到对应的key
            for key, config in evidence_types.items():
                if config.get("type") == chinese_type:
                    result[chinese_type] = config.get("extraction_slots", [])
                    break
            else:
                # 如果没找到，返回空列表
                result[chinese_type] = []
        return result
    
    def get_all_extraction_slots(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取所有证据类型的提取词槽配置"""
        evidence_types = self.get_all_evidence_types()
        result = {}
        for key, config in evidence_types.items():
            result[key] = config.get("extraction_slots", [])
        return result
    
    def get_proofread_config_by_evidence_type(self, evidence_type_key: str) -> Optional[Dict[str, Any]]:
        """根据证据类型key获取校对配置"""
        evidence_type_config = self.get_evidence_type_by_key(evidence_type_key)
        if evidence_type_config:
            return evidence_type_config.get("proofread_with_case")
        return None
    
    def get_proofread_config_by_type_name(self, type_name: str) -> Optional[Dict[str, Any]]:
        """根据type名称获取校对配置"""
        evidence_type_config = self.get_evidence_type_by_type_name(type_name)
        if evidence_type_config:
            return evidence_type_config.get("proofread_with_case")
        return None
    
    def get_proofread_configs_by_chinese_types(self, chinese_types: List[str]) -> Dict[str, Optional[Dict[str, Any]]]:
        """根据中文type列表批量获取校对配置"""
        evidence_types = self.get_all_evidence_types()
        result = {}
        for chinese_type in chinese_types:
            # 找到对应的key
            for key, config in evidence_types.items():
                if config.get("type") == chinese_type:
                    result[chinese_type] = config.get("proofread_with_case")
                    break
            else:
                # 如果没找到，返回None
                result[chinese_type] = None
        return result
    
    def get_all_proofread_configs(self) -> Dict[str, Optional[Dict[str, Any]]]:
        """获取所有证据类型的校对配置"""
        evidence_types = self.get_all_evidence_types()
        result = {}
        for key, config in evidence_types.items():
            result[key] = config.get("proofread_with_case")
        return result
    
    def get_extraction_rules(self) -> Dict[str, Any]:
        """获取提取规则配置（从YAML）"""
        business_config = self.load_business_config()
        return business_config.extraction_rules
    
    def get_classification_thresholds(self) -> Dict[str, float]:
        """获取分类阈值配置（从YAML）"""
        business_config = self.load_business_config()
        return business_config.classification_thresholds
    
    # 证据链相关方法
    def get_all_evidence_chains(self) -> List[Dict[str, Any]]:
        """获取所有证据链配置"""
        chains_config = self.load_evidence_chains_config()
        return chains_config.evidence_chains
    
    def get_evidence_chains_metadata(self) -> Dict[str, Any]:
        """获取证据链配置的元数据"""
        chains_config = self.load_evidence_chains_config()
        return chains_config.metadata
    
    def get_evidence_chain_by_id(self, chain_id: str) -> Optional[Dict[str, Any]]:
        """根据ID获取特定证据链配置"""
        chains = self.get_all_evidence_chains()
        for chain in chains:
            if chain.get("chain_id") == chain_id:
                return chain
        return None
    
    def get_evidence_chains_by_case_type(self, case_type: str) -> List[Dict[str, Any]]:
        """根据案件类型获取适用的证据链"""
        chains = self.get_all_evidence_chains()
        applicable_chains = []
        
        for chain in chains:
            applicable_case_types = chain.get("applicable_case_types", [])
            if case_type in applicable_case_types:
                applicable_chains.append(chain)
        
        return applicable_chains
    
    def reload_business_config(self):
        """重新加载业务配置（清除缓存）"""
        self._business_config = None
    
    def reload_evidence_types_config(self):
        """重新加载证据类型配置（清除缓存）"""
        self._evidence_types_config = None
    
    def reload_evidence_chains_config(self):
        """重新加载证据链配置（清除缓存）"""
        self._evidence_chains_config = None
    
    def reload_dynamic_config(self):
        """重新加载动态配置（清除缓存）"""
        self._config_cache.clear()
    
    def reload_config(self):
        """重新加载所有配置"""
        self.reload_business_config()
        self.reload_evidence_types_config()
        self.reload_evidence_chains_config()
        self.reload_dynamic_config()

# 全局配置管理器实例
config_manager = ConfigManager()