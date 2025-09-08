from datetime import datetime
from typing import Optional, Tuple, List, Callable, Awaitable, Any
from fastapi import UploadFile

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from urllib.parse import unquote
from app.cases.models import Case as CaseModel, CaseParty as CasePartyModel, AssociationEvidenceFeature, PartyType
from app.cases.schemas import CaseCreate, CaseUpdate, Case as CaseSchema, CasePartyCreate, CasePartyUpdate
from agno.run.response import RunResponse
from agno.media import Image
import asyncio
from app.users.services import get_by_id_card, get_by_phone, create as create_user
from app.users.schemas import UserCreate
from app.users.schemas import User as UserSchema
from loguru import logger
from app.evidences.services import batch_create
from app.evidences.models import Evidence
from app.agentic.agents.association_features_extractor_v2 import AssociationFeaturesExtractor, AssociationFeaturesExtractionResults
from app.agentic.agents.evidence_proofreader import EvidenceProofreader
from fastapi import HTTPException
from app.cases.models import PartyType

# 创建校对器实例
evidence_proofreader = EvidenceProofreader()

# ==================== 案件创建校验方法 ====================

async def validate_case_basic_info(obj_in: CaseCreate) -> None:
    """验证案件基础信息"""
    # 验证案件类型
    if not obj_in.case_type:
        raise HTTPException(
            status_code=400,
            detail="案件类型不能为空"
        )
    
    # 验证欠款金额
    if obj_in.loan_amount is None or obj_in.loan_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="欠款金额必须大于0"
        )
    
    # 验证当事人列表（必须有两个当事人：债权人和债务人）
    if not obj_in.case_parties or len(obj_in.case_parties) != 2:
        raise HTTPException(
            status_code=400,
            detail="案件必须包含两个当事人：一个债权人(creditor)和一个债务人(debtor)"
        )
    
    # 验证当事人角色
    party_roles = [party.party_role for party in obj_in.case_parties]
    expected_roles = {'creditor', 'debtor'}
    if set(party_roles) != expected_roles:
        raise HTTPException(
            status_code=400,
            detail="案件必须包含一个债权人(creditor)和一个债务人(debtor)"
        )

async def validate_case_parties_info(parties: List[CasePartyCreate]) -> None:
    """验证当事人信息完整性"""
    if not parties:
        return
    
    # 验证每个当事人的必要字段
    for i, party in enumerate(parties):
        party_type = party.party_type
        
        # 验证当事人名称
        if not party.party_name or not party.party_name.strip():
            raise HTTPException(
                status_code=400,
                detail=f"第{i+1}个当事人：当事人名称不能为空"
            )
        
        # 根据当事人类型验证必要字段
        if party_type == PartyType.PERSON:
            # 个人类型：需要 party_name 和 name（自然人姓名）
            if not party.name or not party.name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}个当事人（个人）：自然人姓名不能为空"
                )
                
        elif party_type == PartyType.INDIVIDUAL:
            # 个体工商户类型：需要 party_name、company_name（个体工商户名称）和 name（经营者名称）
            if not party.company_name or not party.company_name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}个当事人（个体工商户）：个体工商户名称不能为空"
                )
            if not party.name or not party.name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}个当事人（个体工商户）：经营者名称不能为空"
                )
                
        elif party_type == PartyType.COMPANY:
            # 公司类型：需要 party_name、company_name（公司名称）和 name（法定代表人名称）
            if not party.company_name or not party.company_name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}个当事人（公司）：公司名称不能为空"
                )
            if not party.name or not party.name.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}个当事人（公司）：法定代表人名称不能为空"
                )

# ==================== 当事人独立管理方法 ====================

async def create_case_party(db: AsyncSession, case_id: int, party_data: CasePartyCreate) -> CasePartyModel:
    """创建单个当事人"""
    party_create_data = party_data.model_dump(exclude_unset=True)
    party_create_data['case_id'] = case_id
    party_obj = CasePartyModel(**party_create_data)
    db.add(party_obj)
    await db.flush()
    return party_obj

async def get_case_parties_by_case_id(db: AsyncSession, case_id: int) -> List[CasePartyModel]:
    """根据案件ID获取所有当事人"""
    query = select(CasePartyModel).where(CasePartyModel.case_id == case_id)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_case_party_by_id(db: AsyncSession, party_id: int) -> Optional[CasePartyModel]:
    """根据ID获取单个当事人"""
    query = select(CasePartyModel).where(CasePartyModel.id == party_id)
    result = await db.execute(query)
    return result.scalars().first()

async def update_case_party(db: AsyncSession, party_id: int, party_update: 'CasePartyUpdate') -> Optional[CasePartyModel]:
    """更新单个当事人"""
    party = await get_case_party_by_id(db, party_id)
    if not party:
        return None
    
    # 如果更新了角色，需要验证整个案件的当事人配置
    update_data = party_update.model_dump(exclude_unset=True)
    old_role = party.party_role
    new_role = update_data.get('party_role', old_role)
    
    # 更新当事人信息
    for field, value in update_data.items():
        setattr(party, field, value)
    
    db.add(party)
    
    # 如果角色发生了变化，验证业务规则
    if new_role != old_role:
        await validate_case_parties_business_rules(db, party.case_id)
    
    await db.commit()
    await db.refresh(party)
    return party

async def validate_case_parties_business_rules(db: AsyncSession, case_id: int) -> None:
    """验证案件当事人的业务规则"""
    parties = await get_case_parties_by_case_id(db, case_id)
    party_roles = [party.party_role for party in parties]
    
    # 验证角色有效性
    valid_roles = {'creditor', 'debtor'}
    invalid_roles = set(party_roles) - valid_roles
    if invalid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"存在无效的当事人角色：{', '.join(invalid_roles)}"
        )
    
    # 验证最终状态：必须有且仅有1个creditor和1个debtor
    role_counts = {}
    for role in party_roles:
        role_counts[role] = role_counts.get(role, 0) + 1
    
    expected_roles = {'creditor': 1, 'debtor': 1}
    
    for role, expected_count in expected_roles.items():
        actual_count = role_counts.get(role, 0)
        if actual_count != expected_count:
            raise HTTPException(
                status_code=400,
                detail=f"当事人配置不符合要求：{role}角色期望{expected_count}个，实际{actual_count}个"
            )

async def create_case_parties_batch(db: AsyncSession, case_id: int, parties_data: List) -> List[CasePartyModel]:
    """批量创建当事人并验证业务规则"""
    # 先验证输入数据中是否有重复角色
    party_roles = [party.party_role for party in parties_data]
    if len(party_roles) != len(set(party_roles)):
        raise HTTPException(
            status_code=400,
            detail="提供的当事人中存在重复角色"
        )
    
    # 创建当事人
    created_parties = []
    for party_data in parties_data:
        party = await create_case_party(db, case_id, party_data)
        created_parties.append(party)
    
    # 验证业务规则
    await validate_case_parties_business_rules(db, case_id)
    
    return created_parties



# 导入证据模块中的标准化函数
from app.evidences.services import _normalize_numeric_value

async def enhance_case_features_with_proofreading(case: CaseModel) -> CaseModel:
    """为案件的关联特征组添加校对信息"""
    logger.info(f"开始为案件 {case.id} 添加校对信息")
    
    if not case.association_evidence_features:
        logger.info(f"案件 {case.id} 没有关联特征组，跳过校对")
        return case
    
    try:
        # 为每个关联特征组添加校对信息
        for feature_group in case.association_evidence_features:
            if not feature_group.evidence_features:
                continue
                
            logger.info(f"处理特征组 {feature_group.slot_group_name}，包含 {len(feature_group.evidence_features)} 个特征")
            
            # 为每个特征添加校对信息
            enhanced_features = []
            
            for feature in feature_group.evidence_features:
                # 转换为dict格式
                if isinstance(feature, dict):
                    enhanced_feature = feature.copy()
                else:
                    # 如果不是dict，转换为dict
                    if hasattr(feature, 'model_dump'):
                        enhanced_feature = feature.model_dump()
                    elif hasattr(feature, '__dict__'):
                        enhanced_feature = vars(feature)
                    else:
                        enhanced_feature = dict(feature) if hasattr(feature, 'items') else feature
                
                # 执行校对逻辑
                slot_name = enhanced_feature.get("slot_name")
                slot_value = enhanced_feature.get("slot_value")
                
                if slot_name and slot_value and slot_value != "未知":
                    try:
                        # 使用证据校对器的逻辑
                        from app.core.config_manager import config_manager
                        
                        # 联合分析目前只针对微信聊天记录，固定使用这个证据类型的配置
                        wechat_config = config_manager.get_evidence_type_by_key("wechat_chat_record")
                        
                        # 在微信聊天记录的extraction_slots中查找对应slot的校对配置
                        slot_proofread_config = None
                        if wechat_config and wechat_config.get("extraction_slots"):
                            for slot_config in wechat_config["extraction_slots"]:
                                if slot_config.get("slot_name") == slot_name:
                                    slot_proofread_config = slot_config.get("proofread_rules")
                                    break
                        
                        if slot_proofread_config:
                            # 执行校对 - slot_proofread_config是一个规则列表
                            for rule in slot_proofread_config:
                                rule_name = rule.get("rule_name", "")
                                target_type = rule.get("target_type", "case")
                                party_role = rule.get("party_role", [])
                                
                                expected_values = []
                                match_strategy = rule.get("match_strategy", "exact")
                                match_condition = rule.get("match_condition", "all")
                                
                                # 根据target_type获取期待值
                                if target_type == "case":
                                    # 案件字段匹配
                                    target_fields = rule.get("target_fields", [])
                                    for case_field in target_fields:
                                        case_value = getattr(case, case_field, None)
                                        if case_value is not None and str(case_value).strip():
                                            # 避免添加重复值
                                            case_value_str = str(case_value).strip()
                                            if case_value_str not in expected_values:
                                                expected_values.append(case_value_str)
                                
                                elif target_type == "case_party":
                                    # 当事人字段匹配
                                    conditions = rule.get("conditions", [])
                                    if not conditions:
                                        continue
                                    
                                    # 确定目标角色
                                    target_roles = party_role if party_role else []
                                    if not target_roles:
                                        continue
                                    
                                    # 查找匹配的当事人
                                    for party in case.case_parties:
                                        if party.party_role not in target_roles:
                                            continue
                                        
                                        # 根据当事人类型匹配条件
                                        for condition in conditions:
                                            if condition.get("party_type") != party.party_type:
                                                continue
                                            
                                            target_fields = condition.get("target_fields", [])
                                            for party_field in target_fields:
                                                party_value = getattr(party, party_field, None)
                                                if party_value is not None and str(party_value).strip():
                                                    # 避免添加重复值
                                                    party_value_str = str(party_value).strip()
                                                    if party_value_str not in expected_values:
                                                        expected_values.append(party_value_str)
                                
                                if expected_values:
                                    # 简单的精确匹配逻辑
                                    is_consistent = False
                                    
                                    # 对于数字类型特征，进行标准化处理，去除尾随零
                                    normalized_expected_values = []
                                    for expected in expected_values:
                                        normalized_value = _normalize_numeric_value(expected)
                                        normalized_expected_values.append(str(normalized_value))
                                    
                                    # 只有当有多个期待值时才用"或"连接
                                    if len(normalized_expected_values) > 1:
                                        expected_value = " 或 ".join(normalized_expected_values)
                                    else:
                                        expected_value = normalized_expected_values[0] if normalized_expected_values else ""
                                    
                                    # 使用标准化后的值进行比较
                                    for expected in expected_values:
                                        normalized_expected = _normalize_numeric_value(expected)
                                        normalized_slot_value = _normalize_numeric_value(slot_value)
                                        if str(normalized_slot_value).strip() == str(normalized_expected).strip():
                                            is_consistent = True
                                            break
                                    
                                    # 根据匹配策略生成场景说明
                                    strategy_desc = {
                                        "exact": "精确匹配",
                                        "fuzzy": "模糊匹配",
                                        "masked": "脱敏匹配"
                                    }.get(match_strategy, "未知匹配")
                                    
                                    reasoning = f"实际提取: '{slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'} ({strategy_desc})"
                                    
                                    enhanced_feature["slot_proofread_at"] = datetime.now().isoformat()
                                    enhanced_feature["slot_is_consistent"] = is_consistent
                                    enhanced_feature["slot_expected_value"] = expected_value
                                    enhanced_feature["slot_proofread_reasoning"] = reasoning
                                    logger.info(f"特征 {slot_name} 校对完成: {is_consistent} ({strategy_desc})")
                                    break  # 只处理第一个有效规则
                                else:
                                    logger.info(f"特征 {slot_name} 的规则 {rule_name} 没有期待值")
                        else:
                            logger.info(f"特征 {slot_name} 没有校对配置，跳过校对")
                            
                    except Exception as e:
                        logger.error(f"校对特征 {slot_name} 时出错: {e}")
                        # 即使校对失败，也继续处理其他特征
                
                enhanced_features.append(enhanced_feature)
            
            # 更新特征组的特征列表
            feature_group.evidence_features = enhanced_features
            
        logger.info(f"案件 {case.id} 校对处理完成")
        
    except Exception as e:
        logger.error(f"为案件 {case.id} 添加校对信息时出错: {e}")
        # 即使出错，也返回原始案件数据
    
    return case

async def get_by_id(db: AsyncSession, case_id: int) -> Optional[CaseModel]:
    """根据ID获取案件，包含校对信息"""
    query = select(CaseModel).options(
        joinedload(CaseModel.user),
        joinedload(CaseModel.association_evidence_features),
        joinedload(CaseModel.case_parties)
    ).where(CaseModel.id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()
    
    if case:
        # 添加校对信息
        case = await enhance_case_features_with_proofreading(case)
    
    return case


async def create(db: AsyncSession, obj_in: CaseCreate) -> CaseModel:
    """创建新案件"""
    # 验证案件基础信息
    await validate_case_basic_info(obj_in)
    
    # 验证当事人信息完整性
    await validate_case_parties_info(obj_in.case_parties)
    
    # 获取创建数据，排除case_parties字段
    create_data = obj_in.model_dump(exclude_unset=True, exclude={'case_parties'})
    
    # 创建案件对象
    db_obj = CaseModel(**create_data)
    
    # 添加案件到会话
    db.add(db_obj)
    await db.flush()  # 获取案件ID，但不提交事务
    
    # 创建关联的当事人
    if obj_in.case_parties:
        await create_case_parties_batch(db, db_obj.id, obj_in.case_parties)
    
    # 提交整个事务
    await db.commit()
    await db.refresh(db_obj, ['case_parties'])

    return db_obj


async def update(db: AsyncSession, db_obj: CaseModel, obj_in: CaseUpdate) -> CaseModel:
    """更新案件信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 更新基本属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    
    # 重新获取完整的案件数据，包含所有关系
    updated_case = await get_by_id(db, db_obj.id)
    if updated_case is None:
        # 这种情况不应该发生，因为我们刚刚更新了这个案件
        raise ValueError(f"Failed to retrieve updated case with id {db_obj.id}")
    return updated_case


async def delete(db: AsyncSession, case_id: int) -> bool:
    """删除案件"""
    case = await get_by_id(db, case_id)
    if not case:
        return False
    await db.delete(case)
    await db.commit()
    return True


async def get_multi_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, user_id: Optional[int] = None,
    sort_by: Optional[str] = None, sort_order: Optional[str] = "desc"
) -> Tuple[list[CaseModel], int]:
    """获取多个案件和总数，支持动态排序"""
    from loguru import logger
    
    # 添加调试日志
    logger.debug(f"Sorting parameters: sort_by={sort_by}, sort_order={sort_order}")
    
    # 构建基础查询，包含 joinedload
    query = select(CaseModel).options(
        joinedload(CaseModel.user),
        joinedload(CaseModel.case_parties)
    )
    
    if user_id is not None:
        query = query.where(CaseModel.user_id == user_id)

    # 查询总数
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    # 添加排序
    if sort_by:
        # 验证排序字段
        valid_sort_fields = {
            'created_at': CaseModel.created_at,
            'updated_at': CaseModel.updated_at,
            'loan_amount': CaseModel.loan_amount,
            'case_type': CaseModel.case_type,
            'case_status': CaseModel.case_status
        }
        
        if sort_by in valid_sort_fields:
            sort_column = valid_sort_fields[sort_by]
            if sort_order and sort_order.lower() == 'desc':
                logger.debug(f"Applying DESC sort on {sort_by}")
                query = query.order_by(sort_column.desc())
            else:
                logger.debug(f"Applying ASC sort on {sort_by}")
                query = query.order_by(sort_column.asc())
        else:
            # 默认按创建时间倒序
            logger.debug("Invalid sort field, using default DESC sort on created_at")
            query = query.order_by(CaseModel.created_at.desc())
    else:
        # 默认按创建时间倒序
        logger.debug("No sort field provided, using default DESC sort on created_at")
        query = query.order_by(CaseModel.created_at.desc())

    # 获取数据，保持 joinedload
    items_query = query.offset(skip).limit(limit)
    items_result = await db.execute(items_query)
    items = list(items_result.scalars().unique().all())

    return items, total
    
async def update_association_evidence_feature(
    db: AsyncSession, feature_id: int, update_data: dict
) -> Optional[AssociationEvidenceFeature]:
    """更新关联证据特征"""
    # 获取特征记录
    query = select(AssociationEvidenceFeature).where(AssociationEvidenceFeature.id == feature_id)
    result = await db.execute(query)
    feature = result.scalars().first()
    
    if not feature:
        return None
    
    # 更新属性
    for field, value in update_data.items():
        if hasattr(feature, field):
            setattr(feature, field, value)
    
    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    return feature


async def get_association_evidence_feature_by_id(
    db: AsyncSession, feature_id: int
) -> Optional[AssociationEvidenceFeature]:
    """根据ID获取关联证据特征"""
    query = select(AssociationEvidenceFeature).where(AssociationEvidenceFeature.id == feature_id)
    result = await db.execute(query)
    return result.scalars().first()


async def auto_process(
    db: AsyncSession, case_id: int, 
    evidence_ids: List[int], 
    send_progress: Any = None) -> Optional[List[AssociationEvidenceFeature]]:
    """自动处理案件"""
    
    evidence_ids = [int(eid) for eid in evidence_ids]
    evidences = []
    for evidence_id in evidence_ids:
        q = await db.execute(select(Evidence).where(Evidence.id == evidence_id, Evidence.case_id == case_id, Evidence.classification_category == "微信聊天记录"))
        if evidence := q.scalars().first():
            evidences.append(evidence)
    if not evidences:
        logger.error("未检索到有效的相关证据, 请确保证据已存在且已分类为`微信聊天记录`")
        return []
    
    # 发送开始处理进度
    if send_progress:
        await send_progress({
            "status": "processing",
            "message": "开始关联特征提取...",
            "progress": 10
        })
    
    association_features_extractor = AssociationFeaturesExtractor()
   
    
    # 发送AI处理进度
    if send_progress:
        await send_progress({
            "status": "llm_processing",
            "message": "AI正在分析证据内容...",
            "progress": 50
        })
    
    evidence_extraction_results: AssociationFeaturesExtractionResults = await asyncio.wait_for(
        association_features_extractor.arun(image_urls=[ev.file_url for ev in evidences]),
        timeout=180.0
    )
    
    results = evidence_extraction_results.results
    if not results:
        logger.error("证据特征提取失败")
        if send_progress:
            await send_progress({
                "status": "error",
                "message": "证据特征提取失败，未获取到有效结果"
            })
        return []
    
    # 预先查询所有相同case_id的记录，避免在循环中重复查询
    logger.info(f"预先查询case_id={case_id}的所有记录")
    all_features_query = await db.execute(
        select(AssociationEvidenceFeature).where(
            AssociationEvidenceFeature.case_id == case_id
        )
    )
    all_features = all_features_query.scalars().all()
    logger.info(f"当前case_id={case_id}的所有记录: {[(f.id, f.slot_group_name) for f in all_features]}")
    
    # 使用更宽松的字符串匹配，处理各种格式差异
    def normalize_string(s: str) -> str:
        """标准化字符串，处理各种格式差异"""
        import unicodedata
        
        # 1. Unicode标准化 (NFKC: 兼容性分解 + 组合)
        s = unicodedata.normalize('NFKC', s)
        
        # 2. 移除所有空白字符（包括空格、制表符、换行符等）
        s = ''.join(s.split())
        
        # 3. 统一常见的中英文标点符号
        replacements = {
            # 括号类
            '（': '(', '）': ')', '【': '[', '】': ']', '｛': '{', '｝': '}',
            # 数学符号
            '＋': '+', '－': '-', '×': '*', '÷': '/', '＝': '=', '≠': '!=',
            # 标点符号
            '：': ':', '；': ';', '，': ',', '。': '.', '！': '!', '？': '?',
            '、': ',', '…': '...', '—': '-', '–': '-',
            # 引号类
            '"': '"', '"': '"', ''': "'", ''': "'", '『': '"', '』': '"',
            # 其他常见符号
            '～': '~', '＠': '@', '＃': '#', '＄': '$', '％': '%', '＆': '&',
            '＊': '*', '＼': '\\', '｜': '|', '／': '/'
        }
        
        for old, new in replacements.items():
            s = s.replace(old, new)
        
        return s
    
    association_evidence_features = []
    for res in results:
        slot_group_name = res.slot_group_name
        slot_extraction = res.slot_extraction
        
        # 收集该result涉及的所有证据ID，并按照image_sequence_info排序
        all_evidence_ids = set()
        processed_evidence_features = []
        
        # 创建URL到证据ID的映射
        url_to_evidence_id = {}
        for evidence in evidences:
            url_to_evidence_id[evidence.file_url] = evidence.id
        
        # 按照image_sequence_info中的sequence_number排序证据ID
        sorted_evidence_ids = []
        for image_info in res.image_sequence_info:
            url = unquote(image_info.url)
            if url in url_to_evidence_id:
                sorted_evidence_ids.append(url_to_evidence_id[url])
        
        for slot in slot_extraction:
            slot_value_from_url = [unquote(url) for url in slot.slot_value_from_url]
            # 找到对应的证据ID
            slot_evidence_ids = []
            for url in slot_value_from_url:
                if url in url_to_evidence_id:
                    slot_evidence_ids.append(str(url_to_evidence_id[url]))  # 转换为字符串
                    all_evidence_ids.add(url_to_evidence_id[url])
            
            # 创建处理后的slot数据，将URL转换为ID字符串
            processed_slot = {
                "slot_name": slot.slot_name,
                "slot_desc": slot.slot_desc,
                "slot_value_type": slot.slot_value_type,
                "slot_required": slot.slot_required,
                "slot_value": slot.slot_value,
                "slot_value_from_url": slot_evidence_ids,
                "confidence": slot.confidence,
                "reasoning": slot.reasoning
            }
            processed_evidence_features.append(processed_slot)
        
        # 检查是否已存在相同的case_id和slot_group_name记录
        logger.info(f"检查重复记录: case_id={case_id}, slot_group_name='{slot_group_name}'")
        
        normalized_slot_group_name = normalize_string(slot_group_name)
        logger.info(f"标准化后的名称: '{slot_group_name}' -> '{normalized_slot_group_name}'")
        
        # 在预先查询的记录中查找标准化后匹配的记录
        existing_feature = None
        for feature in all_features:
            normalized_existing = normalize_string(feature.slot_group_name)
            if normalized_existing == normalized_slot_group_name:
                existing_feature = feature
                logger.info(f"找到匹配记录: '{feature.slot_group_name}' (ID: {feature.id})")
                break
        
        if not existing_feature:
            logger.info("未找到匹配的记录，将创建新记录")
        
        logger.info(f"查询结果: existing_feature={existing_feature.id if existing_feature else None}")
        
        # 发送数据库处理进度
        if send_progress:
            await send_progress({
                "status": "features_extracted",
                "message": f"正在处理特征组: {slot_group_name}",
                "progress": 80
            })
        
        if existing_feature:
            # 更新现有记录
            existing_feature.association_evidence_ids = sorted_evidence_ids
            existing_feature.evidence_features = processed_evidence_features
            existing_feature.features_extracted_at = datetime.now()
            existing_feature.evidence_feature_status = "features_extracted"  # 重置为特征已提取状态
            association_evidence_features.append(existing_feature)
        else:
            # 创建新记录，使用标准化的slot_group_name
            association_evidence_feature = AssociationEvidenceFeature(
                case_id=case_id,
                slot_group_name=normalized_slot_group_name,
                association_evidence_ids=sorted_evidence_ids,
                evidence_features=processed_evidence_features,
                features_extracted_at=datetime.now()
            )
            association_evidence_features.append(association_evidence_feature)
    
    # 批量保存或更新
    for feature in association_evidence_features:
        if feature.id is None:
            # 新记录，添加到数据库
            db.add(feature)
        # 现有记录会自动更新
    
    await db.commit()
    
    # 刷新所有记录以获取最新数据
    for association_evidence_feature in association_evidence_features:
        await db.refresh(association_evidence_feature)
    
    # 发送完成进度
    if send_progress:
        await send_progress({
            "status": "completed",
            "message": f"关联特征提取完成，共处理 {len(association_evidence_features)} 个特征组",
            "progress": 100
        })
    
    return association_evidence_features
