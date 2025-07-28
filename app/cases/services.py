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

async def get_by_id(db: AsyncSession, case_id: int) -> Optional[CaseModel]:
    """根据ID获取案件"""
    query = select(CaseModel).options(
        joinedload(CaseModel.user),
        joinedload(CaseModel.association_evidence_features)
    ).where(CaseModel.id == case_id)
    result = await db.execute(query)
    return result.scalars().first()


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
    db: AsyncSession, *, skip: int = 0, limit: int = 100, user_id: Optional[int] = None
) -> Tuple[list[CaseModel], int]:
    """获取多个案件和总数"""
    # 构建基础查询，包含 joinedload
    query = select(CaseModel).options(joinedload(CaseModel.user))
    
    if user_id is not None:
        query = query.where(CaseModel.user_id == user_id)

    # 查询总数
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    # 查询数据，保持 joinedload
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
    message_parts = ["请从以下证据图片中提取关键信息:"]
    for i, e in enumerate(evidences):
        message_parts.append(f"\n{i+1}. url: {e.file_url}")
    message = "\n".join(message_parts)
    
    # 发送AI处理进度
    if send_progress:
        await send_progress({
            "status": "llm_processing",
            "message": "AI正在分析证据内容...",
            "progress": 50
        })
    
    run_response: RunResponse = await asyncio.wait_for(
        association_features_extractor.agent.arun(message, images=[Image(url=ev.file_url) for ev in evidences]),
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
        
        # 收集该result涉及的所有证据ID
        all_evidence_ids = set()
        processed_evidence_features = []
        
        for slot in slot_extraction:
            slot_value_from_url = [unquote(url) for url in slot.slot_value_from_url]
            # 找到对应的证据ID
            slot_evidence_ids = []
            for url in slot_value_from_url:
                for evidence in evidences:
                    if evidence.file_url == url:
                        slot_evidence_ids.append(str(evidence.id))  # 转换为字符串
                        all_evidence_ids.add(evidence.id)
                        break
            
            # 创建处理后的slot数据，将URL转换为ID字符串
            processed_slot = {
                "slot_name": slot.slot_name,
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
            # 1. 中英文括号转换
            s = s.replace('（', '(').replace('）', ')')
            # 2. 移除所有空格
            s = s.replace(' ', '')
            # 3. 统一标点符号（可选，根据需要添加）
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
            existing_feature.association_evidence_ids = list(all_evidence_ids)
            existing_feature.evidence_features = processed_evidence_features
            existing_feature.features_extracted_at = datetime.now()
            existing_feature.validation_status = "pending"  # 重置验证状态
            association_evidence_features.append(existing_feature)
        else:
            # 创建新记录，使用标准化的slot_group_name
            association_evidence_feature = AssociationEvidenceFeature(
                case_id=case_id,
                slot_group_name=normalized_slot_group_name,
                association_evidence_ids=list(all_evidence_ids),
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
