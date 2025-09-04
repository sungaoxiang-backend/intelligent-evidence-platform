from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config_manager import config_manager
from app.cases.models import Case
from app.evidences.models import Evidence
import logging

logger = logging.getLogger(__name__)


class EvidenceFeatureItem(BaseModel):
    """证据特征项（来自已提取的evidence_features）"""
    slot_name: str
    slot_value: Any
    confidence: float
    reasoning: str
    slot_desc: str
    slot_value_type: str
    slot_required: Any


class ProofreadCondition(BaseModel):
    """校对条件（根据当事人类型）"""
    party_type: str  # person, company, individual
    target_fields: List[str]  # 目标字段列表
    match_strategy: str  # 匹配策略：exact, fuzzy等
    match_condition: str = "any"  # 匹配条件：any, all


class ProofreadRule(BaseModel):
    """校对规则（从配置文件解析）"""
    rule_name: str
    target_type: str  # case 或 case_party
    party_role: Optional[List[str]] = None  # 当事人角色列表：["creditor", "debtor"]等
    conditions: Optional[List[ProofreadCondition]] = None  # 条件列表（用于case_party）
    target_fields: Optional[List[str]] = None  # 目标字段列表（用于case）
    match_strategy: Optional[str] = None  # 匹配策略（用于case）
    match_condition: Optional[str] = None  # 匹配条件（用于case）


class ProofreadResult(BaseModel):
    """单个字段的校对结果"""
    field_name: str
    original_value: str
    expected_value: Optional[str] = None  # 期待值（来自案件）
    is_consistent: bool
    proofread_reasoning: str


class EvidenceProofreadResult(BaseModel):
    """证据校对结果"""
    evidence_id: int
    evidence_type: str
    proofread_results: List[ProofreadResult]
    overall_consistency_score: float  # 整体一致性评分 (0.0 到 1.0)
    has_inconsistencies: bool
    proofread_summary: str


class EvidenceProofreader:
    """证据特征校对器
    
    负责对已提取的证据特征进行业务逻辑校对，
    通过与case信息对比来验证特征提取的准确性
    """
    
    def __init__(self):
        self.config_manager = config_manager
    
    def _normalize_numeric_value(self, value: Any) -> Any:
        """标准化数字类型值，去除尾随零
        
        处理尾随零问题，如：
        - 1000.00 -> 1000
        - 1000.50 -> 1000.5
        - 1000.35 -> 1000.35
        
        Args:
            value: 原始值
            
        Returns:
            标准化后的值
        """
        if value is None:
            return value
        
        # 转换为字符串
        str_value = str(value).strip()
        
        # 尝试解析为数字
        try:
            # 如果是整数
            if '.' not in str_value:
                return int(str_value)
            
            # 如果是浮点数，去除尾随零
            float_value = float(str_value)
            if float_value.is_integer():
                return int(float_value)
            else:
                # 去除尾随零，但保留有效的小数位
                return float_value
        except (ValueError, TypeError):
            # 如果无法解析为数字，返回原值
            return value
    
    async def proofread_evidence_features(
        self,
        db: AsyncSession,
        evidence: Evidence,
        case: Case
    ) -> Optional[EvidenceProofreadResult]:
        """
        对单个证据的特征进行校对
        
        Args:
            db: 数据库会话
            evidence: 证据对象（包含已提取的evidence_features）
            case: 关联的案例对象
            
        Returns:
            校对结果，如果无需校对则返回None
        """
        # 检查证据是否有已提取的特征
        if not evidence.evidence_features or not evidence.classification_category:
            return None
        
        # 获取证据类型的提取词槽配置（包含proofread_with_case）
        extraction_slots = self.config_manager.get_extraction_slots_by_chinese_types([evidence.classification_category])
        evidence_type_slots = extraction_slots.get(evidence.classification_category, [])
        
        logger.info(f"证据 {evidence.id} 类型: {evidence.classification_category}")
        logger.info(f"提取到的词槽配置: {evidence_type_slots}")
        
        if not evidence_type_slots:
            logger.warning(f"证据 {evidence.id} 没有找到词槽配置")
            return None
        
        # 解析已提取的特征
        try:
            evidence_features = [
                EvidenceFeatureItem(**feature) for feature in evidence.evidence_features
                if not (isinstance(feature, dict) and "_proofread_metadata" in feature)  # 排除校对元数据
            ]
        except Exception as e:
            logger.error(f"解析证据特征失败: {e}")
            return None
        
        # 收集有校对配置的字段和规则
        proofread_tasks = []  # [(slot_name, proofread_rules)]
        for slot_config in evidence_type_slots:
            slot_name = slot_config.get("slot_name")
            proofread_config = slot_config.get("proofread_rules", [])
            
            logger.info(f"槽位 {slot_name} 的校对配置: {proofread_config}")
            
            if proofread_config and slot_name:
                # 解析校对规则
                rules = []
                for rule_data in proofread_config:
                    try:
                        rule = ProofreadRule(**rule_data)
                        logger.info(f"解析规则: {rule.rule_name}, target_type: {rule.target_type}, party_role: {rule.party_role}")
                        # 检查规则是否适用于当前证据
                        if self._is_rule_applicable(rule, evidence):
                            rules.append(rule)
                            logger.info(f"规则 {rule.rule_name} 适用于证据 {evidence.id}")
                        else:
                            logger.info(f"规则 {rule.rule_name} 不适用于证据 {evidence.id}")
                    except Exception as e:
                        logger.error(f"解析字段 {slot_name} 的校对规则失败: {e}")
                        continue
                
                if rules:
                    proofread_tasks.append((slot_name, rules))
                    logger.info(f"槽位 {slot_name} 有 {len(rules)} 个适用规则")
        
        logger.info(f"证据 {evidence.id} 共有 {len(proofread_tasks)} 个校对任务")
        if not proofread_tasks:
            logger.warning(f"证据 {evidence.id} 没有校对任务")
            return None
        
        # 执行校对
        proofread_results = []
        for slot_name, rules in proofread_tasks:
            # 对于每个槽位，只应用第一个适用的规则（避免重复校对）
            for rule in rules:
                result = await self._apply_proofread_rule(
                    slot_name, rule, evidence_features, case, evidence
                )
                if result:
                    proofread_results.append(result)
                    break  # 找到第一个适用的规则后停止
        
        if not proofread_results:
            return None
        
        # 计算整体一致性评分（基于一致性比例）
        consistent_count = len([r for r in proofread_results if r.is_consistent])
        overall_consistency_score = consistent_count / len(proofread_results) if proofread_results else 0.0
        
        # 检查是否有不一致项
        has_inconsistencies = any(not r.is_consistent for r in proofread_results)
        
        # 生成校对摘要
        proofread_summary = self._generate_proofread_summary(proofread_results, has_inconsistencies)
        
        return EvidenceProofreadResult(
            evidence_id=evidence.id,
            evidence_type=evidence.classification_category,
            proofread_results=proofread_results,
            overall_consistency_score=max(0.0, min(1.0, 0.5 + overall_consistency_score)),
            has_inconsistencies=has_inconsistencies,
            proofread_summary=proofread_summary
        )
    
    async def batch_proofread_evidence_features(
        self,
        db: AsyncSession,
        evidences: List[Evidence],
        case_id: int
    ) -> List[EvidenceProofreadResult]:
        """
        批量校对证据特征
        
        Args:
            db: 数据库会话
            evidences: 证据列表
            case_id: 案例ID
            
        Returns:
            校对结果列表
        """
        # 获取case信息
        case_query = await db.execute(select(Case).where(Case.id == case_id))
        case = case_query.scalar_one_or_none()
        
        if not case:
            logger.error(f"案例 {case_id} 不存在")
            return []
        
        results = []
        for evidence in evidences:
            try:
                proofread_result = await self.proofread_evidence_features(db, evidence, case)
                if proofread_result:
                    results.append(proofread_result)
            except Exception as e:
                logger.error(f"校对证据 {evidence.id} 失败: {e}")
                continue
        
        return results
    
    def _is_rule_applicable(self, rule: ProofreadRule, evidence: Evidence) -> bool:
        """检查规则是否适用于当前证据
        
        Args:
            rule: 校对规则
            evidence: 证据对象
            
        Returns:
            是否适用
        """
        # 如果规则指定了 party_role，检查证据角色是否匹配
        if rule.party_role is not None and len(rule.party_role) > 0:
            if not evidence.evidence_role:
                # 如果证据没有角色，但规则指定了角色，仍然适用（因为规则会尝试匹配所有指定角色）
                return True
            return evidence.evidence_role in rule.party_role
        
        # 没有指定角色限制，适用于所有证据
        return True
    
    async def _apply_proofread_rule(
        self,
        slot_name: str,
        rule: ProofreadRule,
        evidence_features: List[EvidenceFeatureItem],
        case: Case,
        evidence: Evidence
    ) -> Optional[ProofreadResult]:
        """
        应用单个校对规则
        
        Args:
            slot_name: 要校对的字段名
            rule: 校对规则
            evidence_features: 证据特征列表
            case: 案例对象
            evidence: 证据对象
            
        Returns:
            校对结果，如果规则不适用则返回None
        """
        # 查找对应的特征字段
        target_feature = None
        for feature in evidence_features:
            if feature.slot_name == slot_name:
                target_feature = feature
                break
        
        if not target_feature:
            logger.debug(f"未找到字段 {slot_name}，跳过校对规则")
            return None
        
        # 根据 target_type 执行不同的校对逻辑
        if rule.target_type == "case":
            return self._apply_case_proofread_rule(slot_name, rule, target_feature, case, evidence)
        elif rule.target_type == "case_party":
            return self._apply_case_party_proofread_rule(slot_name, rule, target_feature, case, evidence)
        else:
            logger.warning(f"未知的 target_type: {rule.target_type}")
            return None
    
    def _apply_case_proofread_rule(
        self,
        slot_name: str,
        rule: ProofreadRule,
        feature: EvidenceFeatureItem,
        case: Case,
        evidence: Evidence
    ) -> Optional[ProofreadResult]:
        """应用案件字段校对规则"""
        if not rule.target_fields or not rule.match_strategy:
            logger.warning(f"案件校对规则缺少必要字段: {rule.rule_name}")
            return None
        
        # 获取案件中的参考值列表
        case_reference_values = []
        for case_field in rule.target_fields:
            case_value = getattr(case, case_field, None)
            if case_value is not None:
                case_reference_values.append((case_field, case_value))
        
        if not case_reference_values:
            logger.debug(f"案件中没有找到字段 {rule.target_fields} 的值，跳过校对")
            return None
        
        # 根据匹配策略执行校对
        if rule.match_strategy == "exact":
            return self._apply_exact_match_rule(slot_name, rule, feature, case_reference_values)
        elif rule.match_strategy == "fuzzy":
            return self._apply_fuzzy_match_rule(slot_name, rule, feature, case_reference_values)
        else:
            logger.warning(f"未知的匹配策略: {rule.match_strategy}")
            return None
    
    def _apply_case_party_proofread_rule(
        self,
        slot_name: str,
        rule: ProofreadRule,
        feature: EvidenceFeatureItem,
        case: Case,
        evidence: Evidence
    ) -> Optional[ProofreadResult]:
        """应用当事人字段校对规则"""
        if not rule.conditions:
            logger.warning(f"当事人校对规则缺少条件: {rule.rule_name}")
            return None
        
        # 确定要校对的当事人角色
        target_roles = self._get_target_roles(rule, evidence)
        logger.info(f"目标角色: {target_roles}")
        if not target_roles:
            logger.debug(f"无法确定目标角色，跳过校对: {rule.rule_name}")
            return None
        
        # 查找匹配的当事人
        target_parties = []
        logger.info(f"案件中的所有当事人: {[(p.party_name, p.party_role, p.party_type) for p in case.case_parties]}")
        for party in case.case_parties:
            if party.party_role in target_roles:
                target_parties.append(party)
                logger.info(f"找到匹配的当事人: {party.party_name}, 角色: {party.party_role}, 类型: {party.party_type}")
        
        logger.info(f"最终目标当事人数量: {len(target_parties)}")
        
        if not target_parties:
            logger.debug(f"没有找到角色为 {target_roles} 的当事人，跳过校对")
            return None
        
        # 对每个匹配的当事人执行校对
        all_matches = []
        for party in target_parties:
            logger.info(f"处理当事人: {party.party_name}, 类型: {party.party_type}")
            # 根据当事人类型找到对应的条件
            matching_condition = None
            for condition in rule.conditions:
                if condition.party_type == party.party_type:
                    matching_condition = condition
                    break
            
            if not matching_condition:
                logger.debug(f"当事人类型 {party.party_type} 没有对应的校对条件")
                continue
            
            logger.info(f"找到匹配条件: {matching_condition.party_type}, 目标字段: {matching_condition.target_fields}")
            
            # 获取当事人字段的参考值
            party_reference_values = []
            for field in matching_condition.target_fields:
                party_value = getattr(party, field, None)
                logger.info(f"字段 {field}: {party_value}")
                if party_value is not None:
                    party_reference_values.append((field, party_value))
            
            logger.info(f"当事人 {party.party_name} 的参考值: {party_reference_values}")
            
            if party_reference_values:
                # 根据匹配策略执行校对
                if matching_condition.match_strategy == "exact":
                    result = self._apply_exact_match_rule(slot_name, matching_condition, feature, party_reference_values)
                elif matching_condition.match_strategy == "fuzzy":
                    result = self._apply_fuzzy_match_rule(slot_name, matching_condition, feature, party_reference_values)
                else:
                    logger.warning(f"未知的匹配策略: {matching_condition.match_strategy}")
                    continue
                
                if result:
                    logger.info(f"校对结果: {result.expected_value}")
                    all_matches.append(result)
        
        # 如果找到匹配结果，合并所有期待值
        if not all_matches:
            return None
        
        # 合并所有匹配结果的期待值
        all_expected_values = []
        is_consistent = False
        
        for match in all_matches:
            if match.expected_value:
                logger.info(f"原始期待值: '{match.expected_value}'")
                # 解析期待值（可能包含多个值，用" 或 "分隔）
                expected_parts = match.expected_value.split(" 或 ")
                logger.info(f"分割后的部分: {expected_parts}")
                # 过滤掉空值和只包含"或"的值
                filtered_parts = [part.strip() for part in expected_parts if part.strip() and part.strip() != "或"]
                logger.info(f"过滤后的部分: {filtered_parts}")
                all_expected_values.extend(filtered_parts)
            if match.is_consistent:
                is_consistent = True
        
        # 去重并生成合并后的期待值
        unique_expected_values = list(dict.fromkeys(all_expected_values))  # 保持顺序的去重
        merged_expected_value = " 或 ".join(unique_expected_values) if unique_expected_values else None
        
        logger.info(f"所有期待值: {all_expected_values}")
        logger.info(f"去重后的期待值: {unique_expected_values}")
        logger.info(f"合并后的期待值: '{merged_expected_value}'")
        
        # 使用第一个匹配结果作为基础，更新期待值
        base_result = all_matches[0]
        base_result.expected_value = merged_expected_value
        base_result.is_consistent = is_consistent
        
        # 更新推理说明
        base_result.proofread_reasoning = f"实际提取: '{base_result.original_value}', 期待值: '{merged_expected_value}', {'匹配' if is_consistent else '不匹配'} (精确匹配)"
        
        return base_result
    
    def _get_target_roles(self, rule: ProofreadRule, evidence: Evidence) -> List[str]:
        """获取目标角色列表"""
        if rule.party_role is not None and len(rule.party_role) > 0:
            return rule.party_role
        elif evidence.evidence_role:
            return [evidence.evidence_role]
        else:
            return []
    
    def _apply_exact_match_rule(
        self,
        slot_name: str,
        rule_or_condition: Union[ProofreadRule, ProofreadCondition],
        feature: EvidenceFeatureItem,
        case_reference_values: List[tuple]  # [(field_name, value), ...]
    ) -> ProofreadResult:
        """应用精确匹配规则"""
        feature_value_str = str(feature.slot_value).strip()
        
        # 检查每个case字段的匹配情况
        matches = []
        for case_field, case_value in case_reference_values:
            case_value_str = str(case_value).strip()
            # 对于数字类型特征，进行标准化处理，去除尾随零
            normalized_case_value = self._normalize_numeric_value(case_value_str)
            normalized_feature_value = self._normalize_numeric_value(feature_value_str)
            
            # 使用标准化后的值进行比较
            is_match = str(normalized_case_value).lower() == str(normalized_feature_value).lower()
            matches.append((case_field, case_value_str, is_match))
        
        # 根据match_condition判断整体匹配结果
        match_condition = getattr(rule_or_condition, 'match_condition', 'any')
        if match_condition == "any":
            is_consistent = any(match[2] for match in matches)
        else:  # "all"
            is_consistent = all(match[2] for match in matches)
        
        # 期待值：显示所有可能的正确答案
        # 对于数字类型特征，进行标准化处理，去除尾随零
        normalized_expected_values = []
        for _, case_value_str, _ in matches:
            normalized_value = self._normalize_numeric_value(case_value_str)
            normalized_expected_values.append(str(normalized_value))
        
        # 只有当有多个值时才用" 或 "连接
        if len(normalized_expected_values) > 1:
            expected_value = " 或 ".join(normalized_expected_values)
        elif len(normalized_expected_values) == 1:
            expected_value = normalized_expected_values[0]
        else:
            expected_value = None
        
        # 构建友好的推理说明
        reasoning = f"实际提取: '{feature.slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'} (精确匹配)"
        
        return ProofreadResult(
            field_name=slot_name,
            original_value=str(feature.slot_value),
            expected_value=expected_value,
            is_consistent=is_consistent,
            proofread_reasoning=reasoning
        )
    
    def _apply_fuzzy_match_rule(
        self,
        slot_name: str,
        rule_or_condition: Union[ProofreadRule, ProofreadCondition],
        feature: EvidenceFeatureItem,
        case_reference_values: List[tuple]
    ) -> ProofreadResult:
        """应用模糊匹配规则（支持脱敏字符匹配）"""
        feature_value_str = str(feature.slot_value).strip()
        
        # 检查每个case字段的匹配情况
        matches = []
        for case_field, case_value in case_reference_values:
            case_value_str = str(case_value).strip()
            is_match = self._is_masked_match(feature_value_str, case_value_str)
            matches.append((case_field, case_value_str, is_match))
        
        # 根据match_condition判断整体匹配结果
        match_condition = getattr(rule_or_condition, 'match_condition', 'any')
        if match_condition == "any":
            is_consistent = any(match[2] for match in matches)
        else:  # "all"
            is_consistent = all(match[2] for match in matches)
        
        # 期待值：显示所有可能的正确答案
        # 对于数字类型特征，进行标准化处理，去除尾随零
        normalized_expected_values = []
        for _, case_value_str, _ in matches:
            normalized_value = self._normalize_numeric_value(case_value_str)
            normalized_expected_values.append(str(normalized_value))
        
        # 只有当有多个值时才用" 或 "连接
        if len(normalized_expected_values) > 1:
            expected_value = " 或 ".join(normalized_expected_values)
        elif len(normalized_expected_values) == 1:
            expected_value = normalized_expected_values[0]
        else:
            expected_value = None
        
        # 构建友好的推理说明
        reasoning = f"实际提取: '{feature.slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'} (脱敏匹配)"
        
        return ProofreadResult(
            field_name=slot_name,
            original_value=str(feature.slot_value),
            expected_value=expected_value,
            is_consistent=is_consistent,
            proofread_reasoning=reasoning
        )
    

    def _calculate_string_similarity(self, str1: str, str2: str) -> float:
        """计算字符串相似度（简单实现）"""
        if not str1 or not str2:
            return 0.0
        
        # 使用编辑距离计算相似度
        def levenshtein_distance(s1, s2):
            if len(s1) < len(s2):
                return levenshtein_distance(s2, s1)
            
            if len(s2) == 0:
                return len(s1)
            
            previous_row = list(range(len(s2) + 1))
            for i, c1 in enumerate(s1):
                current_row = [i + 1]
                for j, c2 in enumerate(s2):
                    insertions = previous_row[j + 1] + 1
                    deletions = current_row[j] + 1
                    substitutions = previous_row[j] + (c1 != c2)
                    current_row.append(min(insertions, deletions, substitutions))
                previous_row = current_row
            
            return previous_row[-1]
        
        max_len = max(len(str1), len(str2))
        if max_len == 0:
            return 1.0
        
        distance = levenshtein_distance(str1.lower(), str2.lower())
        return 1.0 - (distance / max_len)
    
    def _is_masked_match(self, masked_value: str, full_value: str) -> bool:
        """检查脱敏值是否匹配完整值
        
        例如：
        - "翁**" 匹配 "翁文达"
        - "翁*达" 匹配 "翁文达"  
        - "**达" 匹配 "翁文达"
        """
        if not masked_value or not full_value:
            return False
            
        # 如果没有脱敏字符，进行精确匹配
        if '*' not in masked_value:
            return masked_value.lower() == full_value.lower()
        
        # 将脱敏模式转换为正则表达式
        import re
        
        # 转义特殊字符，但保留*作为通配符
        pattern = re.escape(masked_value).replace(r'\*', '.')
        pattern = f"^{pattern}$"
        
        try:
            return bool(re.match(pattern, full_value, re.IGNORECASE))
        except re.error:
            return False
    
    def _generate_proofread_summary(self, results: List[ProofreadResult], has_inconsistencies: bool) -> str:
        """生成校对摘要"""
        total_fields = len(results)
        consistent_fields = len([r for r in results if r.is_consistent])
        
        summary_parts = [
            f"校对了 {total_fields} 个字段",
            f"{consistent_fields} 个一致",
            f"{total_fields - consistent_fields} 个不一致" if has_inconsistencies else "全部一致"
        ]
        
        if has_inconsistencies:
            inconsistent_fields = [r.field_name for r in results if not r.is_consistent]
            summary_parts.append(f"不一致字段: {', '.join(inconsistent_fields)}")
        
        return "; ".join(summary_parts)
    

    def reload_config(self):
        """重新加载配置"""
        self.config_manager.reload_config()


# 全局校对器实例
evidence_proofreader = EvidenceProofreader()
