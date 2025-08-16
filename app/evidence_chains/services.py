# 简化版证据链服务 - 纯粹的状态检查器（异步版本）

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.evidence_chains.schemas import (
    EvidenceChainDashboard, EvidenceChain, EvidenceTypeRequirement, EvidenceSlotDetail,
    EvidenceChainStatus, EvidenceRequirementStatus, EvidenceChainFeasibilityStatus
)
from app.cases.models import Case
from app.evidences.models import Evidence
from app.cases.models import AssociationEvidenceFeature
from app.core.config_manager import config_manager


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
        return config_manager.get_evidence_chains_by_case_type(case_type_str)
    
    def _check_evidence_chain_status(
        self, 
        chain_config: Dict[str, Any], 
        evidences: List[Evidence], 
        association_features: List[AssociationEvidenceFeature]
    ) -> EvidenceChain:
        """检查单个证据链的状态"""
        chain_id = chain_config.get("chain_id")
        if not chain_id:
            raise ValueError("证据链配置缺少chain_id")
        
        required_evidence_types = chain_config.get("required_evidence_types", [])
        
        requirements = []
        satisfied_count = 0
        
        # 统计核心特征相关的数据
        core_requirements_count = 0  # 有核心特征要求的证据类型数量
        core_requirements_satisfied = 0  # 核心特征完备的证据类型数量
        
        # 检查每个证据要求
        for evidence_type_config in required_evidence_types:
            requirement = self._check_evidence_requirement_status(
                evidence_type_config, evidences, association_features
            )
            requirements.append(requirement)
            
            if requirement.status == EvidenceRequirementStatus.SATISFIED:
                satisfied_count += 1
            
            # 统计有核心特征要求的证据类型
            # 基于配置中的 core_evidence_slot 来判断，而不是基于实际证据中的 core_slots_count
            core_slots_config = evidence_type_config.get("core_evidence_slot", [])
            # 如果配置中有核心槽位定义，则计入进度计算
            if core_slots_config and len(core_slots_config) > 0:
                core_requirements_count += 1
                # 只有当该证据类型的所有核心特征都完成时，才算"核心特征完备"
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
    
    def _check_evidence_requirement_status(
        self,
        evidence_type_config: Dict[str, Any],
        evidences: List[Evidence],
        association_features: List[AssociationEvidenceFeature]
    ) -> EvidenceTypeRequirement:
        """检查单个证据要求的状态"""
        evidence_type = evidence_type_config.get("evidence_type")
        if not evidence_type:
            raise ValueError("证据类型配置缺少evidence_type")
        
        core_slots = evidence_type_config.get("core_evidence_slot", [])
        
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
        
        # 只添加配置文件中定义的所有槽位
        for slot_config in config_slots:
            slot_name = slot_config.get("slot_name")
            if slot_name:
                all_slots.add(slot_name)
        
        # 添加配置中的核心槽位（如果不在配置槽位中）
        for core_slot in core_slots:
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
                        if slot_name in all_slots and self._is_slot_satisfied(feature):
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
                        if slot_name in all_slots and self._is_slot_satisfied(feature):
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
                    slot_satisfaction[slot_name] = (
                        True, 
                        slot_info["source_type"], 
                        slot_info["source_id"], 
                        slot_info["confidence"]
                    )
        
        # 构建槽位详情（按核心/非核心排序）
        core_slot_details = []
        non_core_slot_details = []
        
        for slot in all_slots:
            is_satisfied, source_type, source_id, confidence = slot_satisfaction.get(slot, (False, None, None, None))
            is_core = slot in core_slots
            
            slot_detail = EvidenceSlotDetail(
                slot_name=slot,
                is_satisfied=is_satisfied,
                is_core=is_core,
                source_type=source_type or "none",
                source_id=source_id,
                confidence=confidence
            )
            
            if is_core:
                core_slot_details.append(slot_detail)
            else:
                non_core_slot_details.append(slot_detail)
        
        # 核心槽位在前，非核心槽位在后
        slot_details = core_slot_details + non_core_slot_details
        
        # 计算核心特征和补充特征的完成情况
        core_slots_count = len(core_slot_details)
        core_slots_satisfied = sum(1 for slot in core_slot_details if slot.is_satisfied)
        supplementary_slots_count = len(non_core_slot_details)
        supplementary_slots_satisfied = sum(1 for slot in non_core_slot_details if slot.is_satisfied)
        
        core_completion_percentage = (core_slots_satisfied / core_slots_count * 100) if core_slots_count > 0 else 100.0
        supplementary_completion_percentage = (supplementary_slots_satisfied / supplementary_slots_count * 100) if supplementary_slots_count > 0 else 100.0
        
        # 确定状态（只基于核心槽位）
        core_satisfied_count = sum(1 for slot in core_slots if slot_satisfaction.get(slot, (False, None, None, None))[0])
        
        # 判断是否有匹配的证据（用于确定 MISSING 状态）
        has_matching_evidence = any(
            self._is_evidence_matching_type(evidence, str(evidence_type)) for evidence in evidences
        ) or any(
            self._is_association_feature_matching_type(assoc_feature, str(evidence_type), evidences) 
            for assoc_feature in association_features
        )
        
        if not has_matching_evidence:
            status = EvidenceRequirementStatus.MISSING
        elif len(core_slots) == 0:  # 没有核心槽位的证据类型（如身份证）
            # 对于没有核心槽位的证据类型，检查是否有任何槽位未满足
            all_satisfied = all(slot_satisfaction.get(slot, (False, None, None, None))[0] for slot in all_slots)
            if all_satisfied and len(all_slots) > 0:
                status = EvidenceRequirementStatus.SATISFIED
            elif any(slot_satisfaction.get(slot, (False, None, None, None))[0] for slot in all_slots):
                status = EvidenceRequirementStatus.PARTIAL
            else:
                status = EvidenceRequirementStatus.MISSING
        elif core_satisfied_count == len(core_slots):
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
        
        选择策略：
        1. 优先选择核心槽位完成度最高的源
        2. 其次选择总体槽位完成度最高的源
        3. 最后选择置信度最高的源
        """
        best_source = None
        best_score = -1
        
        # 评估证据实例
        for evidence_id, slot_data in evidence_slot_groups.items():
            score = self._calculate_source_score(slot_data, all_slots, core_slots)
            if score > best_score:
                best_score = score
                best_source = {
                    "source_type": "evidence",
                    "source_id": evidence_id,
                    "slot_data": slot_data,
                    "score": score
                }
        
        # 评估关联证据分组
        for group_name, slot_data in association_slot_groups.items():
            score = self._calculate_source_score(slot_data, all_slots, core_slots)
            if score > best_score:
                best_score = score
                best_source = {
                    "source_type": "association_group",
                    "source_id": group_name,
                    "slot_data": slot_data,
                    "score": score
                }
        
        return best_source
    
    def _calculate_source_score(
        self,
        slot_data: Dict[str, Dict[str, Any]],
        all_slots: set,
        core_slots: List[str]
    ) -> float:
        """计算源的评分
        
        评分规则：
        1. 核心槽位完成度权重：70%
        2. 总体槽位完成度权重：20%
        3. 平均置信度权重：10%
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