from datetime import datetime
from typing import Optional, Tuple, List, Callable, Awaitable
from fastapi import UploadFile

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from urllib.parse import unquote
from app.cases.models import Case as CaseModel, AssociationEvidenceFeature
from app.cases.schemas import CaseCreate, CaseUpdate, Case as CaseSchema
from agno.run.response import RunResponse
from agno.media import Image
import asyncio
from app.users.services import get_by_id_card, get_by_phone, create as create_user
from app.users.schemas import UserCreate
from app.cases.schemas import CaseRegistrationRequest, CaseRegistrationResponse
from app.users.schemas import User as UserSchema
from loguru import logger
from app.evidences.services import batch_create
from app.evidences.models import Evidence
from app.agentic.agents.association_features_extractor import AssociationFeaturesExtractor, AssociationFeaturesExtractionResults
from app.agentic.agents.evidence_proofreader import EvidenceProofreader

# 创建校对器实例
evidence_proofreader = EvidenceProofreader()

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
                                    slot_proofread_config = slot_config.get("proofread_with_case")
                                    break
                        
                        if slot_proofread_config:
                            # 执行校对 - slot_proofread_config是一个规则列表
                            for rule in slot_proofread_config:
                                case_fields = rule.get("case_fields", [])
                                expected_values = []
                                
                                # 从案件中获取期待值
                                for case_field in case_fields:
                                    case_value = getattr(case, case_field, None)
                                    if case_value is not None:
                                        expected_values.append(str(case_value))
                                
                                if expected_values:
                                    # 简单的精确匹配逻辑
                                    is_consistent = False
                                    expected_value = " 或 ".join(expected_values)  # 多个期待值用"或"连接
                                    
                                    for expected in expected_values:
                                        if str(slot_value).strip() == expected.strip():
                                            is_consistent = True
                                            break
                                    
                                    reasoning = f"实际提取: '{slot_value}', 期待值: '{expected_value}', {'匹配' if is_consistent else '不匹配'}"
                                    
                                    enhanced_feature["slot_proofread_at"] = datetime.now().isoformat()
                                    enhanced_feature["slot_is_consistent"] = is_consistent
                                    enhanced_feature["slot_expected_value"] = expected_value
                                    enhanced_feature["slot_proofread_reasoning"] = reasoning
                                    logger.info(f"特征 {slot_name} 校对完成: {is_consistent}")
                                    break  # 只处理第一个有效规则
                                else:
                                    logger.info(f"特征 {slot_name} 的规则 {rule.get('rule_name')} 没有期待值")
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
        joinedload(CaseModel.association_evidence_features)
    ).where(CaseModel.id == case_id)
    result = await db.execute(query)
    case = result.scalars().first()
    
    if case:
        # 添加校对信息
        case = await enhance_case_features_with_proofreading(case)
    
    return case


async def create(db: AsyncSession, obj_in: CaseCreate) -> CaseModel:
    """创建新案件"""
    db_obj = CaseModel(
        description=obj_in.description,
        case_type=obj_in.case_type,
        creditor_name=obj_in.creditor_name,
        creditor_type=obj_in.creditor_type,
        debtor_name=obj_in.debtor_name,
        debtor_type=obj_in.debtor_type,
        user_id=obj_in.user_id,
        loan_amount=obj_in.loan_amount,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def update(db: AsyncSession, db_obj: CaseModel, obj_in: CaseUpdate) -> CaseModel:
    """更新案件信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


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
    query = select(CaseModel).options(joinedload(CaseModel.user))
    
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
            'creditor_name': CaseModel.creditor_name,
            'debtor_name': CaseModel.debtor_name,
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
    items = items_result.scalars().all()

    return items, total


async def register_case_with_user(db: AsyncSession, obj_in: CaseRegistrationRequest) -> CaseRegistrationResponse:
    """综合录入案件和用户"""
    # 1. 检查用户是否已存在（通过身份证号或手机号）
    is_new_user = False
    existing_user = None
    if obj_in.user_id_card:
        existing_user = await get_by_id_card(db, obj_in.user_id_card)
    if obj_in.user_phone:
        existing_user = await get_by_phone(db, obj_in.user_phone)
    
    # 2. 如果用户不存在，创建新用户
    if not existing_user:
        user_in = UserCreate(
            name=obj_in.user_name,
            id_card=obj_in.user_id_card,
            phone=obj_in.user_phone
        )
        user = await create_user(db, user_in)
        is_new_user = True
    else:
        user = existing_user
    
    # 3. 自动生成title: "债权人 VS 债务人 的 案件类型"
    title = f"{obj_in.creditor_name} vs {obj_in.debtor_name}"
    
    # 4. 创建案件
    case_in = CaseCreate(
        user_id=user.id,
        title=title,  # 使用自动生成的title
        description=obj_in.description,
        case_type=obj_in.case_type,
        creditor_name=obj_in.creditor_name,
        creditor_type=obj_in.creditor_type,
        debtor_name=obj_in.debtor_name,
        debtor_type=obj_in.debtor_type
    )
    case = await create(db, case_in)
    
    # 5. 构建响应
    return CaseRegistrationResponse(
        user=UserSchema.model_validate(user),
        case=CaseSchema.model_validate(case),
        is_new_user=is_new_user
    )

    
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
    send_progress: Callable[[dict], Awaitable[None]] = None) -> Optional[List[AssociationEvidenceFeature]]:
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
    
    run_response: RunResponse = await asyncio.wait_for(
        association_features_extractor.arun(image_urls=[ev.file_url for ev in evidences]),
        timeout=180.0
    )
    
    evidence_extraction_results: AssociationFeaturesExtractionResults = run_response.content
    
    results = evidence_extraction_results.results
    if not results:
        logger.error("证据特征提取失败")
        if send_progress:
            await send_progress({
                "status": "error",
                "message": "证据特征提取失败，未获取到有效结果"
            })
        return []
    
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
        # 添加调试日志
        logger.info(f"检查重复记录: case_id={case_id}, slot_group_name='{slot_group_name}'")
        
        # 先查询所有相同case_id的记录，看看是否有重复
        all_features = await db.execute(
            select(AssociationEvidenceFeature).where(
                AssociationEvidenceFeature.case_id == case_id
            )
        )
        all_features = all_features.scalars().all()
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
        
        normalized_slot_group_name = normalize_string(slot_group_name)
        logger.info(f"标准化后的名称: '{slot_group_name}' -> '{normalized_slot_group_name}'")
        
        # 查询所有相同case_id的记录，进行模糊匹配
        all_features = await db.execute(
            select(AssociationEvidenceFeature).where(
                AssociationEvidenceFeature.case_id == case_id
            )
        )
        all_features = all_features.scalars().all()
        
        # 在现有记录中查找标准化后匹配的记录
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
