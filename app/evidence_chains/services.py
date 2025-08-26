# 简化版证据链服务 - 纯粹的状态检查器（异步版本）

from typing import List, Dict, Any, Optional, Set, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.evidence_chains.schemas import (
    EvidenceChainDashboard, EvidenceChain, EvidenceTypeRequirement, EvidenceSlotDetail,
    EvidenceChainStatus, EvidenceRequirementStatus, EvidenceChainFeasibilityStatus,
    RoleBasedRequirement, RoleGroupRequirement, OrGroupRequirement
)
from app.cases.models import Case
from app.evidences.models import Evidence
from app.cases.models import AssociationEvidenceFeature
from app.core.config_manager import config_manager
from app.agentic.agents.evidence_proofreader import EvidenceProofreader


class EvidenceChainService:
    """证据链服务 - 简化版，只做状态检查（异步版本）"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_case_evidence_dashboard(self, case_id: int) -> EvidenceChainDashboard:
        """获取案件证据链看板 - 核心方法（异步版本）"""
        # 获取案件信息
        case_result = await self.db.execute(select(Case).where(Case.id == case_id))
        case = case_result.scalar_one_or_none()
        if not case:
            raise ValueError(f"案件不存在: {case_id}")
        
        # 获取案件的所有证据和特征
        evidences_result = await self.db.execute(select(Evidence).where(Evidence.case_id == case_id))
        evidences = list(evidences_result.scalars().all())
        
        # 为每个证据添加校对信息，确保使用最新的校对结果
        from app.evidences.services import enhance_evidence_with_proofreading
        enhanced_evidences = []
        for evidence in evidences:
            enhanced_evidence = await enhance_evidence_with_proofreading(evidence, self.db)
            enhanced_evidences.append(enhanced_evidence)
        
        evidences = enhanced_evidences
        
        # 设置当前证据列表，供角色检查方法使用
        self._current_evidences = evidences
        
        association_features_result = await self.db.execute(
            select(AssociationEvidenceFeature).where(AssociationEvidenceFeature.case_id == case_id)
        )
        association_features = list(association_features_result.scalars().all())
        
        # 获取适用的证据链配置
        applicable_chains = self._get_applicable_chains_for_case(case)
        

        # 检查每个证据链的状态
        chains = []
        total_requirements = 0
        satisfied_requirements = 0
        feasible_chains_count = 0
        activated_chains_count = 0
        total_feasibility_completion = 0.0
        
        for chain_config in applicable_chains:
            chain = self._check_evidence_chain_status(
                chain_config, evidences, association_features
            )
            chains.append(chain)
            
            total_requirements += len(chain.requirements)
            satisfied_requirements += len([r for r in chain.requirements if r.status == EvidenceRequirementStatus.SATISFIED])
            
            # 统计可行性相关数据
            if chain.is_feasible:
                feasible_chains_count += 1
            if chain.is_activated:
                activated_chains_count += 1
            total_feasibility_completion += chain.feasibility_completion
        
        # 计算整体完成度
        overall_completion = (satisfied_requirements / total_requirements * 100) if total_requirements > 0 else 0
        
        # 计算整体可行性完成度
        overall_feasibility_completion = (total_feasibility_completion / len(chains)) if chains else 0
        
        return EvidenceChainDashboard(
            case_id=case_id,
            chains=chains,
            overall_completion=overall_completion,
            overall_feasibility_completion=overall_feasibility_completion,
            feasible_chains_count=feasible_chains_count,
            activated_chains_count=activated_chains_count,
            total_requirements=total_requirements,
            satisfied_requirements=satisfied_requirements,
            missing_requirements=total_requirements - satisfied_requirements
        )
    
    def _get_applicable_chains_for_case(self, case: Case) -> List[Dict[str, Any]]:
        """获取适用于案件的证据链"""
        if not case.case_type:
            return []
        
        case_type_str = case.case_type.value if hasattr(case.case_type, 'value') else str(case.case_type)
        
        # 获取所有匹配案件类型的证据链
        all_chains = config_manager.get_evidence_chains_by_case_type(case_type_str)
        
        # 如果没有设置债权人和债务人类型，返回所有匹配案件类型的证据链
        if not case.creditor_type or not case.debtor_type:
            return all_chains
        
        # 将数据库枚举值映射到YAML配置中的中文值
        type_mapping = {
            'person': '个人',
            'company': '公司', 
            'individual': '个体工商户'
        }
        
        creditor_type_chinese = type_mapping.get(case.creditor_type, case.creditor_type)
        debtor_type_chinese = type_mapping.get(case.debtor_type, case.debtor_type)
        
        # 筛选匹配债权人和债务人类型的证据链
        applicable_chains = []
        for chain in all_chains:
            chain_creditor_type = chain.get('applicable_creditor_type')
            chain_debtor_type = chain.get('applicable_debtor_type')
            
            # 检查债权人和债务人类型是否匹配
            if (chain_creditor_type == creditor_type_chinese and 
                chain_debtor_type == debtor_type_chinese):
                applicable_chains.append(chain)
        
        # 添加日志记录，方便调试
        from loguru import logger
        logger.info(f"案件 {case.id} 筛选证据链: case_type={case_type_str}, "
                   f"creditor_type={case.creditor_type}->{creditor_type_chinese}, "
                   f"debtor_type={case.debtor_type}->{debtor_type_chinese}, "
                   f"总证据链数={len(all_chains)}, 适用证据链数={len(applicable_chains)}")
        
        return applicable_chains
    
    def _check_evidence_chain_status(
        self,
        chain_config: Dict[str, Any],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> EvidenceChain:
        """检查单个证据链的状态，支持"或"关系"""
        chain_id = chain_config.get("chain_id")
        if not chain_id:
            raise ValueError("证据链配置缺少chain_id")
        
        required_evidence_types = chain_config.get("required_evidence_types", [])
        
        requirements = []
        satisfied_count = 0
        
        # 处理"或"关系分组
        or_groups = self._process_or_relationships(chain_config)
        
        # 统计核心特征相关的数据
        core_requirements_count = 0  # 有核心特征要求的证据类型数量
        core_requirements_satisfied = 0  # 核心特征完备的证据类型数量
        
        # 处理"或"关系组，合并证据类型要求
        requirements = []
        satisfied_count = 0
        core_requirements_count = 0
        core_requirements_satisfied = 0
        
        # 第一遍：收集所有"或"关系组
        or_groups_processed = set()
        
        for evidence_type_config in required_evidence_types:
            or_group = evidence_type_config.get("or_group")
            

            if or_group and or_group not in or_groups_processed:
                # 处理"或"关系组，合并为一个要求
                or_group_processed = self._process_or_group_requirement(
                    or_group, 
                    [cfg for cfg in required_evidence_types if cfg.get("or_group") == or_group],
                    evidences, 
                    association_features
                )
                requirements.append(or_group_processed)
                
                # 统计
                if or_group_processed.status == EvidenceRequirementStatus.SATISFIED:
                    satisfied_count += 1
                
                # 只有有核心特征要求时才计入核心证据类型数量
                if or_group_processed.core_slots_count > 0:
                    core_requirements_count += 1
                    # 对于"或"关系组，基于状态而不是完成度百分比
                    if or_group_processed.status == EvidenceRequirementStatus.SATISFIED:
                        core_requirements_satisfied += 1
                
                or_groups_processed.add(or_group)
                
            elif not or_group:
                # 普通证据类型
                requirement = self._check_evidence_requirement_status(
                    evidence_type_config, evidences, association_features
                )
                requirements.append(requirement)
                
                if requirement.status == EvidenceRequirementStatus.SATISFIED:
                    satisfied_count += 1
                
                core_slots_config = evidence_type_config.get("core_evidence_slot", [])
                if core_slots_config and len(core_slots_config) > 0:
                    core_requirements_count += 1
                    if requirement.core_completion_percentage == 100.0:
                        core_requirements_satisfied += 1
        
        # 计算完成度
        total_count = len(requirements)
        completion_percentage = (satisfied_count / total_count * 100) if total_count > 0 else 0
        
        # 计算可行性完成度（基于证据类型级别的核心特征完备性）
        # 颗粒度：分类级别 → 链级别
        feasibility_completion = (core_requirements_satisfied / core_requirements_count * 100) if core_requirements_count > 0 else 100.0
        
        # 计算补充特征完成度（基于所有补充特征的完成情况）
        # 颗粒度：特征级别 → 链级别
        total_supplementary_slots = sum(req.supplementary_slots_count for req in requirements)
        total_supplementary_satisfied = sum(req.supplementary_slots_satisfied for req in requirements)
        supplementary_completion = (total_supplementary_satisfied / total_supplementary_slots * 100) if total_supplementary_slots > 0 else 100.0
        
        # 确定可行性状态（基于证据类型级别的完备性）
        if feasibility_completion < 100.0:
            feasibility_status = EvidenceChainFeasibilityStatus.INCOMPLETE
            is_feasible = False
            is_activated = False
        elif supplementary_completion < 100.0:
            feasibility_status = EvidenceChainFeasibilityStatus.FEASIBLE
            is_feasible = True
            is_activated = False
        else:
            feasibility_status = EvidenceChainFeasibilityStatus.ACTIVATED
            is_feasible = True
            is_activated = True
        
        # 确定证据链状态（基于总体完成度）
        if completion_percentage == 100:
            chain_status = EvidenceChainStatus.COMPLETED
        elif completion_percentage > 0:
            chain_status = EvidenceChainStatus.IN_PROGRESS
        else:
            chain_status = EvidenceChainStatus.NOT_STARTED
        
        return EvidenceChain(
            chain_id=str(chain_id),
            chain_name=str(chain_id),  # 可以从配置中获取更友好的名称
            status=chain_status,
            completion_percentage=completion_percentage,
            feasibility_status=feasibility_status,
            feasibility_completion=feasibility_completion,
            supplementary_completion=supplementary_completion,
            is_feasible=is_feasible,
            is_activated=is_activated,
            core_requirements_count=core_requirements_count,
            core_requirements_satisfied=core_requirements_satisfied,
            requirements=requirements
        )
    
    def _process_or_relationships(self, chain_config: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """处理"或"关系分组，合并槽位并判断满足状态"""
        or_groups = {}
        
        # 第一遍：收集所有"或"关系组
        for evidence_type_config in chain_config.get("required_evidence_types", []):
            or_group = evidence_type_config.get("or_group")
            if or_group:
                if or_group not in or_groups:
                    or_groups[or_group] = {
                        "evidence_types": [],
                        "core_slots": set(),  # 合并后的核心槽位
                        "satisfied": False
                    }
                or_groups[or_group]["evidence_types"].append(evidence_type_config["evidence_type"])
                # 合并核心槽位
                core_slots = evidence_type_config.get("core_evidence_slot", [])
                or_groups[or_group]["core_slots"].update(core_slots)
        
        return or_groups
    
    def _check_evidence_requirement_status(
        self,
        evidence_type_config: Dict[str, Any],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> Union[EvidenceTypeRequirement, RoleGroupRequirement]:
        """检查单个证据要求的状态"""
        evidence_type = evidence_type_config.get("evidence_type")
        if not evidence_type:
            raise ValueError("证据类型配置缺少evidence_type")
        
        core_slots = evidence_type_config.get("core_evidence_slot", [])
        
        # 检查该证据类型是否在evidence_chains.yaml中配置了role_group
        role_group = evidence_type_config.get("role_group", [])
        has_role_group = len(role_group) > 0
        
        # 如果配置了role_group，需要为每个角色创建单独的要求
        if has_role_group:
            return self._process_role_based_evidence_requirement(
                evidence_type, core_slots, role_group, evidences, association_features
            )
        
        # 原有的处理逻辑（没有role_group的情况）
        slot_details = []
        
        # 从配置文件获取该证据类型的所有槽位
        config_slots = []
        try:
            from app.core.config_manager import config_manager
            evidence_type_config_full = config_manager.get_evidence_type_by_type_name(str(evidence_type))
            if evidence_type_config_full and "extraction_slots" in evidence_type_config_full:
                config_slots = evidence_type_config_full["extraction_slots"]
        except Exception as e:
            # 如果获取配置失败，记录日志但继续执行
            print(f"获取证据类型 {evidence_type} 的配置失败: {e}")
        
        # 收集所有可能的槽位（只使用配置中定义的槽位，避免数据污染）
        all_slots = set()
        
        # 只添加配置文件中定义的且slot_required=true的槽位
        for slot_config in config_slots:
            slot_name = slot_config.get("slot_name")
            slot_required = slot_config.get("slot_required", True)  # 默认为True
            if slot_name and slot_required:  # 只添加slot_required=true的槽位
                all_slots.add(slot_name)
        
        # 添加配置中的核心槽位（如果不在配置槽位中且slot_required=true）
        for core_slot in core_slots:
            # 检查核心槽位是否在配置中且slot_required=true
            core_slot_config = next((slot for slot in config_slots if slot.get("slot_name") == core_slot), None)
            if core_slot_config and core_slot_config.get("slot_required", True):
                all_slots.add(core_slot)
        
        # 不再从实际证据和关联证据中收集槽位，只使用配置中定义的
        # 这样可以避免数据污染，确保每个证据类型只包含其配置中定义的槽位
        
        # 从实际证据中收集槽位值（但不添加新的槽位名称）
        # 从关联证据特征中收集槽位值（但不添加新的槽位名称）
        
        # 按证据实例分组统计槽位
        evidence_slot_groups = {}  # evidence_id -> {slot_name -> feature_data}
        association_slot_groups = {}  # group_name -> {slot_name -> feature_data}
        
        # 检查普通证据，按证据实例分组
        for evidence in evidences:
            if self._is_evidence_matching_type(evidence, str(evidence_type)):
                if evidence.evidence_features:
                    evidence_slot_groups[evidence.id] = {}
                    for feature in evidence.evidence_features:
                        slot_name = feature.get("slot_name")
                        if slot_name in all_slots:
                            evidence_slot_groups[evidence.id][slot_name] = {
                                "source_type": "evidence",
                                "source_id": evidence.id,
                                "confidence": feature.get("confidence", 0.0),
                                "feature_data": feature
                            }
        
        # 检查关联证据特征，按分组统计
        for assoc_feature in association_features:
            if self._is_association_feature_matching_type(assoc_feature, str(evidence_type), evidences):
                if assoc_feature.evidence_features:
                    group_name = assoc_feature.slot_group_name
                    if group_name not in association_slot_groups:
                        association_slot_groups[group_name] = {}
                    for feature in assoc_feature.evidence_features:
                        slot_name = feature.get("slot_name")
                        if slot_name in all_slots:
                            association_slot_groups[group_name][slot_name] = {
                                "source_type": "association_group",
                                "source_id": group_name,
                                "confidence": feature.get("confidence", 0.0),
                                "feature_data": feature
                            }
        
        # 选择最完整的证据实例或分组作为该证据类型的代表
        best_source = self._select_best_evidence_source(
            evidence_slot_groups, association_slot_groups, all_slots, core_slots
        )
        
        # 根据最佳源构建槽位详情
        slot_satisfaction = {}  # slot_name -> (is_satisfied, source_type, source_id, confidence)
        
        # 初始化所有槽位为未满足
        for slot in all_slots:
            slot_satisfaction[slot] = (False, None, None, None)
        
        # 使用最佳源填充槽位信息
        if best_source:
            source_type = best_source["source_type"]
            source_id = best_source["source_id"]
            slot_data = best_source["slot_data"]
            
            for slot_name in all_slots:
                if slot_name in slot_data:
                    slot_info = slot_data[slot_name]
                    feature_data = slot_info.get("feature_data", {})
                    
                    # 检查槽位是否真正满足条件（包括校对状态）
                    is_satisfied = self._is_slot_satisfied(feature_data)
                    
                    slot_satisfaction[slot_name] = (
                        is_satisfied, 
                        slot_info["source_type"], 
                        slot_info["source_id"], 
                        slot_info["confidence"]
                    )
        
        # 构建槽位详情（按核心/非核心排序）
        # 核心特征：在 evidence_chains.yaml 的 core_evidence_slot 中定义的特征
        # 补充特征：不在 core_evidence_slot 中，但在 evidence_types.yaml 中定义的特征
        
        # 检查是否是"或"关系的一部分，如果是，需要特殊处理槽位合并
        or_group = evidence_type_config.get("or_group")
        core_slot_details = []
        non_core_slot_details = []
        
        for slot in all_slots:
            is_satisfied, source_type, source_id, confidence = slot_satisfaction.get(slot, (False, None, None, None))
            # 判断是否是核心特征：基于 evidence_chains.yaml 配置，不是 slot_required
            is_core = slot in core_slots
            
            # 获取校对信息
            slot_proofread_at = None
            slot_is_consistent = None
            slot_expected_value = None
            slot_proofread_reasoning = None
            
            # 从最佳源中获取校对信息
            if best_source and slot in best_source["slot_data"]:
                slot_info = best_source["slot_data"][slot]
                feature_data = slot_info.get("feature_data", {})
                slot_proofread_at = feature_data.get("slot_proofread_at")
                slot_is_consistent = feature_data.get("slot_is_consistent")
                slot_expected_value = feature_data.get("slot_expected_value")
                slot_proofread_reasoning = feature_data.get("slot_proofread_reasoning")
                
                # 调试：检查校对信息是否正确提取
                if slot == "债务人脱敏真名" or slot == "转账账户真名":
                    evidence_role = getattr(evidence, 'evidence_role', 'unknown') if best_source["source_type"] == "evidence" else "association_group"
                    print(f"字段 {slot} 校对信息: proofread_at={slot_proofread_at}, consistent={slot_is_consistent}, expected={slot_expected_value}, role={evidence_role}")
                    print(f"完整feature_data: {feature_data}")
                

            
            slot_detail = EvidenceSlotDetail(
                slot_name=slot,
                is_satisfied=is_satisfied,
                is_core=is_core,
                source_type=source_type or "none",
                source_id=source_id,
                confidence=confidence,
                slot_proofread_at=slot_proofread_at,
                slot_is_consistent=slot_is_consistent,
                slot_expected_value=slot_expected_value,
                slot_proofread_reasoning=slot_proofread_reasoning
            )
            
            if is_core:
                core_slot_details.append(slot_detail)
            else:
                non_core_slot_details.append(slot_detail)
        
        # 核心槽位在前，非核心槽位在后
        slot_details = core_slot_details + non_core_slot_details
        
        # 计算核心特征和补充特征的完成情况
        # 注意：这里的"核心"和"补充"是基于 evidence_chains.yaml 中的 core_evidence_slot 配置
        # 与 evidence_types.yaml 中的 slot_required 是不同的概念：
        # - slot_required: 特征提取时是否必须
        # - core_evidence_slot: 在证据链中是否为核心特征
        core_slots_count = len(core_slot_details)
        core_slots_satisfied = sum(1 for slot in core_slot_details if slot.is_satisfied)
        supplementary_slots_count = len(non_core_slot_details)
        supplementary_slots_satisfied = sum(1 for slot in non_core_slot_details if slot.is_satisfied)
        
        # 完成度计算：校对不通过的特征也会影响完成度
        core_completion_percentage = (core_slots_satisfied / core_slots_count * 100) if core_slots_count > 0 else 100.0
        supplementary_completion_percentage = (supplementary_slots_satisfied / supplementary_slots_count * 100) if supplementary_slots_count > 0 else 100.0
        
        # 调试：检查完成度计算
        print(f"证据类型 {evidence_type} 完成度: 核心={core_slots_satisfied}/{core_slots_count} ({core_completion_percentage:.1f}%), 补充={supplementary_slots_satisfied}/{supplementary_slots_count} ({supplementary_completion_percentage:.1f}%)")
        
        # 确定状态（只基于核心槽位，且slot_required=true）
        # 过滤核心槽位，只保留slot_required=true的
        filtered_core_slots = [slot for slot in core_slots if slot in all_slots]
        core_satisfied_count = sum(1 for slot in filtered_core_slots if slot_satisfaction.get(slot, (False, None, None, None))[0])
        
        # 判断是否有匹配的证据（用于确定 MISSING 状态）
        has_matching_evidence = any(
            self._is_evidence_matching_type(evidence, str(evidence_type)) for evidence in evidences
        ) or any(
            self._is_association_feature_matching_type(assoc_feature, str(evidence_type), evidences) 
            for assoc_feature in association_features
        )
        
        if not has_matching_evidence:
            status = EvidenceRequirementStatus.MISSING
        elif len(filtered_core_slots) == 0:  # 没有核心槽位的证据类型（如身份证）
            # 对于没有核心槽位的证据类型，检查是否有任何槽位未满足
            all_satisfied = all(slot_satisfaction.get(slot, (False, None, None, None))[0] for slot in all_slots)
            if all_satisfied and len(all_slots) > 0:
                status = EvidenceRequirementStatus.SATISFIED
            elif any(slot_satisfaction.get(slot, (False, None, None, None))[0] for slot in all_slots):
                status = EvidenceRequirementStatus.PARTIAL
            else:
                status = EvidenceRequirementStatus.MISSING
        elif core_satisfied_count == len(filtered_core_slots):
            status = EvidenceRequirementStatus.SATISFIED
        else:
            status = EvidenceRequirementStatus.PARTIAL
        
        return EvidenceTypeRequirement(
            evidence_type=str(evidence_type),
            status=status,
            slots=slot_details,
            core_slots_count=core_slots_count,
            core_slots_satisfied=core_slots_satisfied,
            supplementary_slots_count=supplementary_slots_count,
            supplementary_slots_satisfied=supplementary_slots_satisfied,
            core_completion_percentage=core_completion_percentage,
            supplementary_completion_percentage=supplementary_completion_percentage
        )
    
    def _is_evidence_matching_type(self, evidence: Evidence, required_type: str) -> bool:
        """判断证据是否匹配要求的类型"""
        if not evidence.classification_category:
            return False
        
        # 严格的类型匹配，避免跨类型污染
        evidence_category = evidence.classification_category.lower().strip()
        required_type_lower = required_type.lower().strip()
        
        # 直接相等匹配
        if evidence_category == required_type_lower:
            return True
        
        # 对于特殊情况，使用精确的映射关系
        type_mapping = {
            "身份证": ["身份证", "居民身份证"],
            "中华人民共和国居民户籍档案": ["中华人民共和国居民户籍档案", "户籍档案", "户口簿"],
            "公司营业执照": ["公司营业执照", "营业执照"],
            "个体工商户营业执照": ["个体工商户营业执照", "个体户营业执照"],
            "公司全国企业公示系统截图": ["公司全国企业公示系统截图", "企业公示系统"],
            "个体工商户全国企业公示系统截图": ["个体工商户全国企业公示系统截图", "个体户公示系统"],
            "经常居住地证明": ["经常居住地证明", "居住证明"],
            "微信聊天记录": ["微信聊天记录", "微信聊天"],
            "微信个人主页": ["微信个人主页", "微信主页"],
            "微信支付转账电子凭证": ["微信支付转账电子凭证", "微信支付凭证"],
            "微信转账页面": ["微信转账页面", "微信转账"],
            "短信聊天记录": ["短信聊天记录", "短信"],
            "支付宝转账页面": ["支付宝转账页面", "支付宝转账"],
            "货款欠条": ["货款欠条", "欠条"],
            "借款借条": ["借款借条", "借条"],
            "银行转账记录": ["银行转账记录", "银行转账"],
            "增值税发票": ["增值税发票", "发票"],
            "电话号码截图": ["电话号码截图", "电话号码"],
            "收款银行账户截图": ["收款银行账户截图", "银行账户"]
        }
        
        # 检查映射关系
        if required_type_lower in type_mapping:
            return evidence_category in type_mapping[required_type_lower]
        
        # 如果没有映射关系，使用严格的包含匹配（避免跨类型污染）
        # 只有当required_type是evidence_category的子字符串时才匹配
        return required_type_lower in evidence_category
    
    def _process_or_group_requirement(
        self,
        or_group_name: str,
        evidence_type_configs: List[Dict[str, Any]],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> OrGroupRequirement:
        """处理"或"关系组，构建正确的嵌套结构
        
        新的设计：
        1. 外层：or_group（身份证 或 户籍档案）
        2. 内层：每个证据类型内部是role_group（债权人 和 债务人）
        3. 每个role_group内部是具体的角色要求
        """
        print(f"处理or_group: {or_group_name}，构建嵌套结构")
        
        sub_groups = []
        total_core_slots = 0
        total_core_satisfied = 0
        total_supplementary_slots = 0
        total_supplementary_satisfied = 0
        
        # 处理每个证据类型
        for config in evidence_type_configs:
            evidence_type = config.get("evidence_type")
            if evidence_type:
                # 检查是否有角色要求 - 使用evidence_chains.yaml中的role_group配置
                role_group = config.get("role_group", [])
                has_role_requirements = len(role_group) > 0
                
                if has_role_requirements:
                    # 有角色要求：创建role_group
                    role_group_requirement = self._create_role_group_requirement(
                        evidence_type, role_group, evidences, association_features
                    )
                    sub_groups.append(role_group_requirement)
                    
                    # 统计总数
                    total_core_slots += role_group_requirement.core_slots_count
                    total_core_satisfied += role_group_requirement.core_slots_satisfied
                    total_supplementary_slots += role_group_requirement.supplementary_slots_count
                    total_supplementary_satisfied += role_group_requirement.supplementary_slots_satisfied
                else:
                    # 没有角色要求：创建普通证据类型要求
                    requirement = self._check_evidence_requirement_status(
                        config, evidences, association_features
                    )
                    sub_groups.append(requirement)
                    
                    # 统计总数
                    total_core_slots += requirement.core_slots_count
                    total_core_satisfied += requirement.core_slots_satisfied
                    total_supplementary_slots += requirement.supplementary_slots_count
                    total_supplementary_satisfied += requirement.supplementary_slots_satisfied
        
        # 计算完成度百分比
        core_completion_percentage = (total_core_satisfied / total_core_slots * 100) if total_core_slots > 0 else 100.0
        supplementary_completion_percentage = (total_supplementary_satisfied / total_supplementary_slots * 100) if total_supplementary_slots > 0 else 100.0
        
        # 确定状态：or_group逻辑（满足其一即可）
        if any(group.status == EvidenceRequirementStatus.SATISFIED for group in sub_groups):
            status = EvidenceRequirementStatus.SATISFIED
        elif any(group.status == EvidenceRequirementStatus.PARTIAL for group in sub_groups):
            status = EvidenceRequirementStatus.PARTIAL
        else:
            status = EvidenceRequirementStatus.MISSING
        
        # 生成组合名称
        evidence_type_names = [config.get("evidence_type", "") for config in evidence_type_configs if config.get("evidence_type")]
        combined_name = " 或 ".join(evidence_type_names)
        
        return OrGroupRequirement(
            evidence_type=combined_name,
            type="or_group",
            sub_groups=sub_groups,
            status=status,
            core_slots_count=total_core_slots,
            core_slots_satisfied=total_core_satisfied,
            supplementary_slots_count=total_supplementary_slots,
            supplementary_slots_satisfied=total_supplementary_satisfied,
            core_completion_percentage=core_completion_percentage,
            supplementary_completion_percentage=supplementary_completion_percentage
        )
    
    def _create_role_group_requirement(
        self,
        evidence_type: str,
        supported_roles: List[str],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> RoleGroupRequirement:
        """创建角色组要求"""
        print(f"创建角色组要求: {evidence_type}，角色: {supported_roles}")
        
        sub_requirements = []
        total_core_slots = 0
        total_core_satisfied = 0
        total_supplementary_slots = 0
        total_supplementary_satisfied = 0
        
        # 为每个角色创建要求
        for role in supported_roles:
            role_requirement = self._create_role_based_requirement(
                evidence_type, role, evidences, association_features
            )
            sub_requirements.append(role_requirement)
            
            # 统计总数
            total_core_slots += role_requirement.core_slots_count
            total_core_satisfied += role_requirement.core_slots_satisfied
            total_supplementary_slots += role_requirement.supplementary_slots_count
            total_supplementary_satisfied += role_requirement.supplementary_slots_satisfied
        
        # 计算完成度百分比
        core_completion_percentage = (total_core_satisfied / total_core_slots * 100) if total_core_slots > 0 else 100.0
        supplementary_completion_percentage = (total_supplementary_satisfied / total_supplementary_slots * 100) if total_supplementary_slots > 0 else 100.0
        
        # 确定状态：role_group逻辑（所有角色都需要满足）
        if all(req.status == EvidenceRequirementStatus.SATISFIED for req in sub_requirements):
            status = EvidenceRequirementStatus.SATISFIED
        elif any(req.status == EvidenceRequirementStatus.PARTIAL for req in sub_requirements):
            status = EvidenceRequirementStatus.PARTIAL
        else:
            status = EvidenceRequirementStatus.MISSING
        
        return RoleGroupRequirement(
            evidence_type=evidence_type,
            type="role_group",
            roles=supported_roles,
            status=status,
            sub_requirements=sub_requirements,
            core_slots_count=total_core_slots,
            core_slots_satisfied=total_core_satisfied,
            supplementary_slots_count=total_supplementary_slots,
            supplementary_slots_satisfied=total_supplementary_satisfied,
            core_completion_percentage=core_completion_percentage,
            supplementary_completion_percentage=supplementary_completion_percentage
        )
    
    def _create_role_based_requirement(
        self,
        evidence_type: str,
        role: str,
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> RoleBasedRequirement:
        """创建基于角色的证据要求"""
        print(f"创建基于角色的要求: {evidence_type} ({role})")
        
        # 角色名称映射
        role_name_mapping = {
            "creditor": "债权人",
            "debtor": "债务人"
        }
        role_name_cn = role_name_mapping.get(role, role)
        
        # 构建证据类型名称
        evidence_type_with_role = f"{evidence_type} ({role_name_cn})"
        
        # 获取该证据类型的配置
        try:
            from app.core.config_manager import config_manager
            evidence_type_config_full = config_manager.get_evidence_type_by_type_name(str(evidence_type))
            if evidence_type_config_full and "extraction_slots" in evidence_type_config_full:
                extraction_slots = evidence_type_config_full["extraction_slots"]
                
                # 查找该角色的证据
                role_evidences = [e for e in evidences if self._is_evidence_matching_type(e, str(evidence_type)) and getattr(e, 'evidence_role', None) == role]
                print(f"找到角色 {role} 的证据数量: {len(role_evidences)}")
                
                # 创建槽位详情
                slots = []
                core_slots_count = 0
                core_slots_satisfied = 0
                supplementary_slots_count = 0
                supplementary_slots_satisfied = 0
                
                if role_evidences:
                    # 有证据：选择最好的证据来填充槽位信息
                    all_slots_set = set(slot.get("slot_name", "") for slot in extraction_slots)
                    best_evidence = self._select_best_evidence_for_role(role_evidences, all_slots_set, [])
                    
                    if best_evidence:
                        for slot_config in extraction_slots:
                            slot_name = slot_config.get("slot_name", "")
                            if slot_name:
                                # 从最佳证据中获取槽位信息
                                slot_info = self._get_slot_info_from_evidence(best_evidence, slot_name)
                                
                                slot_detail = EvidenceSlotDetail(
                                    slot_name=slot_name,
                                    is_satisfied=slot_info["is_satisfied"],
                                    is_core=False,  # 身份证和户籍档案没有核心特征
                                    source_type="evidence",
                                    source_id=best_evidence.id,
                                    confidence=slot_info["confidence"],
                                    slot_proofread_at=slot_info["slot_proofread_at"],
                                    slot_is_consistent=slot_info["slot_is_consistent"],
                                    slot_expected_value=slot_info["slot_expected_value"],
                                    slot_proofread_reasoning=slot_info["slot_proofread_reasoning"]
                                )
                                
                                slots.append(slot_detail)
                                
                                # 统计满足的槽位
                                if slot_detail.is_satisfied:
                                    supplementary_slots_satisfied += 1
                                supplementary_slots_count += 1
                else:
                    # 没有证据：创建空的槽位
                    for slot_config in extraction_slots:
                        slot_name = slot_config.get("slot_name", "")
                        if slot_name:
                            slot_detail = EvidenceSlotDetail(
                                slot_name=slot_name,
                                is_satisfied=False,
                                is_core=False,
                                source_type="none",
                                source_id=None,
                                confidence=None,
                                slot_proofread_at=None,
                                slot_is_consistent=None,
                                slot_expected_value=None,
                                slot_proofread_reasoning=None
                            )
                            
                            slots.append(slot_detail)
                            supplementary_slots_count += 1
                
                # 计算完成度百分比
                supplementary_completion_percentage = (supplementary_slots_satisfied / supplementary_slots_count * 100) if supplementary_slots_count > 0 else 100.0
                
                # 确定状态
                if supplementary_slots_satisfied == supplementary_slots_count and supplementary_slots_count > 0:
                    status = EvidenceRequirementStatus.SATISFIED
                elif supplementary_slots_satisfied > 0:
                    status = EvidenceRequirementStatus.PARTIAL
                else:
                    status = EvidenceRequirementStatus.MISSING
                
                return RoleBasedRequirement(
                    evidence_type=evidence_type_with_role,
                    role=role,
                    status=status,
                    slots=slots,
                    core_slots_count=core_slots_count,
                    core_slots_satisfied=core_slots_satisfied,
                    supplementary_slots_count=supplementary_slots_count,
                    supplementary_slots_satisfied=supplementary_slots_satisfied,
                    core_completion_percentage=100.0 if core_slots_count == 0 else 0.0,
                    supplementary_completion_percentage=supplementary_completion_percentage
                )
        except Exception as e:
            print(f"创建基于角色的要求失败: {e}")
        
        # 如果出错，返回空的角色要求
        return RoleBasedRequirement(
            evidence_type=evidence_type_with_role,
            role=role,
            status=EvidenceRequirementStatus.MISSING,
            slots=[],
            core_slots_count=0,
            core_slots_satisfied=0,
            supplementary_slots_count=0,
            supplementary_slots_satisfied=0,
            core_completion_percentage=100.0,
            supplementary_completion_percentage=100.0
        )
    
    def _process_role_based_evidence_requirement(
        self,
        evidence_type: str,
        core_slots: List[str],
        supported_roles: List[str],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> RoleGroupRequirement:
        """处理基于角色的证据要求，返回RoleGroupRequirement结构"""
        
        # 从配置文件获取该证据类型的所有槽位
        config_slots = []
        try:
            from app.core.config_manager import config_manager
            evidence_type_config_full = config_manager.get_evidence_type_by_type_name(str(evidence_type))
            if evidence_type_config_full and "extraction_slots" in evidence_type_config_full:
                config_slots = evidence_type_config_full["extraction_slots"]
        except Exception as e:
            print(f"获取证据类型 {evidence_type} 的配置失败: {e}")
        
        # 收集所有可能的槽位
        all_slots = set()
        for slot_config in config_slots:
            slot_name = slot_config.get("slot_name")
            slot_required = slot_config.get("slot_required", True)
            if slot_name and slot_required:
                all_slots.add(slot_name)
        
        # 添加配置中的核心槽位
        for core_slot in core_slots:
            core_slot_config = next((slot for slot in config_slots if slot.get("slot_name") == core_slot), None)
            if core_slot_config and core_slot_config.get("slot_required", True):
                all_slots.add(core_slot)
        
        # 为每个角色创建要求
        sub_requirements = []
        total_core_slots = 0
        total_core_satisfied = 0
        total_supplementary_slots = 0
        total_supplementary_satisfied = 0
        
        # 角色名称映射
        role_name_mapping = {
            "creditor": "债权人",
            "debtor": "债务人"
        }
        
        for role in supported_roles:
            # 查找该角色的证据
            role_evidences = [e for e in evidences if self._is_evidence_matching_type(e, str(evidence_type)) and getattr(e, 'evidence_role', None) == role]
            
            if role_evidences:
                # 选择该角色中最好的证据
                best_evidence = self._select_best_evidence_for_role(role_evidences, all_slots, core_slots)
                
                if best_evidence:
                    # 为该角色的每个槽位创建详情
                    role_slots = []
                    role_core_slots_satisfied = 0
                    role_supplementary_slots_satisfied = 0
                    
                    for slot_name in all_slots:
                        is_core = slot_name in core_slots
                        
                        # 从最佳证据中获取槽位信息
                        slot_info = self._get_slot_info_from_evidence(best_evidence, slot_name)
                        
                        # 创建槽位详情，包含中文角色信息
                        slot_detail = EvidenceSlotDetail(
                            slot_name=f"{slot_name}",
                            is_satisfied=slot_info["is_satisfied"],
                            is_core=is_core,
                            source_type="evidence",
                            source_id=best_evidence.id,
                            confidence=slot_info["confidence"],
                            slot_proofread_at=slot_info["slot_proofread_at"],
                            slot_is_consistent=slot_info["slot_is_consistent"],
                            slot_expected_value=slot_info["slot_expected_value"],
                            slot_proofread_reasoning=slot_info["slot_proofread_reasoning"]
                        )
                        
                        role_slots.append(slot_detail)
                        
                        # 统计满足的槽位
                        if is_core and slot_info["is_satisfied"]:
                            role_core_slots_satisfied += 1
                        elif not is_core and slot_info["is_satisfied"]:
                            role_supplementary_slots_satisfied += 1
                    
                    # 计算该角色的完成度
                    role_core_slots_count = len([slot for slot in role_slots if slot.is_core])
                    role_supplementary_slots_count = len([slot for slot in role_slots if not slot.is_core])
                    
                    role_core_completion_percentage = (role_core_slots_satisfied / role_core_slots_count * 100) if role_core_slots_count > 0 else 100.0
                    role_supplementary_completion_percentage = (role_supplementary_slots_satisfied / role_supplementary_slots_count * 100) if role_supplementary_slots_count > 0 else 100.0
                    
                    # 确定该角色的状态
                    if role_core_slots_count > 0:
                        if role_core_slots_satisfied == role_core_slots_count:
                            role_status = EvidenceRequirementStatus.SATISFIED
                        elif role_core_slots_satisfied > 0:
                            role_status = EvidenceRequirementStatus.PARTIAL
                        else:
                            role_status = EvidenceRequirementStatus.MISSING
                    else:
                        if role_supplementary_slots_satisfied == role_supplementary_slots_count and role_supplementary_slots_count > 0:
                            role_status = EvidenceRequirementStatus.SATISFIED
                        elif role_supplementary_slots_satisfied > 0:
                            role_status = EvidenceRequirementStatus.PARTIAL
                        else:
                            role_status = EvidenceRequirementStatus.MISSING
                    
                    # 创建该角色的要求
                    role_requirement = RoleBasedRequirement(
                        evidence_type=evidence_type,  # 移除重复的角色说明
                        role=role,
                        status=role_status,
                        slots=role_slots,
                        core_slots_count=role_core_slots_count,
                        core_slots_satisfied=role_core_slots_satisfied,
                        supplementary_slots_count=role_supplementary_slots_count,
                        supplementary_slots_satisfied=role_supplementary_slots_satisfied,
                        core_completion_percentage=role_core_completion_percentage,
                        supplementary_completion_percentage=role_supplementary_completion_percentage
                    )
                    
                    sub_requirements.append(role_requirement)
                    
                    # 统计总数
                    total_core_slots += role_core_slots_count
                    total_core_satisfied += role_core_slots_satisfied
                    total_supplementary_slots += role_supplementary_slots_count
                    total_supplementary_satisfied += role_supplementary_slots_satisfied
                    
                else:
                    # 如果没有找到最佳证据，创建空的角色要求
                    role_slots = []
                    for slot_name in all_slots:
                        is_core = slot_name in core_slots
                        slot_detail = EvidenceSlotDetail(
                            slot_name=f"{slot_name}",
                            is_satisfied=False,
                            is_core=is_core,
                            source_type="none",
                            source_id=None,
                            confidence=None,
                            slot_proofread_at=None,
                            slot_is_consistent=None,
                            slot_expected_value=None,
                            slot_proofread_reasoning=None
                        )
                        role_slots.append(slot_detail)
                    
                    role_core_slots_count = len([slot for slot in role_slots if slot.is_core])
                    role_supplementary_slots_count = len([slot for slot in role_slots if not slot.is_core])
                    
                    role_requirement = RoleBasedRequirement(
                        evidence_type=evidence_type,
                        role=role,
                        status=EvidenceRequirementStatus.MISSING,
                        slots=role_slots,
                        core_slots_count=role_core_slots_count,
                        core_slots_satisfied=0,
                        supplementary_slots_count=role_supplementary_slots_count,
                        supplementary_slots_satisfied=0,
                        core_completion_percentage=100.0 if role_core_slots_count == 0 else 0.0,
                        supplementary_completion_percentage=100.0 if role_supplementary_slots_count == 0 else 0.0
                    )
                    
                    sub_requirements.append(role_requirement)
                    
                    # 统计总数
                    total_core_slots += role_core_slots_count
                    total_supplementary_slots += role_supplementary_slots_count
            else:
                # 如果没有该角色的证据，创建空的角色要求
                role_slots = []
                for slot_name in all_slots:
                    is_core = slot_name in core_slots
                    slot_detail = EvidenceSlotDetail(
                        slot_name=f"{slot_name}",
                        is_satisfied=False,
                        is_core=is_core,
                        source_type="none",
                        source_id=None,
                        confidence=None,
                        slot_proofread_at=None,
                        slot_is_consistent=None,
                        slot_expected_value=None,
                        slot_proofread_reasoning=None
                    )
                    role_slots.append(slot_detail)
                
                role_core_slots_count = len([slot for slot in role_slots if slot.is_core])
                role_supplementary_slots_count = len([slot for slot in role_slots if not slot.is_core])
                
                role_requirement = RoleBasedRequirement(
                    evidence_type=evidence_type,
                    role=role,
                    status=EvidenceRequirementStatus.MISSING,
                    slots=role_slots,
                    core_slots_count=role_core_slots_count,
                    core_slots_satisfied=0,
                    supplementary_slots_count=role_supplementary_slots_count,
                    supplementary_slots_satisfied=0,
                    core_completion_percentage=100.0 if role_core_slots_count == 0 else 0.0,
                    supplementary_completion_percentage=100.0 if role_supplementary_slots_count == 0 else 0.0
                )
                
                sub_requirements.append(role_requirement)
                
                # 统计总数
                total_core_slots += role_core_slots_count
                total_supplementary_slots += role_supplementary_slots_count
        
        # 计算完成度百分比
        core_completion_percentage = (total_core_satisfied / total_core_slots * 100) if total_core_slots > 0 else 100.0
        supplementary_completion_percentage = (total_supplementary_satisfied / total_supplementary_slots * 100) if total_supplementary_slots > 0 else 100.0
        
        # 确定状态：role_group逻辑（所有角色都需要满足）
        if all(req.status == EvidenceRequirementStatus.SATISFIED for req in sub_requirements):
            status = EvidenceRequirementStatus.SATISFIED
        elif any(req.status == EvidenceRequirementStatus.PARTIAL for req in sub_requirements):
            status = EvidenceRequirementStatus.PARTIAL
        else:
            status = EvidenceRequirementStatus.MISSING
        
        return RoleGroupRequirement(
            evidence_type=evidence_type,
            type="role_group",
            roles=supported_roles,
            status=status,
            sub_requirements=sub_requirements,
            core_slots_count=total_core_slots,
            core_slots_satisfied=total_core_satisfied,
            supplementary_slots_count=total_supplementary_slots,
            supplementary_slots_satisfied=total_supplementary_satisfied,
            core_completion_percentage=core_completion_percentage,
            supplementary_completion_percentage=supplementary_completion_percentage
        )
    
    def _get_slot_proofread_info(self, best_source: Dict[str, Any], slot_name: str) -> tuple:
        """获取槽位的校对信息"""
        slot_proofread_at = None
        slot_is_consistent = None
        slot_expected_value = None
        slot_proofread_reasoning = None
        
        if best_source and slot_name in best_source["slot_data"]:
            slot_info = best_source["slot_data"][slot_name]
            feature_data = slot_info.get("feature_data", {})
            slot_proofread_at = feature_data.get("slot_proofread_at")
            slot_is_consistent = feature_data.get("slot_is_consistent")
            slot_expected_value = feature_data.get("slot_expected_value")
            slot_proofread_reasoning = feature_data.get("slot_proofread_reasoning")
        
        return slot_proofread_at, slot_is_consistent, slot_expected_value, slot_proofread_reasoning
    
    def _is_association_feature_matching_type(
        self, 
        assoc_feature: AssociationEvidenceFeature, 
        required_type: str, 
        evidences: List[Evidence]
    ) -> bool:
        """判断关联证据特征是否与要求的证据类型匹配"""
        # 检查关联证据特征的来源证据是否与当前证据类型匹配
        for evidence_id in assoc_feature.association_evidence_ids:
            for evidence in evidences:
                if evidence.id == evidence_id:
                    if self._is_evidence_matching_type(evidence, required_type):
                        return True
        return False
    
    def _is_slot_satisfied(self, feature: Dict[str, Any]) -> bool:
        """判断槽位是否真正满足条件
        
        满足条件：
        1. 槽位值不是"未知"且不为空
        2. 如果有校对信息，必须校对成功(slot_is_consistent=True)
        
        注意：校对失败的特征不被认为是满足的，但可能在证据选择时被优先考虑
        """
        slot_value = feature.get("slot_value", "")
        
        # 检查是否有值（不是"未知"且不为空）
        has_value = slot_value != "未知" and str(slot_value).strip() != ""
        if not has_value:
            return False
        
        # 检查校对信息
        slot_proofread_at = feature.get("slot_proofread_at")
        if slot_proofread_at:  # 如果有校对信息
            slot_is_consistent = feature.get("slot_is_consistent", False)
            if not slot_is_consistent:  # 校对不通过
                return False
        
        return True
    
    def _select_best_evidence_source(
        self,
        evidence_slot_groups: Dict[int, Dict[str, Dict[str, Any]]],
        association_slot_groups: Dict[str, Dict[str, Dict[str, Any]]],
        all_slots: set,
        core_slots: List[str]
    ) -> Optional[Dict[str, Any]]:
        """选择最完整的证据实例或分组作为该证据类型的代表
        
        选择策略（按优先级排序）：
        1. 优先选择校对通过的证据 (slot_is_consistent=True)
        2. 其次选择无校对动作的证据 (slot_proofread_at=None)
        3. 最后选择校对失败的证据 (slot_is_consistent=False)
        4. 在相同校对状态下，优先选择角色匹配的证据（如果配置了supported_roles）
        5. 在相同角色匹配状态下，优先选择核心槽位完成度最高的源
        6. 在相同完成度下，优先选择最新的证据（基于时间戳）
        """
        best_source = None
        best_score = -1
        best_proofread_status = -1  # -1: 无校对, 0: 校对失败, 1: 校对通过
        best_role_match = False  # 是否角色匹配
        
        # 评估证据实例
        for evidence_id, slot_data in evidence_slot_groups.items():
            score, proofread_status = self._calculate_source_score_with_proofread(slot_data, all_slots, core_slots)
            
            # 检查角色匹配（如果证据有角色信息）
            role_match = self._check_evidence_role_match(evidence_id, slot_data)
            
            # 优先选择校对状态更好的证据，在相同校对状态下优先选择角色匹配的
            should_update = False
            if proofread_status > best_proofread_status:
                should_update = True
            elif proofread_status == best_proofread_status:
                if role_match and not best_role_match:
                    should_update = True
                elif role_match == best_role_match and score > best_score:
                    should_update = True
            
            if should_update:
                best_score = score
                best_proofread_status = proofread_status
                best_role_match = role_match
                best_source = {
                    "source_type": "evidence",
                    "source_id": evidence_id,
                    "slot_data": slot_data,
                    "score": score,
                    "proofread_status": proofread_status,
                    "role_match": role_match
                }
        
        # 评估关联证据分组
        for group_name, slot_data in association_slot_groups.items():
            score, proofread_status = self._calculate_source_score_with_proofread(slot_data, all_slots, core_slots)
            
            # 关联证据分组通常没有角色信息，默认为False
            role_match = False
            
            # 优先选择校对状态更好的证据，在相同校对状态下优先选择角色匹配的
            should_update = False
            if proofread_status > best_proofread_status:
                should_update = True
            elif proofread_status == best_proofread_status:
                if role_match and not best_role_match:
                    should_update = True
                elif role_match == best_role_match and score > best_score:
                    should_update = True
            
            if should_update:
                best_score = score
                best_proofread_status = proofread_status
                best_role_match = role_match
                best_source = {
                    "source_type": "association_group",
                    "source_id": group_name,
                    "slot_data": slot_data,
                    "score": score,
                    "proofread_status": proofread_status,
                    "role_match": role_match
                }
        
        return best_source
    
    def _calculate_source_score(
        self,
        slot_data: Dict[str, Dict[str, Any]],
        all_slots: set,
        core_slots: List[str]
    ) -> float:
        """计算源的评分（保持向后兼容）
        
        评分规则：
        1. 核心槽位完成度权重：70%
        2. 总体槽位完成度权重：20%
        3. 平均置信度权重：10%
        
        注意：此方法主要用于向后兼容，新的逻辑使用 _calculate_source_score_with_proofread
        """
        if not slot_data:
            return 0.0
        
        # 计算核心槽位完成度
        core_slots_count = len(core_slots)
        core_slots_satisfied = sum(1 for slot in core_slots if slot in slot_data)
        core_completion = (core_slots_satisfied / core_slots_count * 100) if core_slots_count > 0 else 100.0
        
        # 计算总体槽位完成度
        total_slots_count = len(all_slots)
        total_slots_satisfied = len(slot_data)
        total_completion = (total_slots_satisfied / total_slots_count * 100) if total_slots_count > 0 else 100.0
        
        # 计算平均置信度
        confidences = [slot_info.get("confidence", 0.0) for slot_info in slot_data.values()]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        # 加权计算总分
        score = (core_completion * 0.7) + (total_completion * 0.2) + (avg_confidence * 0.1)
        
        return score

    def _calculate_source_score_with_proofread(
        self,
        slot_data: Dict[str, Dict[str, Any]],
        all_slots: set,
        core_slots: List[str]
    ) -> tuple[float, int]:
        """计算源的评分，并返回校对状态"""
        if not slot_data:
            return 0.0, -1 # 无校对
        
        # 计算核心槽位完成度
        core_slots_count = len(core_slots)
        core_slots_satisfied = sum(1 for slot in core_slots if slot in slot_data)
        core_completion = (core_slots_satisfied / core_slots_count * 100) if core_slots_count > 0 else 100.0
        
        # 计算总体槽位完成度
        total_slots_count = len(all_slots)
        total_slots_satisfied = len(slot_data)
        total_completion = (total_slots_satisfied / total_slots_count * 100) if total_slots_count > 0 else 100.0
        
        # 计算平均置信度
        confidences = [slot_info.get("confidence", 0.0) for slot_info in slot_data.values()]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        # 加权计算总分
        score = (core_completion * 0.7) + (total_completion * 0.2) + (avg_confidence * 0.1)
        
        # 使用新的校对状态选择逻辑
        proofread_status = self._select_best_proofread_status(slot_data)
        
        return score, proofread_status
    
    def _select_best_proofread_status(self, slot_data: Dict[str, Dict[str, Any]]) -> int:
        """选择最佳的校对状态
        
        返回值：
        - 1: 校对通过 (slot_is_consistent=True)
        - 0: 校对失败 (slot_is_consistent=False)  
        - -1: 无校对动作 (slot_proofread_at=None)
        
        逻辑：优先选择校对通过的状态
        """
        if not slot_data:
            return -1
        
        best_status = -1  # 默认无校对
        
        for slot_name in slot_data:
            slot_info = slot_data[slot_name]
            feature_data = slot_info.get("feature_data", {})
            
            slot_proofread_at = feature_data.get("slot_proofread_at")
            if slot_proofread_at:  # 有校对动作
                slot_is_consistent = feature_data.get("slot_is_consistent")
                if slot_is_consistent is True:  # 校对通过 - 最高优先级
                    return 1
                elif slot_is_consistent is False:  # 校对失败
                    best_status = max(best_status, 0)
        
        return best_status
    
    def _get_latest_evidence_timestamp(self, slot_data: Dict[str, Dict[str, Any]]) -> Optional[str]:
        """获取证据的最新时间戳
        
        用于在多个校对通过的证据中选择最新的
        """
        if not slot_data:
            return None
        
        latest_timestamp = None
        
        for slot_name in slot_data:
            slot_info = slot_data[slot_name]
            feature_data = slot_info.get("feature_data", {})
            
            # 获取校对时间戳
            proofread_at = feature_data.get("slot_proofread_at")
            if proofread_at:
                if latest_timestamp is None or proofread_at > latest_timestamp:
                    latest_timestamp = proofread_at
            
            # 获取证据创建时间戳（如果有的话）
            created_at = feature_data.get("created_at")
            if created_at:
                if latest_timestamp is None or created_at > latest_timestamp:
                    latest_timestamp = created_at
        
        return latest_timestamp

    def _check_evidence_role_match(self, evidence_id: int, slot_data: Dict[str, Dict[str, Any]]) -> bool:
        """检查证据角色是否匹配配置要求
        
        Args:
            evidence_id: 证据ID
            slot_data: 槽位数据
            
        Returns:
            是否角色匹配
        """
        # 从evidences列表中查找对应的证据对象
        for evidence in getattr(self, '_current_evidences', []):
            if evidence.id == evidence_id:
                # 检查证据是否有角色信息
                if hasattr(evidence, 'evidence_role') and evidence.evidence_role:
                    # 检查该证据类型是否配置了supported_roles
                    evidence_type = evidence.classification_category
                    if evidence_type:
                        try:
                            from app.core.config_manager import config_manager
                            evidence_type_config = config_manager.get_evidence_type_by_type_name(str(evidence_type))
                            if evidence_type_config and "supported_roles" in evidence_type_config:
                                supported_roles = evidence_type_config["supported_roles"]
                                return evidence.evidence_role in supported_roles
                        except Exception as e:
                            # 如果获取配置失败，记录日志但继续执行
                            print(f"获取证据类型 {evidence_type} 的配置失败: {e}")
                break
        
        # 如果没有角色信息或配置中没有supported_roles，返回False
        return False

    def _select_best_evidence_for_role(self, role_evidences: List[Evidence], all_slots: set, core_slots: List[str]) -> Optional[Evidence]:
        """为特定角色选择最佳证据
        
        选择策略（按优先级排序）：
        1. 优先选择校对通过的证据 (slot_is_consistent=True)
        2. 其次选择无校对动作的证据 (slot_proofread_at=None)
        3. 最后选择校对失败的证据 (slot_is_consistent=False)
        4. 在相同校对状态下，优先选择槽位完成度最高的证据
        5. 在相同完成度下，优先选择置信度最高的证据
        """
        if not role_evidences:
            return None
        
        best_evidence = None
        best_score = -1
        best_proofread_status = -1  # -1: 无校对, 0: 校对失败, 1: 校对通过
        
        for evidence in role_evidences:
            if not evidence.evidence_features:
                continue
            
            # 计算证据的评分
            score = self._calculate_evidence_score(evidence, all_slots, core_slots)
            
            # 计算校对状态
            proofread_status = self._calculate_evidence_proofread_status(evidence)
            
            # 优先选择校对状态更好的证据，在相同校对状态下优先选择评分更高的
            should_update = False
            if proofread_status > best_proofread_status:
                should_update = True
            elif proofread_status == best_proofread_status and score > best_score:
                should_update = True
            
            if should_update:
                best_score = score
                best_proofread_status = proofread_status
                best_evidence = evidence
        
        return best_evidence
    
    def _calculate_evidence_score(self, evidence: Evidence, all_slots: set, core_slots: List[str]) -> float:
        """计算单个证据的评分"""
        if not evidence.evidence_features:
            return 0.0
        
        # 计算核心槽位完成度
        core_slots_count = len(core_slots)
        core_slots_satisfied = 0
        
        # 计算总体槽位完成度
        total_slots_count = len(all_slots)
        total_slots_satisfied = 0
        
        # 计算平均置信度
        confidences = []
        
        for feature in evidence.evidence_features:
            slot_name = feature.get("slot_name")
            if slot_name in all_slots:
                total_slots_satisfied += 1
                if slot_name in core_slots:
                    core_slots_satisfied += 1
                
                confidence = feature.get("confidence", 0.0)
                if confidence is not None:
                    confidences.append(confidence)
        
        # 计算完成度百分比
        core_completion = (core_slots_satisfied / core_slots_count * 100) if core_slots_count > 0 else 100.0
        total_completion = (total_slots_satisfied / total_slots_count * 100) if total_slots_count > 0 else 100.0
        
        # 计算平均置信度
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        # 加权计算总分
        score = (core_completion * 0.7) + (total_completion * 0.2) + (avg_confidence * 0.1)
        
        return score
    
    def _calculate_evidence_proofread_status(self, evidence: Evidence) -> int:
        """计算证据的校对状态
        
        返回值：
        - 1: 校对通过 (slot_is_consistent=True)
        - 0: 校对失败 (slot_is_consistent=False)  
        - -1: 无校对动作 (slot_proofread_at=None)
        
        逻辑：优先选择校对通过的状态
        """
        if not evidence.evidence_features:
            return -1
        
        best_status = -1  # 默认无校对
        
        for feature in evidence.evidence_features:
            slot_proofread_at = feature.get("slot_proofread_at")
            if slot_proofread_at:  # 有校对动作
                slot_is_consistent = feature.get("slot_is_consistent")
                if slot_is_consistent is True:  # 校对通过 - 最高优先级
                    return 1
                elif slot_is_consistent is False:  # 校对失败
                    best_status = max(best_status, 0)
        
        return best_status
    
    def _get_slot_info_from_evidence(self, evidence: Evidence, slot_name: str) -> Dict[str, Any]:
        """从证据中获取指定槽位的信息"""
        slot_info = {
            "is_satisfied": False,
            "confidence": 0.0,
            "slot_proofread_at": None,
            "slot_is_consistent": None,
            "slot_expected_value": None,
            "slot_proofread_reasoning": None
        }
        
        if not evidence.evidence_features:
            return slot_info
        
        # 查找对应的特征
        for feature in evidence.evidence_features:
            if feature.get("slot_name") == slot_name:
                # 检查槽位是否满足条件
                slot_info["is_satisfied"] = self._is_slot_satisfied(feature)
                slot_info["confidence"] = feature.get("confidence", 0.0)
                slot_info["slot_proofread_at"] = feature.get("slot_proofread_at")
                slot_info["slot_is_consistent"] = feature.get("slot_is_consistent")
                slot_info["slot_expected_value"] = feature.get("slot_expected_value")
                slot_info["slot_proofread_reasoning"] = feature.get("slot_proofread_reasoning")
                break
        
        return slot_info