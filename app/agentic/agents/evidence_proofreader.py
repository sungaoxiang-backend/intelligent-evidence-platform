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


class ProofreadRule(BaseModel):
    """校对规则（从配置文件解析）"""
    rule_name: str
    case_fields: List[str]  # 对应的case字段列表
    match_strategy: str  # 匹配策略：exact, fuzzy, range等
    match_condition: str = "any"  # 匹配条件：any, all
    tolerance_percent: Optional[float] = None  # 数值容差百分比
    tolerance_absolute: Optional[float] = None  # 数值绝对容差
    role: Optional[str] = None  # 证据角色：creditor, debtor等，用于精确匹配


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
        
        if not evidence_type_slots:
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
            proofread_config = slot_config.get("proofread_with_case", [])
            
            if proofread_config and slot_name:
                # 解析校对规则
                rules = []
                for rule_data in proofread_config:
                    try:
                        rule = ProofreadRule(**rule_data)
                        # 检查规则是否适用于当前证据（基于角色）
                        if rule.role and hasattr(evidence, 'evidence_role') and evidence.evidence_role:
                            if rule.role == evidence.evidence_role:
                                rules.append(rule)
                        elif not rule.role:
                            # 没有指定角色的规则适用于所有证据
                            rules.append(rule)
                    except Exception as e:
                        logger.error(f"解析字段 {slot_name} 的校对规则失败: {e}")
                        continue
                
                if rules:
                    proofread_tasks.append((slot_name, rules))
        
        if not proofread_tasks:
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
        # 检查角色匹配（如果规则指定了角色）
        if rule.role and hasattr(evidence, 'evidence_role') and evidence.evidence_role:
            if rule.role != evidence.evidence_role:
                logger.debug(f"证据角色 {evidence.evidence_role} 与规则角色 {rule.role} 不匹配，跳过校对规则")
                return None
        
        # 查找对应的特征字段
        target_feature = None
        for feature in evidence_features:
            if feature.slot_name == slot_name:
                target_feature = feature
                break
        
        if not target_feature:
            logger.debug(f"未找到字段 {slot_name}，跳过校对规则")
            return None
        
        # 获取case中的参考值列表
        case_reference_values = []
        for case_field in rule.case_fields:
            case_value = getattr(case, case_field, None)
            if case_value is not None:
                case_reference_values.append((case_field, case_value))
        
        if not case_reference_values:
            logger.debug(f"案例中没有找到字段 {rule.case_fields} 的值，跳过校对")
            return None
        
        # 根据匹配策略执行校对
        if rule.match_strategy == "exact":
            return self._apply_exact_match_rule(slot_name, rule, target_feature, case_reference_values)
        elif rule.match_strategy == "fuzzy":
            return self._apply_fuzzy_match_rule(slot_name, rule, target_feature, case_reference_values)
        else:
            logger.warning(f"未知的匹配策略: {rule.match_strategy}")
            return None
    
    def _apply_exact_match_rule(
        self,
        slot_name: str,
        rule: ProofreadRule,
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
        if rule.match_condition == "any":
            is_consistent = any(match[2] for match in matches)
        else:  # "all"
            is_consistent = all(match[2] for match in matches)
        
        # 期待值：显示所有可能的正确答案
        # 对于数字类型特征，进行标准化处理，去除尾随零
        normalized_expected_values = []
        for _, case_value_str, _ in matches:
            normalized_value = self._normalize_numeric_value(case_value_str)
            normalized_expected_values.append(str(normalized_value))
        
        expected_value = " 或 ".join(normalized_expected_values) if normalized_expected_values else None
        
        # 构建友好的推理说明，包含角色信息（如果适用）
        role_name_mapping = {
            "creditor": "债权人",
            "debtor": "债务人"
        }
        role_info = f"[{role_name_mapping.get(rule.role, rule.role)}] " if rule.role else ""
        reasoning = f"{role_info}实际提取: '{feature.slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'} (精确匹配)"
        
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
        rule: ProofreadRule,
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
        if rule.match_condition == "any":
            is_consistent = any(match[2] for match in matches)
        else:  # "all"
            is_consistent = all(match[2] for match in matches)
        
        # 期待值：显示所有可能的正确答案
        # 对于数字类型特征，进行标准化处理，去除尾随零
        normalized_expected_values = []
        for _, case_value_str, _ in matches:
            normalized_value = self._normalize_numeric_value(case_value_str)
            normalized_expected_values.append(str(normalized_value))
        
        expected_value = " 或 ".join(normalized_expected_values) if normalized_expected_values else None
        
        # 构建友好的推理说明，包含角色信息（如果适用）
        role_name_mapping = {
            "creditor": "债权人",
            "debtor": "债务人"
        }
        role_info = f"[{role_name_mapping.get(rule.role, rule.role)}] " if rule.role else ""
        reasoning = f"{role_info}实际提取: '{feature.slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'} (脱敏匹配)"
        
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
