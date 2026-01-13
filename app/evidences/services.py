import os
from typing import BinaryIO, Dict, List, Optional, Union, Callable, Awaitable, Any, cast
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime
from app.agentic.agents.evidence_classifier_v2 import EvidenceClassifier, EvidenceClassifiResults
from app.agentic.agents.evidence_extractor_v2 import EvidenceFeaturesExtractor, EvidenceExtractionResults, EvidenceImage
import asyncio
from urllib.parse import unquote
from pydantic import BaseModel
from app.evidences.models import EvidenceCard, Evidence, EvidenceCardSlotAssignment

from loguru import logger
from agno.media import Image
from agno.run.response import RunResponse
from app.evidences.models import Evidence, EvidenceStatus
from app.cases.models import Case
from app.evidences.schemas import (
    EvidenceEditRequest, 
    UploadFileResponse,
    EvidenceCardUpdateRequest
)
from app.integrations.cos import cos_service
from app.agentic.agents.evidence_proofreader import evidence_proofreader
from app.cases.models import Case, CaseParty, PartyType, CaseType
from app.core.config_manager import config_manager
from app.evidences.schemas import (
    EvidenceCardSlotTemplatesResponse,
    EvidenceCardSlotTemplate,
    EvidenceCardTemplate,
    EvidenceCardSlot,
    CardSlotProofreadResponse,
    SlotProofreadResult
)


def _get_case_field_value(case, case_field: str, role: Optional[str] = None, slot_name: Optional[str] = None) -> Any:
    """从案件中获取字段值，适配新的case_parties数据结构
    
    Args:
        case: 案件对象
        case_field: 字段名（如 creditor_name, debtor_name, loan_amount等）
        role: 角色（creditor或debtor），如果配置中指定了role
        slot_name: 证据槽位名称，用于确定具体的映射逻辑
        
    Returns:
        字段值或None
    """
    # 处理基本案件字段（非当事人相关）
    if case_field == "loan_amount":
        return getattr(case, "loan_amount", None)
    elif case_field == "case_type":
        return getattr(case, "case_type", None)
    
    # 处理当事人相关字段
    if not case.case_parties:
        return None
    
    # 确定目标角色
    target_role = None
    if role:
        target_role = role
    elif case_field.startswith("creditor"):
        target_role = "creditor"
    elif case_field.startswith("debtor"):
        target_role = "debtor"
    
    if not target_role:
        # 如果无法确定角色，尝试直接从案件对象获取
        return getattr(case, case_field, None)
    
    # 查找对应角色的当事人
    target_party = None
    for party in case.case_parties:
        if party.party_role == target_role:
            target_party = party
            break
    
    if not target_party:
        return None
    
    # 根据字段名和槽位名称确定从哪个字段获取值
    # 这里是关键：我们需要将旧的case字段映射到新的party字段
    if case_field in ["creditor_name", "debtor_name"]:
        # 根据槽位名称决定具体的映射逻辑
        if slot_name == "法定代表人":
            # 法定代表人应该校对主体信息中的name字段
            return target_party.name
        elif slot_name in ["公司名称", "经营名称"]:
            # 公司名称或经营名称校对party_name
            return target_party.party_name
        else:
            # 默认情况（如个人姓名）校对party_name
            return target_party.party_name
    elif case_field in ["creditor_phone", "debtor_phone"]:
        # 电话号码存储在phone字段中
        return target_party.phone
    else:
        # 对于其他字段，尝试直接从案件对象获取
        return getattr(case, case_field, None)


def _normalize_numeric_value(value: Any) -> Any:
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


async def enhance_evidence_with_proofreading(evidence: Evidence, db: AsyncSession) -> Evidence:
    """为证据添加校对信息"""
    
    if not evidence.evidence_features:
        return evidence
        
    if not evidence.case_id:
        return evidence
        
    if not evidence.case:
        logger.warning(f"证据 {evidence.id} 的case数据未加载，跳过校对")
        return evidence
    
    # 强制重新校对（清除旧的校对信息）
    logger.info(f"证据 {evidence.id} 强制重新校对，清除旧的校对信息")
    
    # 清除所有校对信息
    if evidence.evidence_features:
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                # 清除校对相关字段
                feature.pop("slot_proofread_at", None)
                feature.pop("slot_is_consistent", None)
                feature.pop("slot_expected_value", None)
                feature.pop("slot_proofread_reasoning", None)
    
    logger.info(f"证据 {evidence.id} 开始执行校对")
    
    try:
        # 执行校对
        proofread_result = await evidence_proofreader.proofread_evidence_features(
            db=db,
            evidence=evidence,
            case=evidence.case  # 假设case已经通过joinedload加载
        )
        
        if proofread_result and proofread_result.proofread_results:
            logger.info(f"证据 {evidence.id} 校对完成，结果数量: {len(proofread_result.proofread_results)}")
            # 为每个特征添加校对信息
            enhanced_features = []
            
            for feature in evidence.evidence_features:
                # 转换为dict格式
                if isinstance(feature, dict):
                    enhanced_feature = feature.copy()
                else:
                    # 如果不是dict，转换为dict
                    if hasattr(feature, 'model_dump'):
                        enhanced_feature = feature.model_dump()
                    else:
                        enhanced_feature = dict(feature) if hasattr(feature, '__dict__') else feature
                
                # 查找对应的校对结果
                slot_name = enhanced_feature.get("slot_name") if isinstance(enhanced_feature, dict) else getattr(enhanced_feature, 'slot_name', None)
                if slot_name:
                    for proofread_item in proofread_result.proofread_results:
                        if proofread_item.field_name == slot_name:
                            # 添加校对信息到slot级别
                            if isinstance(enhanced_feature, dict):
                                enhanced_feature.update({
                                    "slot_is_consistent": proofread_item.is_consistent,
                                    "slot_proofread_at": datetime.now().isoformat(),
                                    "slot_proofread_reasoning": proofread_item.proofread_reasoning,
                                    "slot_expected_value": proofread_item.expected_value
                                })
                                logger.info(f"为槽位 {slot_name} 添加校对信息: consistent={proofread_item.is_consistent}, expected={proofread_item.expected_value}")
                            else:
                                logger.warning(f"slot '{slot_name}' 不是dict格式，无法添加校对信息")
                            break
                
                enhanced_features.append(enhanced_feature)
            
            # 更新evidence的features（仅在内存中）
            evidence.evidence_features = enhanced_features
        else:
            logger.warning(f"证据 {evidence.id} 没有校对结果")
            
    except Exception as e:
        logger.error(f"为证据 {evidence.id} 添加校对信息失败: {str(e)}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        # 校对失败不影响返回，返回原始数据
    

    return evidence


async def get_by_id(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据，包含案件信息和校对功能"""
    result = await db.execute(
        select(Evidence).where(Evidence.id == evidence_id).options(
            joinedload(Evidence.case).joinedload(Case.case_parties)
        )
    )
    evidence = result.scalars().first()
    
    if evidence:
        # 添加校对信息
        evidence = await enhance_evidence_with_proofreading(evidence, db)
    
    return evidence

async def get_multi_by_ids(db: AsyncSession, evidence_ids: List[int]) -> List[Evidence]:
    """根据ID列表获取证据"""
    result = await db.execute(select(Evidence).where(Evidence.id.in_(evidence_ids)))
    return result.scalars().all()

async def get_by_id_with_case(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据，包含案件信息"""
    result = await db.execute(
        select(Evidence).where(Evidence.id == evidence_id).options(
            joinedload(Evidence.case).joinedload(Case.case_parties)
        )
    )
    return result.scalars().first()


async def upload_file(
    file: BinaryIO, filename: str, disposition: str = 'inline'
) -> UploadFileResponse:
    """上传文件到COS"""
    from loguru import logger
    from app.utils.filename_utils import sanitize_filename_for_llm, validate_filename_for_llm
    
    # 验证和清理文件名
    is_valid, error_msg = validate_filename_for_llm(filename)
    if not is_valid:
        logger.warning(f"文件名可能有问题: {filename}, 错误: {error_msg}")
        # 清理文件名
        original_filename = filename
        filename = sanitize_filename_for_llm(filename)
        logger.info(f"文件名已清理: {original_filename} -> {filename}")
    
    # 获取文件扩展名
    _, file_extension = os.path.splitext(filename)
    file_extension = file_extension.lower().lstrip(".")
    
    # 支持多种文件格式
    supported_formats = [
        # 图片格式
        "jpg", "jpeg", "png", "bmp", "webp", "gif", "svg",
        # 文档格式
        "pdf", "doc", "docx", "txt",
        # 表格格式
        "xls", "xlsx", "csv",
        # 其他格式
        "mp3", "mp4", "wav", "m4a", "avi", "mov", "wmv"
    ]
    
    if file_extension not in supported_formats:
        logger.error(f"不支持的文件格式: {file_extension}, 支持格式: {supported_formats}")
        raise ValueError(f"不支持的文件格式: {file_extension}，支持的格式: {', '.join(supported_formats)}")
    
    # 根据文件类型确定存储文件夹
    if file_extension in ["jpg", "jpeg", "png", "bmp", "webp", "gif", "svg"]:
        folder = "images"
    elif file_extension in ["pdf", "doc", "docx", "txt"]:
        folder = "documents"
    elif file_extension in ["xls", "xlsx", "csv"]:
        folder = "spreadsheets"
    elif file_extension in ["mp3", "wav", "m4a"]:
        folder = "audio"
    elif file_extension in ["mp4", "avi", "mov", "wmv"]:
        folder = "videos"
    else:
        folder = "others"
    
    # 获取文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    try:
        # 检查文件内容是否为空
        first_bytes = file.read(10)
        file.seek(0)
        if not first_bytes:
            logger.error(f"文件内容为空: {filename}")
            raise ValueError("文件内容为空")
        
        # 上传文件到COS
        file_url = cos_service.upload_file(file, filename, folder, disposition)
        
        return UploadFileResponse(
            file_url=file_url,
            file_name=filename,
            file_size=file_size,
            file_extension=file_extension,
        )
    except Exception as e:
        logger.error(f"文件上传失败: {filename}, 错误: {str(e)}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        raise


async def update(db: AsyncSession, db_obj: Evidence, obj_in: EvidenceEditRequest) -> Evidence:
    """更新证据信息"""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    # 更新属性
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    
    # 重新获取完整的evidence对象，包括case关系和校对信息
    updated_evidence = await get_by_id(db, db_obj.id)
    return updated_evidence


async def delete(db: AsyncSession, evidence_id: int) -> bool:
    """删除证据
    
    Note:
        - 删除证据时，不需要处理任何关联，EvidenceCard的evidence_ids字段保持不变
        - 由于SQLAlchemy的relationship行为，我们需要确保不在删除前加载关联关系，让数据库外键约束正常工作
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    # 使用select直接查询，不加载relationship，避免SQLAlchemy干预关联表的删除行为
    result = await db.execute(
        select(Evidence).where(Evidence.id == evidence_id)
    )
    evidence = result.scalar_one_or_none()
    
    if not evidence:
        return False
    
    # 从COS删除文件
    # 从URL中提取对象键
    file_url = evidence.file_url
    object_key = file_url.split(".com/")[-1] if ".com/" in file_url else file_url
    cos_service.delete_file(object_key)
    
    # 从数据库删除记录
    # 注意：不加载evidence_cards关系，让数据库外键约束SET NULL正常工作
    await db.delete(evidence)
    await db.commit()
    return True


async def get_multi_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, case_id: Optional[int] = None, search: Optional[str] = None,
    sort_by: Optional[str] = None, sort_order: Optional[str] = "desc"
):
    """获取多个证据，并返回总数，支持动态排序"""
    from loguru import logger
    
    query = select(Evidence).options(
        joinedload(Evidence.case).joinedload(Case.case_parties)
    )
    if case_id is not None:
        query = query.where(Evidence.case_id == case_id)
    if search:
        query = query.where(Evidence.file_name.ilike(f"%{search}%"))

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 添加排序
    if sort_by:
        # 验证排序字段
        valid_sort_fields = {
            'created_at': Evidence.created_at,
            'updated_at': Evidence.updated_at,
            'file_name': Evidence.file_name,
            'file_size': Evidence.file_size,
            'evidence_status': Evidence.evidence_status,
            'classification_category': Evidence.classification_category,
            'classification_confidence': Evidence.classification_confidence
        }
        
        if sort_by in valid_sort_fields:
            sort_column = valid_sort_fields[sort_by]
            if sort_order and sort_order.lower() == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            # 默认按创建时间倒序
            query = query.order_by(Evidence.created_at.desc())
    else:
        # 默认按创建时间倒序
        query = query.order_by(Evidence.created_at.desc())

    # 获取数据
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    data = list(result.scalars().unique().all())

    # 为每个证据添加校对信息
    enhanced_data = []
    for evidence in data:
        enhanced_evidence = await enhance_evidence_with_proofreading(evidence, db)
        enhanced_data.append(enhanced_evidence)

    return data, total


async def get_multi_with_cases(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> list[Evidence]:
    """获取多个证据，包含案件信息"""
    query = select(Evidence).options(
        joinedload(Evidence.case).joinedload(Case.case_parties)
    ).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def get_multi_with_cases_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
):
    """获取多个证据，包含案件信息，并返回总数"""
    query = select(Evidence).options(
        joinedload(Evidence.case).joinedload(Case.case_parties)
    )

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 获取数据
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    data = list(result.scalars().unique().all())

    return data, total

async def list_evidences_by_case_id(db: AsyncSession, case_id: int, search: Optional[str] = None, skip: int = 0, limit: int = 100,
    sort_by: Optional[str] = None, sort_order: Optional[str] = "desc"):
    """根据案件ID获取证据"""
    query = select(Evidence).options(
        joinedload(Evidence.case).joinedload(Case.case_parties)
    ).where(Evidence.case_id == case_id)
    if search:
        query = query.where(Evidence.file_name.ilike(f"%{search}%"))
    if sort_by:
        query = query.order_by(getattr(Evidence, sort_by).desc() if sort_order == "desc" else getattr(Evidence, sort_by).asc())
    else:
        query = query.order_by(Evidence.created_at.desc())
    query = query.offset(skip).limit(limit)
    if total := await db.scalar(select(func.count()).select_from(query.subquery())) is None:
        total = 0
    
    result = await db.execute(query)
    data = list(result.scalars().unique().all())
    return data, total


async def list_evidence_cards_by_case_id(
    db: AsyncSession, 
    case_id: int, 
    skip: int = 0, 
    limit: int = 100
) -> List[EvidenceCard]:
    """根据案件ID获取证据卡片"""
    from sqlalchemy import select
    
    query = select(EvidenceCard).where(
        EvidenceCard.case_id == case_id
    ).order_by(EvidenceCard.updated_times.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().unique().all())


async def batch_create(
    db: AsyncSession,
    case_id: int,
    files: List[UploadFile],
) -> List[Evidence]:
    """批量创建证据
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        tags: 标签列表
        files: 文件列表
        staff_id: 上传人员ID
        
    Returns:
        创建的证据列表
    """
    from loguru import logger
    
    evidences = []
    
    for index, file in enumerate(files):
        try:
            # 上传单个文件
            file_data = await upload_file(file.file, file.filename)
            
            # 创建单个证据
            db_obj = Evidence(
                file_url=file_data.file_url,
                file_name=file_data.file_name,
                file_size=file_data.file_size,
                file_extension=file_data.file_extension,
                case_id=case_id,
                evidence_status=EvidenceStatus.UPLOADED.value,
            )
            db.add(db_obj)
            evidences.append(db_obj)
        except Exception as e:
            # 如果上传失败，记录错误并继续处理下一个文件
            logger.error(f"文件处理失败: {file.filename}, 错误: {str(e)}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
            continue
    
    if evidences:
        # 一次性提交所有证据
        try:
            await db.commit()
            
            # 使用 select 查询并加载关联关系，避免 MissingGreenlet 错误
            # 直接 refresh 无法在异步会话中正确加载 lazy='joined' 的关系
            stmt = select(Evidence).options(
                joinedload(Evidence.case)
            ).where(Evidence.id.in_([e.id for e in evidences]))
            
            result = await db.execute(stmt)
            # 保持原始顺序（如果重要的话，或者直接返回查询结果）
            # 这里简单返回查询到的及其，顺序可能变但不影响功能
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"数据库提交失败: {str(e)}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
            return []
    else:
        logger.warning("没有成功创建任何证据")
    
    return evidences


async def batch_delete(
    db: AsyncSession, evidence_ids: List[int]
) -> Dict[str, List[Union[int, str]]]:
    """批量删除证据
    
    Args:
        db: 数据库会话
        evidence_ids: 证据ID列表
        
    Returns:
        包含成功和失败删除的字典
        
    Note:
        - 删除证据时，不需要处理任何关联，EvidenceCard的evidence_ids字段保持不变
        - 由于SQLAlchemy的relationship行为，我们需要确保不在删除前加载关联关系，让数据库外键约束正常工作
    """
    from sqlalchemy import select
    
    successful = []
    failed = []
    object_keys = []
    deleted_evidences = []  # 保存被删除的证据信息，用于后续处理
    
    # 先获取所有证据信息（在删除前）
    # 使用select直接查询，不加载relationship，避免SQLAlchemy干预关联表的删除行为
    for evidence_id in evidence_ids:
        result = await db.execute(
            select(Evidence).where(Evidence.id == evidence_id)
        )
        evidence = result.scalar_one_or_none()
        
        if not evidence:
            failed.append(f"证据ID {evidence_id} 不存在")
            continue
        
        # 保存证据信息用于后续处理
        deleted_evidences.append(evidence)
        
        # 从URL中提取对象键
        file_url = evidence.file_url
        object_key = file_url.split(".com/")[-1] if ".com/" in file_url else file_url
        object_keys.append(object_key)
        
        # 标记为删除
        # 注意：不加载evidence_cards关系，让数据库外键约束SET NULL正常工作
        await db.delete(evidence)
        successful.append(evidence_id)
    
    # 删除关联的association_evidence_features记录
    # 检查是否包含"微信聊天记录"类型的证据
    from app.cases.models import AssociationEvidenceFeature
    from sqlalchemy import select
    
    # 获取被删除的"微信聊天记录"类型的证据ID
    wechat_evidence_ids = [
        e.id for e in deleted_evidences 
        if e.classification_category == "微信聊天记录"
    ]
    
    # 如果包含"微信聊天记录"类型的证据，删除所有相关的association_evidence_features记录
    if wechat_evidence_ids:
        # 查找所有包含被删除证据ID的关联特征记录
        for evidence_id in wechat_evidence_ids:
            # 使用正确的 JSONB 操作符来检查数组是否包含特定值
            # association_evidence_ids 存储的是整数列表，所以我们需要检查是否包含整数
            association_features = await db.execute(
                select(AssociationEvidenceFeature).where(
                    AssociationEvidenceFeature.association_evidence_ids.contains([evidence_id])
                )
            )
            association_features = association_features.scalars().all()
            
            # 直接删除所有包含被删除证据ID的关联特征记录
            for feature in association_features:
                await db.delete(feature)
    
    # 批量删除COS文件
    if object_keys:
        for object_key in object_keys:
            cos_service.delete_file(object_key)
    
    # 提交数据库事务
    # 注意：删除证据时，不需要处理任何关联，EvidenceCard的evidence_ids字段保持不变
    await db.commit()
    
    return {"successful": successful, "failed": failed}


async def batch_check_evidence(
    db: AsyncSession,
    evidence_ids: List[int]
) -> List[Evidence]:
    """批量审核证据"""
    evidences: List[Evidence] = await get_multi_by_ids(db, evidence_ids)
    for evidence in evidences:
        if evidence.evidence_status == EvidenceStatus.FEATURES_EXTRACTED.value:
            evidence.evidence_status = EvidenceStatus.CHECKED.value
            db.add(evidence)
    await db.commit()
    for evidence in evidences:
        await db.refresh(evidence)
    return evidences


async def batch_create_with_classification(
    db: AsyncSession,
    case_id: int,
    files: List[UploadFile],
    send_progress: Any = None
) -> List[Evidence]:
    """批量创建证据并进行AI分类"""
    from loguru import logger
    from app.agentic.services import classify_evidence
    
    # 1. 使用现有的 batch_create 创建证据记录
    evidences = await batch_create(db, case_id, files)
    
    if not evidences:
        return evidences
    
    # 2. 调用现有的分类服务
    try:
        classification_result = await classify_evidence(files, send_progress)
        
        # 3. 更新证据的分类信息
        for i, evidence in enumerate(evidences):
            if i < len(classification_result.results):  # 修改：evidences -> results
                result = classification_result.results[i]  # 修改：evidences -> results
                evidence.evidence_type = result.evidence_type.value
                evidence.classification_confidence = result.confidence
                evidence.classification_reasoning = result.reasoning
                evidence.is_classified = True
                
        # 4. 批量更新数据库
        await db.commit()
        for evidence in evidences:
            await db.refresh(evidence)
            
    except Exception as e:
        logger.error(f"分类失败，但证据已上传: {str(e)}")
        # 分类失败不影响证据上传，只是 is_classified 保持 False
    
    return evidences


async def auto_process(
    db: AsyncSession,
    case_id: int,
    files: Optional[List[UploadFile]] = None,
    evidence_ids: Optional[List[int]] = None,
    auto_classification: bool = False,
    auto_feature_extraction: bool = False,
    send_progress: Any = None
)-> List[Evidence]:
    
    # 类型安全：确保 evidence_ids 为 int 列表
    if evidence_ids is not None:
        evidence_ids = [int(eid) for eid in evidence_ids]

    has_files = files is not None and len(files) > 0
    has_evidence_ids = evidence_ids is not None and len(evidence_ids) > 0
    
    if not has_files and not has_evidence_ids:
        logger.error("auto_process: 必须提供 files 或 evidence_ids")
        return []
    
    if has_files and has_evidence_ids:
        logger.error("auto_process: files 和 evidence_ids 不能同时提供")
        return []

    # 1. 使用现有的 batch_create 创建证据记录或根据 evidence_ids 检索证据
    if files:
        evidences = await batch_create(db, case_id, files)
        if send_progress:
            await send_progress({
                "status": "uploaded", 
                "message": "文件已成功上传",
                "current": len(evidences),
                "total": len(evidences)
            })
    elif evidence_ids:
        evidences = []
        for evidence_id in evidence_ids:
            q = await db.execute(select(Evidence).where(Evidence.id == evidence_id, Evidence.case_id == case_id))
            if evidence := q.scalars().first():
                evidences.append(evidence)
    else:
        evidences = []
    # 支持多种文件格式，但AI处理可能只支持特定格式
    # 这里可以根据需要调整支持的文件类型
    supported_ai_formats = [
        # 图片格式 - AI可以处理
        "jpg", "jpeg", "png", "bmp", "webp",
        # 其他格式暂时不支持AI处理，但可以上传
        # "doc", "docx", "txt", "xls", "xlsx", "csv", "mp3", "mp4", "wav", "m4a", "avi", "mov", "wmv"
    ]
    
    # 过滤出支持AI处理的文件
    ai_processable_evidences = [
        evidence
        for evidence in evidences
        if evidence.file_extension in supported_ai_formats
    ]
    
    # 如果启用AI处理，只处理支持的文件
    if auto_classification or auto_feature_extraction:
        evidences = ai_processable_evidences
        if not evidences:
            logger.warning("没有支持AI处理的文件格式")
            return []
    if not evidences:
        logger.warning("没有证据要处理")
        return []
    
    # 2. 证据分类（可选）
    if auto_classification:
        try:
            if send_progress:
                await send_progress({
                    "status": "classifying", 
                    "message": "开始证据分类分析",
                    "progress": 10  # 固定进度：10%
                })
            
            evidence_classifier = EvidenceClassifier()
            # message_parts = ["请对以下证据进行分类："]
            # for i, ev in enumerate(evidences):
            #     message_parts.append(f"{i+1}. file_url: {ev.file_url}")
            # messages = "\n".join(message_parts)
            
            # 设置超时时间（3分钟）
            import asyncio
            run_response: RunResponse = await asyncio.wait_for(
                evidence_classifier.arun([ev.file_url for ev in evidences]),
                timeout=180.0
            )
            
            evidence_classifi_results: EvidenceClassifiResults = run_response.content
            if results := evidence_classifi_results.results:
                from urllib.parse import unquote
                for res in results:
                    res_url = unquote(res.image_url)
                    for evidence in evidences:
                        ev_url = unquote(evidence.file_url)
                        if ev_url == res_url:
                            # 检查分类结果是否有效
                            if res.evidence_type and res.evidence_type.strip() and res.confidence > 0:
                                # 只有有效的分类结果才更新状态
                                evidence.classification_category = res.evidence_type
                                evidence.classification_confidence = res.confidence
                                evidence.classification_reasoning = res.reasoning
                                evidence.classified_at = datetime.now()
                                evidence.evidence_status = EvidenceStatus.CLASSIFIED.value
                            else:
                                # 无效的分类结果，不更新状态
                                logger.warning(f"无效分类结果: {evidence.file_name} -> evidence_type='{res.evidence_type}', confidence={res.confidence}")
                                # 保持原有状态，不更新为已分类
                            db.add(evidence)
                            break
                await db.commit()
                for evidence in evidences:
                    await db.refresh(evidence)
            
            if send_progress:
                await send_progress({
                    "status": "classified", 
                    "message": "证据分类完成",
                    "progress": 25  # 固定进度：25%
                })
                
        except asyncio.TimeoutError:
            if send_progress:
                await send_progress({
                    "status": "error", 
                    "message": "证据分类超时，请稍后重试",
                    "current": 0,
                    "total": len(evidences)
                })
            raise Exception("证据分类超时")
        except Exception as e:
            if send_progress:
                await send_progress({
                    "status": "error", 
                    "message": f"证据分类失败: {str(e)}",
                    "current": 0,
                    "total": len(evidences)
                })
            raise

    # 3. 证据特征提取（可选，且只能在分类后）
    if auto_feature_extraction:
        try:
            if send_progress:
                await send_progress({
                    "status": "extracting", 
                    "message": "开始证据特征分析",
                    "progress": 30  # 固定进度：30%
                })
            
            # 定义支持OCR的证据类型
            ocr_supported_types = {
                "公司营业执照",
                "个体工商户营业执照", 
                "身份证",
                "增值税发票",
                "公司全国企业公示系统营业执照",
                "个体工商户全国企业公示系统营业执照"
            }
            
            # 分离需要OCR处理和需要LLM处理的证据
            ocr_evidences = []
            llm_evidences = []
            
            for evidence in evidences:
                # 只有已分类且有效的证据才进行特征提取
                if evidence.evidence_status == EvidenceStatus.CLASSIFIED.value and evidence.classification_category:
                    if evidence.classification_category in ocr_supported_types:
                        ocr_evidences.append(evidence)
                    else:
                        if evidence.classification_category != "微信聊天记录":  # 微信聊天记录不使用独立证据分析agent,而是另外的agent
                            llm_evidences.append(evidence)
                else:
                    logger.warning(f"跳过特征提取: {evidence.file_name} - 状态: {evidence.evidence_status}, 分类: {evidence.classification_category}")
            
            # 处理OCR支持的证据类型
            if ocr_evidences:
                if send_progress:
                    await send_progress({
                        "status": "ocr_processing", 
                        "message": f"开始OCR处理 {len(ocr_evidences)} 个证据",
                        "progress": 40  # OCR阶段开始：40%
                    })
                
                from app.utils.xunfei_ocr import XunfeiOcrService
                ocr_service = XunfeiOcrService()
                
                for i, evidence in enumerate(ocr_evidences):
                    try:
                        # 更新进度：OCR阶段内进度 (40% → 60%)
                        if send_progress:
                            ocr_progress = 40 + int((i / len(ocr_evidences)) * 20)  # 40% + (i/total) * 20%
                            await send_progress({
                                "status": "ocr_processing", 
                                "message": f"OCR处理中: {evidence.file_name}",
                                "progress": ocr_progress
                            })
                        
                        # 调用OCR服务
                        ocr_result = ocr_service.extract_evidence_features(
                            evidence.file_url, 
                            evidence.classification_category
                        )
                        
                        if "error" not in ocr_result and ocr_result.get("evidence_features"):
                            # 更新证据记录
                            evidence.evidence_features = ocr_result["evidence_features"]
                            evidence.features_extracted_at = datetime.now()
                            evidence.evidence_status = EvidenceStatus.FEATURES_EXTRACTED.value
                            db.add(evidence)
                            
                            # 立即提交这个证据的更新
                            await db.commit()
                            await db.refresh(evidence)
                            
                            if send_progress:
                                ocr_progress = 40 + int(((i + 1) / len(ocr_evidences)) * 20)  # 40% + ((i+1)/total) * 20%
                                await send_progress({
                                    "status": "ocr_processing", 
                                    "message": f"OCR处理成功: {evidence.file_name}",
                                    "progress": ocr_progress
                                })
                        else:
                            # OCR处理失败，记录错误
                            error_msg = ocr_result.get("error", "OCR处理失败")
                            logger.warning(f"OCR处理失败 {evidence.file_name}: {error_msg}")
                            
                            if send_progress:
                                ocr_progress = 40 + int(((i + 1) / len(ocr_evidences)) * 20)  # 40% + ((i+1)/total) * 20%
                                await send_progress({
                                    "status": "ocr_processing", 
                                    "message": f"OCR处理失败: {evidence.file_name} - {error_msg}",
                                    "progress": ocr_progress
                                })
                                
                    except Exception as e:
                        logger.error(f"OCR处理异常 {evidence.file_name}: {str(e)}")
                        if send_progress:
                            ocr_progress = 40 + int(((i + 1) / len(ocr_evidences)) * 20)  # 40% + ((i+1)/total) * 20%
                            await send_progress({
                                "status": "ocr_processing", 
                                "message": f"OCR处理异常: {evidence.file_name} - {str(e)}",
                                "progress": ocr_progress
                            })
            
            # 处理需要LLM处理的证据类型
            if llm_evidences:
                if send_progress:
                    await send_progress({
                        "status": "llm_processing", 
                        "message": f"开始LLM处理 {len(llm_evidences)} 个证据",
                        "progress": 60  # LLM阶段开始：60%
                    })
                
                extractor = EvidenceFeaturesExtractor()
                images = [
                    EvidenceImage(
                        url=ev.file_url,
                        evidence_type=ev.classification_category
                    )
                    for ev in llm_evidences
                ]
                
                # 设置超时时间（3分钟）
                import asyncio
                llm_run_response: RunResponse = await asyncio.wait_for(
                    extractor.arun(images),
                    timeout=180.0
                )
                
                evidence_extraction_results: EvidenceExtractionResults = llm_run_response.content
                if results := evidence_extraction_results.results:
                    from urllib.parse import unquote
                    for res in results:
                        res_url = unquote(res.image_url)
                        for evidence in evidences:
                            ev_url = unquote(evidence.file_url)
                            if ev_url == res_url:
                                evidence.evidence_features = [s.model_dump() for s in res.slot_extraction]
                                evidence.features_extracted_at = datetime.now()
                                evidence.evidence_status = EvidenceStatus.FEATURES_EXTRACTED.value
                                db.add(evidence)
                                break
                    await db.commit()
                    for evidence in evidences:
                        await db.refresh(evidence)
                
                if send_progress:
                    await send_progress({
                        "status": "features_extracted", 
                        "message": "证据特征分析完成",
                        "progress": 80  # LLM阶段完成：80%
                    })
                
        except asyncio.TimeoutError:
            if send_progress:
                await send_progress({
                    "status": "error", 
                    "message": "证据特征分析超时，请稍后重试",
                    "current": 0,
                    "total": len(evidences)
                })
            raise Exception("证据特征分析超时")
        except Exception as e:
            if send_progress:
                await send_progress({
                    "status": "error", 
                    "message": f"证据特征分析失败: {str(e)}",
                    "current": 0,
                    "total": len(evidences)
                })
            raise

    # 标注证据的角色类型
    if auto_feature_extraction and evidences:
        try:
            if send_progress:
                await send_progress({
                    "status": "role_annotation", 
                    "message": "开始证据角色自动标注",
                    "progress": 85  # 角色标注阶段开始：85%
                })
            
            # 获取案件信息，预加载case_parties关系
            case_query = await db.execute(
                select(Case).options(joinedload(Case.case_parties)).where(Case.id == case_id)
            )
            case = case_query.scalars().first()
            if not case:
                logger.error(f"未找到案件信息: case_id={case_id}")
                return evidences
            
            # 导入配置管理器
            from app.core.config_manager import config_manager
            
            # 遍历所有证据，进行角色标注
            for evidence in evidences:
                # 只有已分类且有特征提取结果的证据才进行角色标注
                if (evidence.evidence_status == EvidenceStatus.FEATURES_EXTRACTED.value and 
                    evidence.classification_category and 
                    evidence.evidence_features):
                    
                    # 获取证据类型配置
                    evidence_type_config = config_manager.get_evidence_type_by_type_name(evidence.classification_category)
                    if not evidence_type_config:
                        logger.warning(f"未找到证据类型配置: {evidence.classification_category}")
                        continue
                    
                    # 检查是否有proofread_rules配置
                    extraction_slots = evidence_type_config.get("extraction_slots", [])
                    if not extraction_slots:
                        continue
                    
                    # 遍历每个词槽配置，检查是否有proofread_rules
                    for slot_config in extraction_slots:
                        proofread_rules = slot_config.get("proofread_rules", [])
                        if not proofread_rules:
                            continue
                        
                        slot_name = slot_config.get("slot_name")
                        if not slot_name:
                            continue
                        
                        # 从证据特征中查找对应的词槽值
                        slot_value = None
                        for feature in evidence.evidence_features:
                            if isinstance(feature, dict) and feature.get("slot_name") == slot_name:
                                slot_value = feature.get("slot_value")
                                break
                        
                        if not slot_value or slot_value == "未知":
                            continue
                        
                        # 执行角色标注规则
                        for rule in proofread_rules:
                            rule_name = rule.get("rule_name", "")
                            target_type = rule.get("target_type", "case_party")
                            party_role = rule.get("party_role", [])
                            
                            # 角色标注逻辑：尝试与所有当事人匹配
                            if target_type == "case_party":
                                # 确定目标角色
                                if party_role and len(party_role) > 0:
                                    # 如果指定了party_role，使用指定的角色
                                    target_roles = party_role
                                else:
                                    # 如果没有指定角色，尝试与所有当事人匹配
                                    target_roles = ["creditor", "debtor"]
                                
                                # 查找匹配的当事人
                                for party in case.case_parties:
                                    if party.party_role not in target_roles:
                                        continue
                                    
                                    # 根据当事人类型匹配条件
                                    conditions = rule.get("conditions", [])
                                    if not conditions:
                                        continue
                                    
                                    for condition in conditions:
                                        if condition.get("party_type") != party.party_type:
                                            continue
                                        
                                        target_fields = condition.get("target_fields", [])
                                        match_strategy = condition.get("match_strategy", "exact")
                                        match_condition = condition.get("match_condition", "any")
                                        
                                        if not target_fields:
                                            continue
                                        
                                        # 执行匹配逻辑
                                        match_results = []
                                        for party_field in target_fields:
                                            party_value = getattr(party, party_field, None)
                                            if party_value is None:
                                                continue
                                            
                                            # 根据匹配策略执行匹配
                                            if match_strategy == "exact":
                                                normalized_slot_value = _normalize_numeric_value(slot_value)
                                                normalized_party_value = _normalize_numeric_value(party_value)
                                                is_match = str(normalized_slot_value).strip() == str(normalized_party_value).strip()
                                            elif match_strategy == "contains":
                                                is_match = str(party_value).strip() in str(slot_value).strip()
                                            elif match_strategy == "startswith":
                                                is_match = str(slot_value).strip().startswith(str(party_value).strip())
                                            elif match_strategy == "endswith":
                                                is_match = str(slot_value).strip().endswith(str(party_value).strip())
                                            else:
                                                normalized_slot_value = _normalize_numeric_value(slot_value)
                                                normalized_party_value = _normalize_numeric_value(party_value)
                                                is_match = str(normalized_slot_value).strip() == str(normalized_party_value).strip()
                                            
                                            match_results.append(is_match)
                                        
                                        # 根据匹配条件判断是否匹配成功
                                        match_success = False
                                        if match_condition == "all" and match_results:
                                            match_success = all(match_results)
                                        elif match_condition == "any" and match_results:
                                            match_success = any(match_results)
                                        elif match_condition == "majority" and match_results:
                                            match_success = sum(match_results) > len(match_results) / 2
                                        
                                        # 如果匹配成功，确定证据角色
                                        if match_success:
                                            evidence_role = party.party_role
                                            evidence.evidence_role = evidence_role
                                            db.add(evidence)
                                            logger.info(f"证据角色标注成功: {evidence.file_name} -> {evidence_role} (规则: {rule_name})")
                                            break
                                    
                                    # 如果已经找到匹配的角色，跳出当事人循环
                                    if evidence.evidence_role:
                                        break
                            
                            # 如果已经找到匹配的角色，跳出规则循环
                            if evidence.evidence_role:
                                break
                        
                        # 如果已经找到匹配的角色，跳出词槽循环
                        if evidence.evidence_role:
                            break
            
            # 提交所有更新
            await db.commit()
            for evidence in evidences:
                await db.refresh(evidence)
            
            if send_progress:
                await send_progress({
                    "status": "role_annotated", 
                    "message": "证据角色标注完成",
                    "progress": 95  # 角色标注阶段完成：95%
                })
            
            # 6. 更新当事人信息
            logger.info(f"开始更新当事人信息")
            await _update_party_information_from_evidence(db, case, evidences, send_progress)
                
        except Exception as e:
            logger.error(f"证据角色标注失败: {str(e)}")
            if send_progress:
                await send_progress({
                    "status": "error", 
                    "message": f"证据角色标注失败: {str(e)}",
                    "current": 0,
                    "total": len(evidences)
                })
            # 不抛出异常，继续执行后续逻辑

    # 5. 发送完成状态
    if send_progress:
        await send_progress({
            "status": "completed", 
            "message": f"成功处理 {len(evidences)} 个证据",
            "progress": 100  # 任务完成：100%
        })
    
    # 6. 返回证据列表
    return evidences


async def _update_party_information_from_evidence(db, case, evidences, send_progress=None):
    """
    根据证据提取的信息更新当事人详细信息
    
    Args:
        db: 数据库会话
        case: 案件对象
        evidences: 证据列表
        send_progress: 进度回调函数
    """
    try:
        logger.info(f"更新当事人信息...")
        if send_progress:
            await send_progress({
                "status": "updating_party_info", 
                "message": "开始更新当事人信息",
                "progress": 96  # 当事人信息更新阶段开始：96%
            })
        
        # 导入配置管理器
        from app.core.config_manager import config_manager
        
        # 获取案件当事人信息
        case_parties = case.case_parties
        if not case_parties:
            logger.warning(f"案件 {case.id} 没有当事人信息")
            return
        
        # 遍历所有证据，更新当事人信息
        updated_parties = set()
        logger.info(f"开始检查 {len(evidences)} 个证据的当事人信息更新条件")
        
        for evidence in evidences:
            logger.info(f"检查证据 {evidence.id}: {evidence.file_name}")
            logger.info(f"  状态: {evidence.evidence_status}")
            logger.info(f"  分类: {evidence.classification_category}")
            logger.info(f"  角色: {evidence.evidence_role}")
            logger.info(f"  特征数量: {len(evidence.evidence_features) if evidence.evidence_features else 0}")
            
            # 只有已分类、有特征提取结果且有证据角色的证据才进行当事人信息更新
            if (evidence.evidence_status == EvidenceStatus.FEATURES_EXTRACTED.value and 
                evidence.classification_category and 
                evidence.evidence_features and
                evidence.evidence_role):
                
                logger.info(f"证据 {evidence.id} 满足更新条件，开始处理")
                
                # 获取证据类型配置
                evidence_type_config = config_manager.get_evidence_type_by_type_name(evidence.classification_category)
                if not evidence_type_config:
                    logger.warning(f"未找到证据类型配置: {evidence.classification_category}")
                    continue
                
                logger.info(f"找到证据类型配置: {evidence_type_config.get('type')}")
                
                # 根据证据类型进行不同的处理
                if evidence.classification_category == "身份证":
                    await _update_party_from_id_card(db, evidence, case_parties, updated_parties)
                elif evidence.classification_category == "个体工商户营业执照":
                    await _update_party_from_individual_business_license(db, evidence, case_parties, updated_parties)
                elif evidence.classification_category == "公司营业执照":
                    await _update_party_from_company_business_license(db, evidence, case_parties, updated_parties)
                elif evidence.classification_category == "个体工商户全国企业公示系统截图":
                    await _update_party_from_individual_gsxt_license(db, evidence, case_parties, updated_parties)
                elif evidence.classification_category == "公司全国企业公示系统截图":
                    await _update_party_from_company_gsxt_license(db, evidence, case_parties, updated_parties)
        
        # 提交所有更新
        if updated_parties:
            await db.commit()
            logger.info(f"成功更新了 {len(updated_parties)} 个当事人的信息")
        
        if send_progress:
            await send_progress({
                "status": "party_info_updated", 
                "message": f"当事人信息更新完成，共更新 {len(updated_parties)} 个当事人",
                "progress": 98  # 当事人信息更新阶段完成：98%
            })
            
    except Exception as e:
        logger.error(f"更新当事人信息失败: {str(e)}")
        if send_progress:
            await send_progress({
                "status": "error", 
                "message": f"更新当事人信息失败: {str(e)}",
                "progress": 95
            })


async def _update_party_from_id_card(db, evidence, case_parties, updated_parties):
    """
    根据身份证证据更新当事人信息
    
    Args:
        db: 数据库会话
        evidence: 证据对象
        case_parties: 案件当事人列表
        updated_parties: 已更新的当事人ID集合
    """
    try:
        # 提取身份证信息
        id_card_info = {}
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                slot_name = feature.get("slot_name")
                slot_value = feature.get("slot_value")
                if slot_name and slot_value and slot_value != "未知":
                    id_card_info[slot_name] = slot_value
        
        if not id_card_info:
            logger.warning(f"身份证证据 {evidence.file_name} 没有提取到有效信息")
            return
        
        # 根据证据角色找到对应的当事人
        target_party = None
        for party in case_parties:
            if party.party_role == evidence.evidence_role:
                target_party = party
                break
        
        if not target_party:
            logger.warning(f"未找到角色为 {evidence.evidence_role} 的当事人")
            return
        
        # 更新当事人信息
        updated = False
        
        # 映射身份证字段到当事人字段
        field_mapping = {
            "姓名": "name",
            "性别": "gender", 
            "民族": "nation",
            "出生": "birthday",
            "住址": "address",
            "公民身份号码": "id_card"
        }
        
        for id_card_field, party_field in field_mapping.items():
            if id_card_field in id_card_info:
                current_value = getattr(target_party, party_field)
                new_value = id_card_info[id_card_field]
                
                # 只有当新值不为空且与当前值不同时才更新
                if new_value and new_value != current_value:
                    setattr(target_party, party_field, new_value)
                    updated = True
                    logger.info(f"更新当事人 {target_party.party_name} 的 {party_field}: {current_value} -> {new_value}")
        
        if updated:
            # 将修改的当事人对象添加到数据库会话中
            db.add(target_party)
            updated_parties.add(target_party.id)
            logger.info(f"成功更新当事人 {target_party.party_name} 的身份证信息")
        
    except Exception as e:
        logger.error(f"更新身份证当事人信息失败: {str(e)}")


async def _update_party_from_individual_business_license(db, evidence, case_parties, updated_parties):
    """
    根据个体工商户营业执照证据更新当事人信息
    
    Args:
        db: 数据库会话
        evidence: 证据对象
        case_parties: 案件当事人列表
        updated_parties: 已更新的当事人ID集合
    """
    try:
        # 提取个体工商户营业执照信息
        business_info = {}
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                slot_name = feature.get("slot_name")
                slot_value = feature.get("slot_value")
                if slot_name and slot_value and slot_value != "未知":
                    business_info[slot_name] = slot_value
        
        if not business_info:
            logger.warning(f"个体工商户营业执照证据 {evidence.file_name} 没有提取到有效信息")
            return
        
        # 根据证据角色找到对应的当事人
        target_party = None
        for party in case_parties:
            if party.party_role == evidence.evidence_role:
                target_party = party
                break
        
        if not target_party:
            logger.warning(f"未找到角色为 {evidence.evidence_role} 的当事人")
            return
        
        # 更新当事人信息
        updated = False
        
        # 映射个体工商户营业执照字段到当事人字段
        field_mapping = {
            "公司名称": "company_name",
            "住所地": "company_address", 
            "统一社会信用代码": "company_code",
            "经营者姓名": "name"
        }
        
        for business_field, party_field in field_mapping.items():
            if business_field in business_info:
                current_value = getattr(target_party, party_field)
                new_value = business_info[business_field]
                
                # 只有当新值不为空且与当前值不同时才更新
                if new_value and new_value != current_value:
                    setattr(target_party, party_field, new_value)
                    updated = True
                    logger.info(f"更新当事人 {target_party.party_name} 的 {party_field}: {current_value} -> {new_value}")
        
        if updated:
            # 将修改的当事人对象添加到数据库会话中
            db.add(target_party)
            updated_parties.add(target_party.id)
            logger.info(f"成功更新当事人 {target_party.party_name} 的个体工商户营业执照信息")
        
    except Exception as e:
        logger.error(f"更新个体工商户营业执照当事人信息失败: {str(e)}")


async def _update_party_from_company_business_license(db, evidence, case_parties, updated_parties):
    """
    根据公司营业执照证据更新当事人信息
    
    Args:
        db: 数据库会话
        evidence: 证据对象
        case_parties: 案件当事人列表
        updated_parties: 已更新的当事人ID集合
    """
    try:
        # 提取公司营业执照信息
        business_info = {}
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                slot_name = feature.get("slot_name")
                slot_value = feature.get("slot_value")
                if slot_name and slot_value and slot_value != "未知":
                    business_info[slot_name] = slot_value
        
        if not business_info:
            logger.warning(f"公司营业执照证据 {evidence.file_name} 没有提取到有效信息")
            return
        
        # 根据证据角色找到对应的当事人
        target_party = None
        for party in case_parties:
            if party.party_role == evidence.evidence_role:
                target_party = party
                break
        
        if not target_party:
            logger.warning(f"未找到角色为 {evidence.evidence_role} 的当事人")
            return
        
        # 更新当事人信息
        updated = False
        
        # 映射公司营业执照字段到当事人字段
        field_mapping = {
            "公司名称": "company_name",
            "住所地": "company_address", 
            "统一社会信用代码": "company_code",
            "法定代表人": "name"
        }
        
        for business_field, party_field in field_mapping.items():
            if business_field in business_info:
                current_value = getattr(target_party, party_field)
                new_value = business_info[business_field]
                
                # 只有当新值不为空且与当前值不同时才更新
                if new_value and new_value != current_value:
                    setattr(target_party, party_field, new_value)
                    updated = True
                    logger.info(f"更新当事人 {target_party.party_name} 的 {party_field}: {current_value} -> {new_value}")
        
        if updated:
            # 将修改的当事人对象添加到数据库会话中
            db.add(target_party)
            updated_parties.add(target_party.id)
            logger.info(f"成功更新当事人 {target_party.party_name} 的公司营业执照信息")
        
    except Exception as e:
        logger.error(f"更新公司营业执照当事人信息失败: {str(e)}")


async def _update_party_from_individual_gsxt_license(db, evidence, case_parties, updated_parties):
    """
    根据个体工商户全国企业公示系统截图证据更新当事人信息
    
    Args:
        db: 数据库会话
        evidence: 证据对象
        case_parties: 案件当事人列表
        updated_parties: 已更新的当事人ID集合
    """
    try:
        # 提取个体工商户全国企业公示系统截图信息
        gsxt_info = {}
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                slot_name = feature.get("slot_name")
                slot_value = feature.get("slot_value")
                if slot_name and slot_value and slot_value != "未知":
                    gsxt_info[slot_name] = slot_value
        
        if not gsxt_info:
            logger.warning(f"个体工商户全国企业公示系统截图证据 {evidence.file_name} 没有提取到有效信息")
            return
        
        # 根据证据角色找到对应的当事人
        target_party = None
        for party in case_parties:
            if party.party_role == evidence.evidence_role:
                target_party = party
                break
        
        if not target_party:
            logger.warning(f"未找到角色为 {evidence.evidence_role} 的当事人")
            return
        
        # 更新当事人信息
        updated = False
        
        # 映射个体工商户全国企业公示系统截图字段到当事人字段
        field_mapping = {
            "公司名称": "company_name",
            "住所地": "company_address", 
            "统一社会信用代码": "company_code",
            "经营者姓名": "name"
        }
        
        for gsxt_field, party_field in field_mapping.items():
            if gsxt_field in gsxt_info:
                current_value = getattr(target_party, party_field)
                new_value = gsxt_info[gsxt_field]
                
                # 只有当新值不为空且与当前值不同时才更新
                if new_value and new_value != current_value:
                    setattr(target_party, party_field, new_value)
                    updated = True
                    logger.info(f"更新当事人 {target_party.party_name} 的 {party_field}: {current_value} -> {new_value}")
        
        if updated:
            # 将修改的当事人对象添加到数据库会话中
            db.add(target_party)
            updated_parties.add(target_party.id)
            logger.info(f"成功更新当事人 {target_party.party_name} 的个体工商户全国企业公示系统截图信息")
        
    except Exception as e:
        logger.error(f"更新个体工商户全国企业公示系统截图当事人信息失败: {str(e)}")


async def _update_party_from_company_gsxt_license(db, evidence, case_parties, updated_parties):
    """
    根据公司全国企业公示系统截图证据更新当事人信息
    
    Args:
        db: 数据库会话
        evidence: 证据对象
        case_parties: 案件当事人列表
        updated_parties: 已更新的当事人ID集合
    """
    try:
        # 提取公司全国企业公示系统截图信息
        gsxt_info = {}
        for feature in evidence.evidence_features:
            if isinstance(feature, dict):
                slot_name = feature.get("slot_name")
                slot_value = feature.get("slot_value")
                if slot_name and slot_value and slot_value != "未知":
                    gsxt_info[slot_name] = slot_value
        
        if not gsxt_info:
            logger.warning(f"公司全国企业公示系统截图证据 {evidence.file_name} 没有提取到有效信息")
            return
        
        # 根据证据角色找到对应的当事人
        target_party = None
        for party in case_parties:
            if party.party_role == evidence.evidence_role:
                target_party = party
                break
        
        if not target_party:
            logger.warning(f"未找到角色为 {evidence.evidence_role} 的当事人")
            return
        
        # 更新当事人信息
        updated = False
        
        # 映射公司全国企业公示系统截图字段到当事人字段
        field_mapping = {
            "公司名称": "company_name",
            "住所地": "company_address", 
            "统一社会信用代码": "company_code",
            "法定代表人": "name"
        }
        
        for gsxt_field, party_field in field_mapping.items():
            if gsxt_field in gsxt_info:
                current_value = getattr(target_party, party_field)
                new_value = gsxt_info[gsxt_field]
                
                # 只有当新值不为空且与当前值不同时才更新
                if new_value and new_value != current_value:
                    setattr(target_party, party_field, new_value)
                    updated = True
                    logger.info(f"更新当事人 {target_party.party_name} 的 {party_field}: {current_value} -> {new_value}")
        
        if updated:
            # 将修改的当事人对象添加到数据库会话中
            db.add(target_party)
            updated_parties.add(target_party.id)
            logger.info(f"成功更新当事人 {target_party.party_name} 的公司全国企业公示系统截图信息")
        
    except Exception as e:
        logger.error(f"更新公司全国企业公示系统截图当事人信息失败: {str(e)}")


class EvidenceCardSchema(BaseModel):
    """证据卡片数据模型（用于构建卡片）"""
    evidence_ids: List[int]  # 关联的证据ID列表（支持1到多个）
    card_info: Optional[Dict] = None  # 卡片信息，包含类型、特征等


async def evidence_card_casting(
        db: AsyncSession, 
        case_id: int,
        evidence_ids: List[int],
        card_id: Optional[int] = None,
        skip_classification: bool = False,
        target_card_type: Optional[str] = None,
    ):
    """
    证据卡片铸造（从证据特征中铸造证据卡片）
    
    支持两种场景：
    1. 单个证据提取：每个证据生成一个卡片
    2. 关联证据提取：多个证据共同生成一个卡片（未来功能）
    3. 重铸场景：更新现有卡片（card_id 不为 None）
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        evidence_ids: 证据ID列表
        card_id: 重铸时的卡片ID（如果提供，则更新该卡片而不是创建新卡片）
        skip_classification: 是否跳过分类（重铸时使用，因为卡片已有分类）
        target_card_type: 目标分类（更新分类时使用，如果提供则使用此分类而不是重新分类）
    """
    # 检索证据列表
    evidences = await get_multi_by_ids(db, evidence_ids)

    # 过滤仅支持的处理类型
    supported_ai_formats = [
        # 图片格式 - AI可以处理
        "jpg", "jpeg", "png", "bmp", "webp",
        # 其他格式暂时不支持AI处理，但可以上传
        # "doc", "docx", "txt", "xls", "xlsx", "csv", "mp3", "mp4", "wav", "m4a", "avi", "mov", "wmv"
    ]

    filtered_evidences = [evidence for evidence in evidences if evidence.file_extension in supported_ai_formats]
    
    # 静默过滤：如果没有有效的图片类型证据，返回空列表
    # 非图片类型（如PDF）会被静默忽略，不会抛出错误
    if not filtered_evidences:
        logger.info(f"没有找到支持的类型（图片格式），已过滤的证据ID: {evidence_ids}，将返回空列表")
        return []

    # 建立 evidence_id 到 evidence 的映射，用于后续匹配
    evidence_map: Dict[int, Evidence] = {ev.id: ev for ev in filtered_evidences}
    
    # 如果是重铸，获取现有卡片信息
    existing_card = None
    existing_card_type = None
    if card_id:
        existing_card = await get_card_by_id(db, card_id)
        if existing_card and existing_card.card_info:
            existing_card_type = existing_card.card_info.get("card_type")
            logger.info(f"重铸卡片 #{card_id}，现有类型: {existing_card_type}")
    
    # 判断是否使用目标分类（需要在初始化 card_data 之前判断）
    use_target_type = target_card_type is not None
    
    # 判断新类型是否为联合卡片类型
    association_required_types = {"微信聊天记录"}
    is_target_type_associated = use_target_type and (target_card_type in association_required_types or len(evidence_ids) > 1)
    
    # 初始化卡片数据
    # 重铸时：创建一个包含所有 evidence_ids 的单一卡片
    # 正常铸造时：每个证据一个卡片
    if card_id and existing_card:
        # 重铸：创建一个包含所有 evidence_ids 的单一卡片
        # 注意：如果使用 target_card_type，不要复制旧的 card_features，因为要重新提取
        if use_target_type:
            # 使用目标分类时，不复制旧的 card_features
            card_data = [
                EvidenceCardSchema(
                    evidence_ids=evidence_ids,  # 使用传入的所有 evidence_ids
                    card_info={
                        "card_type": target_card_type,  # 先设置目标分类
                        "card_is_associated": is_target_type_associated,
                        "card_features": []  # 清空旧特征
                    }
                )
            ]
            logger.info(f"重铸模式：创建单一卡片（使用目标分类），evidence_ids: {evidence_ids}, target_card_type: {target_card_type}")
        else:
            # 不使用目标分类时，复制现有的 card_info（包括 card_features）
            card_data = [
                EvidenceCardSchema(
                    evidence_ids=evidence_ids,  # 使用传入的所有 evidence_ids
                    card_info=existing_card.card_info.copy() if existing_card.card_info else None
                )
            ]
            logger.info(f"重铸模式：创建单一卡片（保持现有分类），evidence_ids: {evidence_ids}")
    else:
        # 正常铸造：每个证据一个卡片
        card_data = [
            EvidenceCardSchema(
                evidence_ids=[evidence.id]  # 单个证据提取，后续可扩展为多个
            )
            for evidence in filtered_evidences
        ]

        
    # 卡片铸造数据构建
    # Step1. 证据分类（重铸时跳过或使用目标分类）
    evidence_classifi_results: Optional[EvidenceClassifiResults] = None
    
    # 重铸逻辑：
    # 1. 如果使用 target_card_type：跳过分类，直接使用目标分类进行特征提取
    # 2. 如果 skip_classification=True 且没有 target_card_type：使用现有卡片的类型
    # 3. 否则：进行正常分类流程
    if use_target_type:
        # 使用目标分类：跳过分类，直接进行特征提取
        logger.info(f"重铸模式：使用目标分类 {target_card_type}，跳过分类步骤，直接进行特征提取")
        for card in card_data:
            if card.card_info is None:
                card.card_info = {
                    "card_type": target_card_type,
                    "card_is_associated": is_target_type_associated,
                    "card_features": []  # 清空旧的特征
                }
            else:
                # 强制更新 card_type 和 card_is_associated，并清空旧的特征
                card.card_info["card_type"] = target_card_type
                card.card_info["card_is_associated"] = is_target_type_associated
                card.card_info["card_features"] = []  # 清空旧的特征，重新提取
                logger.info(f"重铸模式：清空旧特征，准备使用目标分类 {target_card_type} 重新提取")
    elif skip_classification and existing_card_type:
        # 重铸时跳过分类，使用现有卡片的类型
        logger.info(f"重铸模式：跳过分类，使用现有卡片类型: {existing_card_type}")
        # 为所有卡片设置现有类型
        for card in card_data:
            if card.card_info is None:
                card.card_info = {
                    "card_type": existing_card_type,
                    "card_is_associated": existing_card.card_info.get("card_is_associated", False) if existing_card and existing_card.card_info else False,
                    "card_features": []
                }
            else:
                card.card_info["card_type"] = existing_card_type
                if "card_is_associated" not in card.card_info:
                    card.card_info["card_is_associated"] = existing_card.card_info.get("card_is_associated", False) if existing_card and existing_card.card_info else False
                if "card_features" not in card.card_info:
                    card.card_info["card_features"] = []
    else:
        # 正常铸造流程：进行证据分类
        logger.info("正常铸造流程：进行证据分类")
        evidence_classifier = EvidenceClassifier()
        classification_response: RunResponse = await asyncio.wait_for(
                    evidence_classifier.arun([evidence.file_url for evidence in filtered_evidences]),
                    timeout=180.0
                )
        if classification_response.content is None:
            raise ValueError("证据分类结果为空")

        # Step2: 证据分类结果处理
        evidence_classifi_results = cast(EvidenceClassifiResults, classification_response.content)
        
        if not evidence_classifi_results or not evidence_classifi_results.results:
            logger.warning("证据分类结果为空，无法构建卡片数据")
            return []

    # 建立 URL -> evidence_id 映射关系，用于匹配分类结果
    url_to_evidence_id: Dict[str, int] = {}
    for evidence in filtered_evidences:
        normalized_url = unquote(evidence.file_url)
        url_to_evidence_id[normalized_url] = evidence.id
        url_to_evidence_id[evidence.file_url] = evidence.id  # 同时保存原始 URL
    
    # 建立 evidence_id -> card 映射关系（由于当前是单个证据一个卡片）
    evidence_id_to_card: Dict[int, EvidenceCardSchema] = {
        card.evidence_ids[0]: card for card in card_data if len(card.evidence_ids) == 1
    }
    
    # Step2: 证据分类结果处理（使用映射关系匹配，如果不是重铸且没有使用目标分类）
    if not skip_classification and not use_target_type and evidence_classifi_results:
        for result in evidence_classifi_results.results:
            normalized_result_url = unquote(result.image_url)
            evidence_id = url_to_evidence_id.get(normalized_result_url) or url_to_evidence_id.get(result.image_url)
            
            if evidence_id is None:
                logger.warning(f"无法找到对应的证据ID，image_url: {result.image_url}")
                continue
            
            card = evidence_id_to_card.get(evidence_id)
            if card:
                # 初始化 card_info 结构：Dict类型，包含分类信息
                if card.card_info is None:
                    card.card_info = {
                        "card_type": result.evidence_type,
                        "card_is_associated": False,  # 当前是单个证据提取
                        "card_features": []
                    }
                else:
                    # 更新 card_type
                    card.card_info["card_type"] = result.evidence_type
                    if "card_is_associated" not in card.card_info:
                        card.card_info["card_is_associated"] = False
                    if "card_features" not in card.card_info:
                        card.card_info["card_features"] = []
            else:
                logger.warning(f"无法找到对应的卡片，evidence_id: {evidence_id}")

    # Step3: 证据特征提取
    # 过滤出有 card_type 的卡片（特征提取需要类型）
    cards_with_type = [
        card for card in card_data 
        if card.card_info and card.card_info.get("card_type")
    ]
    if not cards_with_type:
        logger.warning("没有有效的卡片类型，跳过特征提取")
    else:
        # 定义 OCR 支持的证据类型（从 xunfei_ocr.py 的 EvidenceType 枚举）
        ocr_supported_types = {
            "公司营业执照",
            "个体工商户营业执照",
            "身份证",
            "增值税发票",
            "公司全国企业公示系统营业执照",
            "个体工商户全国企业公示系统营业执照",
        }
        
        # 将卡片分组：OCR类型、Agent类型（单个）、关联类型（微信聊天记录，无论证据数量）
        ocr_cards = []  # OCR处理的卡片（单个证据）
        agent_cards = []  # Agent处理的卡片（单个证据，非微信聊天记录）
        association_cards = []  # 关联提取的卡片（微信聊天记录，支持单个或多个证据）
        
        # 定义需要关联提取的证据类型（这些类型需要识别分组信息）
        association_required_types = {"微信聊天记录"}
        
        for card in cards_with_type:
            if not card.card_info:
                continue
            card_type = card.card_info.get("card_type")
            if not card_type:
                continue
            
            # 判断是否为关联提取：微信聊天记录类型无论证据数量都需要关联提取
            if card_type in association_required_types:
                association_cards.append(card)
            elif len(card.evidence_ids) > 1:
                # 其他类型，多个证据时也需要关联提取
                association_cards.append(card)
            elif len(card.evidence_ids) == 1:
                # 单个证据，判断使用 OCR 还是 Agent
                if card_type in ocr_supported_types:
                    ocr_cards.append(card)
                else:
                    agent_cards.append(card)
        
        # Step3.1: OCR 特征提取
        if ocr_cards:
            try:
                from app.utils.xunfei_ocr import XunfeiOcrService
                ocr_service = XunfeiOcrService()
                
                for card in ocr_cards:
                    if len(card.evidence_ids) == 1 and card.card_info:
                        evidence_id = card.evidence_ids[0]
                        evidence = evidence_map.get(evidence_id)
                        card_type = card.card_info.get("card_type")
                        
                        if evidence and card_type:
                            # 调用 OCR 服务提取特征
                            ocr_result = ocr_service.extract_evidence_features(
                                image_url=evidence.file_url,
                                evidence_type=card_type
                            )
                            
                            if "error" in ocr_result:
                                logger.warning(f"OCR识别失败，evidence_id: {evidence_id}, 错误: {ocr_result['error']}")
                                continue
                            
                            # 将 OCR 结果转换为 card_features 格式
                            evidence_features = ocr_result.get("evidence_features", [])
                            if evidence_features:
                                if "card_features" not in card.card_info:
                                    card.card_info["card_features"] = []
                                
                                # OCR 返回的格式已经是字典列表，直接添加 slot_group_info
                                for feature in evidence_features:
                                    card.card_info["card_features"].append({
                                        "slot_name": feature.get("slot_name", ""),
                                        "slot_value_type": feature.get("slot_value_type", "string"),
                                        "slot_value": feature.get("slot_value", ""),
                                        "confidence": feature.get("confidence", 0.0),
                                        "reasoning": feature.get("reasoning", "OCR识别"),
                                        "slot_group_info": None  # 单个证据提取，没有关联信息
                                    })
            except Exception as e:
                logger.error(f"OCR特征提取失败: {str(e)}")
        
        # Step3.2: Agent 特征提取（单个证据，非微信聊天记录）
        if agent_cards:
            try:
                features_extract_data = []
                for card in agent_cards:
                    if len(card.evidence_ids) == 1 and card.card_info:
                        evidence_id = card.evidence_ids[0]
                        evidence = evidence_map.get(evidence_id)
                        card_type = card.card_info.get("card_type")
                        if evidence and card_type:
                            features_extract_data.append(
                                EvidenceImage(
                                    url=evidence.file_url, 
                                    evidence_type=card_type
                                )
                            )
                
                if features_extract_data:
                    evidence_features_extractor = EvidenceFeaturesExtractor()
                    features_response: RunResponse = await asyncio.wait_for(
                        evidence_features_extractor.arun(features_extract_data),
                        timeout=180.0
                    )
                    
                    if features_response.content is None:
                        logger.warning("Agent特征提取结果为空")
                    else:
                        evidence_features_results = cast(EvidenceExtractionResults, features_response.content)
                        if evidence_features_results.results:
                            for result in evidence_features_results.results:
                                normalized_result_url = unquote(result.image_url)
                                evidence_id = url_to_evidence_id.get(normalized_result_url) or url_to_evidence_id.get(result.image_url)
                                
                                if evidence_id is None:
                                    logger.warning(f"无法找到对应的证据ID，image_url: {result.image_url}")
                                    continue
                                
                                card = evidence_id_to_card.get(evidence_id)
                                if card and card.card_info:
                                    if "card_features" not in card.card_info:
                                        card.card_info["card_features"] = []
                                    
                                    # 将 slot_extraction 转换为 card_features 格式
                                    for item in result.slot_extraction:
                                        if hasattr(item, 'model_dump'):
                                            slot_dict = item.model_dump()
                                        else:
                                            slot_dict = {
                                                "slot_name": item.slot_name,
                                                "slot_value_type": item.slot_value_type,
                                                "slot_value": item.slot_value,
                                                "confidence": item.confidence,
                                                "reasoning": item.reasoning,
                                            }
                                        
                                        card.card_info["card_features"].append({
                                            "slot_name": slot_dict["slot_name"],
                                            "slot_value_type": slot_dict.get("slot_value_type", "string"),
                                            "slot_value": slot_dict["slot_value"],
                                            "confidence": slot_dict.get("confidence", 0.0),
                                            "reasoning": slot_dict.get("reasoning", ""),
                                            "slot_group_info": None  # 单个证据提取，没有关联信息
                                        })
                        else:
                            logger.warning("Agent特征提取结果列表为空")
            except Exception as e:
                logger.error(f"Agent特征提取失败: {str(e)}")
        
        # Step3.3: 关联特征提取（多个证据，如微信聊天记录）
        if association_cards:
            try:
                from app.agentic.agents.association_features_extractor_v2 import (
                    AssociationFeaturesExtractor,
                    AssociationFeaturesExtractionResults
                )
                
                # 收集所有需要关联提取的证据URL（微信聊天记录类型）
                # 重要：关联提取器支持批次处理，应该一次性传入所有微信聊天记录证据的URL
                # 关联提取器会自动按 slot_group_name 分组，每个分组生成一个 ResultItem
                all_association_urls = []
                association_url_to_evidence_id = {}  # 记录URL对应的evidence_id
                
                for card in association_cards:
                    card_type = card.card_info.get("card_type")
                    # 微信聊天记录类型（无论证据数量）都需要关联提取
                    if card_type == "微信聊天记录":
                        for evidence_id in card.evidence_ids:
                            evidence = evidence_map.get(evidence_id)
                            if evidence:
                                all_association_urls.append(evidence.file_url)
                                # 记录URL到evidence_id的映射（支持原始URL和归一化URL）
                                association_url_to_evidence_id[evidence.file_url] = evidence_id
                                normalized_url = unquote(evidence.file_url)
                                if normalized_url != evidence.file_url:
                                    association_url_to_evidence_id[normalized_url] = evidence_id
                
                if all_association_urls:
                    logger.info(f"批次关联特征提取：共 {len(all_association_urls)} 个微信聊天记录证据")
                    
                    # 批次调用关联特征提取器（一次性处理所有微信聊天记录）
                    association_extractor = AssociationFeaturesExtractor()
                    association_response = await asyncio.wait_for(
                        association_extractor.arun(all_association_urls),
                        timeout=300.0  # 关联提取可能需要更长时间
                    )
                    
                    # 检查返回类型并提取内容
                    # 注意：arun 实际上返回 RunResponse（从 self.agent.arun），而不是直接返回 AssociationFeaturesExtractionResults
                    association_results: AssociationFeaturesExtractionResults
                    if hasattr(association_response, 'content') and hasattr(association_response, 'run_id'):
                        # 如果返回的是 RunResponse，提取 content
                        if association_response.content is None:  # type: ignore
                            logger.warning("关联特征提取结果为空")
                        else:
                            association_results = cast(AssociationFeaturesExtractionResults, association_response.content)  # type: ignore
                            
                            if association_results and association_results.results:
                                # 关联提取器会按 slot_group_name 自动分组
                                # 每个分组会生成一个 ResultItem，包含该分组的所有特征
                                # 我们需要为每个分组创建一个新的卡片数据，替换掉原来按单个证据创建的卡片
                                
                                # 创建按 slot_group_name 分组的卡片数据
                                grouped_cards: Dict[str, EvidenceCardSchema] = {}  # group_name -> card
                                
                                for result_item in association_results.results:
                                    slot_group_name = result_item.slot_group_name
                                    
                                    # 提取该分组涉及的证据ID
                                    reference_evidence_ids = []
                                    for img_seq in result_item.image_sequence_info:
                                        # 根据 URL 找到对应的 evidence_id
                                        normalized_url = unquote(img_seq.url)
                                        evidence_id = association_url_to_evidence_id.get(normalized_url) or association_url_to_evidence_id.get(img_seq.url)
                                        if evidence_id:
                                            reference_evidence_ids.append(evidence_id)
                                    
                                    if not reference_evidence_ids:
                                        logger.warning(f"分组 {slot_group_name} 没有找到对应的证据ID")
                                        continue
                                    
                                    # 初始化或获取该分组的卡片
                                    if slot_group_name not in grouped_cards:
                                        # 如果是重铸，使用重铸卡片的类型和 evidence_ids
                                        if card_id and existing_card:
                                            # 重铸时：优先使用 target_card_type，否则使用现有卡片的类型
                                            if use_target_type:
                                                card_type = target_card_type
                                                logger.info(f"重铸模式：使用目标分类 {target_card_type} 创建分组卡片")
                                            else:
                                                card_type = existing_card.card_info.get("card_type") if existing_card.card_info else "微信聊天记录"
                                                logger.info(f"重铸模式：使用现有卡片类型 {card_type} 创建分组卡片")
                                            # 使用重铸时传入的所有 evidence_ids，而不是只使用 reference_evidence_ids
                                            grouped_cards[slot_group_name] = EvidenceCardSchema(
                                                evidence_ids=evidence_ids,  # 使用重铸时传入的所有 evidence_ids
                                                card_info={
                                                    "card_type": card_type,
                                                    "card_is_associated": True,
                                                    "card_features": []
                                                }
                                            )
                                            logger.info(f"重铸模式：使用所有 evidence_ids: {evidence_ids}")
                                        else:
                                            # 正常铸造：获取第一个证据的类型
                                            first_evidence_id = reference_evidence_ids[0]
                                            first_card = evidence_id_to_card.get(first_evidence_id)
                                            card_type = first_card.card_info.get("card_type") if first_card and first_card.card_info else "微信聊天记录"
                                            
                                            grouped_cards[slot_group_name] = EvidenceCardSchema(
                                                evidence_ids=reference_evidence_ids,  # 保持原始顺序（来自image_sequence_info）
                                                card_info={
                                                    "card_type": card_type,
                                                    "card_is_associated": True,
                                                    "card_features": []
                                                }
                                            )
                                    
                                    card = grouped_cards[slot_group_name]
                                    
                                    # 确保 card_info 已初始化，如果使用目标分类则更新 card_type
                                    if card.card_info is None:
                                        card.card_info = {
                                            "card_type": target_card_type if use_target_type else "微信聊天记录",
                                            "card_is_associated": True,
                                            "card_features": []
                                        }
                                    elif use_target_type:
                                        # 如果使用目标分类，确保 card_type 是目标分类
                                        card.card_info["card_type"] = target_card_type
                                        card.card_info["card_is_associated"] = is_target_type_associated
                                    
                                    # 为每个 slot_extraction 添加 slot_group_info
                                    for slot_extraction in result_item.slot_extraction:
                                        if hasattr(slot_extraction, 'model_dump'):
                                            slot_dict = slot_extraction.model_dump()
                                        else:
                                            slot_dict = {
                                                "slot_name": slot_extraction.slot_name,
                                                "slot_value_type": slot_extraction.slot_value_type,
                                                "slot_value": slot_extraction.slot_value,
                                                "confidence": slot_extraction.confidence,
                                                "reasoning": slot_extraction.reasoning,
                                            }
                                        
                                        # 构建 slot_group_info
                                        slot_group_info = [{
                                            "group_name": slot_group_name,
                                            "reference_evidence_ids": reference_evidence_ids  # 保持原始顺序（来自image_sequence_info）
                                        }] if reference_evidence_ids else None
                                        
                                        # 确保 card_features 列表存在
                                        if "card_features" not in card.card_info:
                                            card.card_info["card_features"] = []
                                        
                                        card.card_info["card_features"].append({
                                            "slot_name": slot_dict["slot_name"],
                                            "slot_value_type": slot_dict.get("slot_value_type", "string"),
                                            "slot_value": slot_dict.get("slot_value", ""),
                                            "confidence": slot_dict.get("confidence", 0.0),
                                            "reasoning": slot_dict.get("reasoning", ""),
                                            "slot_group_info": slot_group_info
                                        })
                                    
                                    logger.info(f"创建关联分组卡片: group_name={slot_group_name}, evidence_ids={reference_evidence_ids}")
                                
                                # 将按 slot_group_name 分组的卡片替换掉原来按单个证据创建的卡片
                                # 如果是重铸，不移除原始卡片，直接使用分组卡片更新
                                if card_id and existing_card:
                                    # 重铸时：直接使用分组卡片替换 card_data 中的重铸卡片
                                    # 移除重铸卡片，添加分组卡片
                                    # 注意：这里需要根据 target_card_type 或现有类型来判断，而不是硬编码 "微信聊天记录"
                                    target_type_for_filter = target_card_type if use_target_type else (existing_card.card_info.get("card_type") if existing_card.card_info else "微信聊天记录")
                                    card_data = [
                                        card for card in card_data 
                                        if not (card.card_info and card.card_info.get("card_type") == target_type_for_filter and len(card.evidence_ids) == len(evidence_ids))
                                    ]
                                    # 添加按 slot_group_name 分组的卡片（重铸时应该只有一个分组）
                                    for group_card in grouped_cards.values():
                                        # 确保分组卡片的 card_type 是正确的
                                        if use_target_type and group_card.card_info:
                                            group_card.card_info["card_type"] = target_card_type
                                            group_card.card_info["card_is_associated"] = is_target_type_associated
                                        card_data.append(group_card)
                                        logger.info(f"重铸模式：使用分组卡片替换重铸卡片，evidence_ids: {group_card.evidence_ids}, card_type: {group_card.card_info.get('card_type') if group_card.card_info else None}")
                                else:
                                    # 正常铸造：移除所有微信聊天记录类型的原始卡片
                                    card_data = [
                                        card for card in card_data 
                                        if not (card.card_info and card.card_info.get("card_type") == "微信聊天记录")
                                    ]
                                    # 添加按 slot_group_name 分组的卡片
                                    for group_card in grouped_cards.values():
                                        card_data.append(group_card)
                            else:
                                logger.warning("关联特征提取结果列表为空")
                    elif hasattr(association_response, 'results'):
                        # 如果直接返回的是 AssociationFeaturesExtractionResults（有 results 属性）
                        association_results = association_response  # type: ignore
                        # 处理逻辑同上（需要复制上面的处理逻辑）
                        logger.warning("关联特征提取返回了直接结果类型，需要处理")
                    else:
                        logger.warning(f"关联特征提取返回了未知类型: {type(association_response)}")
                else:
                    logger.warning("没有找到需要关联提取的证据URL")
            except Exception as e:
                logger.error(f"关联特征提取失败: {str(e)}")
                # 关联提取失败不影响卡片的创建
    
    # Step4: 按 slot_group_name 重新组织卡片数据
    # 如果有 slot_group_name，则按 slot_group_name 分组，每个分组生成一张卡片
    # 如果没有 slot_group_name，则每个证据生成一张卡片（保持原有逻辑）
    # 重铸时：保持原有的 evidence_ids，不按 slot_group_name 重新组织
    
    # 如果是重铸，直接使用 card_data，不进行重新组织
    if card_id and existing_card:
        # 重铸时：直接使用 card_data，确保 evidence_ids 包含所有传入的证据
        final_card_data = card_data
        logger.info(f"重铸模式：跳过 Step4 重新组织，直接使用 card_data，evidence_ids: {[card.evidence_ids for card in card_data]}")
    else:
        # 正常铸造：按 slot_group_name 重新组织
        # 收集所有具有 slot_group_name 的特征
        group_to_features: Dict[str, Dict[str, Any]] = {}  # group_name -> {evidence_ids: set, features: list, card_type: str}
        group_to_card_info: Dict[str, Dict] = {}  # group_name -> card_info (card_type, card_is_associated)
        
        # 收集没有 slot_group_name 的卡片（保持原有逻辑）
        cards_without_group = []
        
        for card in card_data:
            # 如果 card_info 为 None，跳过（这些卡片会在后续步骤中被过滤掉）
            if not card.card_info:
                cards_without_group.append(card)
                continue
            
            # 如果 card_info 存在但没有 card_features，也添加到 cards_without_group（保持原有逻辑）
            if not card.card_info.get("card_features"):
                cards_without_group.append(card)
                continue
            
            card_features = card.card_info.get("card_features", [])
            card_type = card.card_info.get("card_type", "未知")
            card_is_associated = card.card_info.get("card_is_associated", False)
            
            # 检查是否有 slot_group_info
            has_group = False
            for feature in card_features:
                slot_group_info = feature.get("slot_group_info")
                if slot_group_info and isinstance(slot_group_info, list) and len(slot_group_info) > 0:
                    group_info = slot_group_info[0]
                    group_name = group_info.get("group_name")
                    reference_evidence_ids = group_info.get("reference_evidence_ids", [])
                    
                    if group_name:
                        has_group = True
                        # 初始化分组数据
                        if group_name not in group_to_features:
                            group_to_features[group_name] = {
                                "evidence_ids": set(),
                                "features": [],
                                "card_type": card_type,
                                "card_is_associated": True
                            }
                            group_to_card_info[group_name] = {
                                "card_type": card_type,
                                "card_is_associated": True,
                                "card_features": []
                            }
                        else:
                            # 如果分组已存在，确保 card_type 一致（如果不同，使用第一个）
                            if group_to_card_info[group_name]["card_type"] != card_type:
                                logger.warning(f"分组 {group_name} 的 card_type 不一致: {group_to_card_info[group_name]['card_type']} vs {card_type}, 使用第一个")
                        
                        # 添加证据ID
                        group_to_features[group_name]["evidence_ids"].update(reference_evidence_ids)
                        # 添加特征（避免重复）
                        if feature not in group_to_card_info[group_name]["card_features"]:
                            group_to_card_info[group_name]["card_features"].append(feature)
            
            # 如果没有分组信息，保持原有逻辑
            if not has_group:
                cards_without_group.append(card)
        
        # 重新构建卡片数据：按 slot_group_name 分组的卡片 + 没有分组的卡片
        final_card_data = []
        
        # 添加按 slot_group_name 分组的卡片
        for group_name, group_data in group_to_features.items():
            evidence_ids_list = sorted(list(group_data["evidence_ids"]))
            card_info = group_to_card_info[group_name]
            
            final_card_data.append(
                EvidenceCardSchema(
                    evidence_ids=evidence_ids_list,
                    card_info=card_info
                )
            )
            logger.info(f"创建按 slot_group_name 分组的卡片: group_name={group_name}, evidence_ids={evidence_ids_list}")
        
        # 添加没有分组的卡片（保持原有逻辑）
        final_card_data.extend(cards_without_group)
    
    # Step5: 确保所有 slot_name 都存在（从卡槽模板获取）
    # 如果使用了目标分类，确保所有 required_slots 都存在
    if use_target_type:
        from app.core.config_manager import config_manager
        config = config_manager.load_evidence_card_slots_config()
        
        # 查找目标类型的卡槽模板
        target_template = None
        for template in config.evidence_card_templates:
            if template.get('card_type') == target_card_type:
                target_template = template
                break
        
        if target_template:
            required_slot_names = [slot.get('slot_name') for slot in target_template.get('required_slots', [])]
            
            # 为每个卡片确保所有 slot_name 都存在
            for card in final_card_data:
                if not card.card_info or card.card_info.get("card_type") != target_card_type:
                    continue
                
                if "card_features" not in card.card_info:
                    card.card_info["card_features"] = []
                
                # 获取现有的 slot_name 集合
                existing_slot_names = {feature.get("slot_name") for feature in card.card_info["card_features"] if feature.get("slot_name")}
                
                # 添加缺失的 slot_name
                for slot_name in required_slot_names:
                    if slot_name and slot_name not in existing_slot_names:
                        card.card_info["card_features"].append({
                            "slot_name": slot_name,
                            "slot_value_type": "string",
                            "slot_value": None,
                            "confidence": 0.0,
                            "reasoning": "未提取到信息",
                            "slot_group_info": None
                        })
                        logger.info(f"为卡片添加缺失的 slot_name: {slot_name}")
    
    # Step6: 证据卡片批量创建（使用 update_or_create 方法）
    created_cards = []
    for card in final_card_data:
        try:
            # 只有 card_info 不为空时才创建卡片
            if not card.card_info:
                logger.warning(f"跳过卡片创建（缺少 card_info），evidence_ids: {card.evidence_ids}")
                continue
            
            # 确保 card_info 有必要的字段
            # 如果 card_type 不存在，说明分类失败，跳过创建
            if "card_type" not in card.card_info or not card.card_info.get("card_type"):
                logger.warning(f"跳过卡片创建（缺少 card_type），evidence_ids: {card.evidence_ids}")
                continue
            
            # 确保其他必要字段存在
            if "card_is_associated" not in card.card_info:
                card.card_info["card_is_associated"] = len(card.evidence_ids) > 1
            if "card_features" not in card.card_info:
                card.card_info["card_features"] = []
            
            # 确保 evidence_ids 不为空
            if not card.evidence_ids:
                logger.warning(f"跳过卡片创建（evidence_ids 为空）")
                continue
            
            # 如果是重铸，更新现有卡片
            if card_id:
                # 重铸：更新现有卡片
                if existing_card:
                    # 更新卡片的 evidence_ids 和 card_info
                    existing_card.evidence_ids = card.evidence_ids
                    # 确保 card_info 被正确更新（使用深拷贝避免引用问题）
                    import copy
                    from sqlalchemy.orm.attributes import flag_modified
                    
                    # 验证 card_type 是否正确设置
                    final_card_type = card.card_info.get('card_type') if card.card_info else None
                    logger.info(f"重铸卡片 #{card_id}，准备保存的 card_type: {final_card_type}, target_card_type: {target_card_type}")
                    
                    existing_card.card_info = copy.deepcopy(card.card_info)
                    # 标记 JSONB 字段已被修改，确保 SQLAlchemy 检测到变化
                    flag_modified(existing_card, "card_info")
                    # 确保 updated_times 递增
                    existing_card.updated_times = (existing_card.updated_times or 0) + 1
                    await db.commit()
                    await db.refresh(existing_card)
                    
                    # 验证保存后的 card_type
                    saved_card_type = existing_card.card_info.get('card_type') if existing_card.card_info else None
                    logger.info(f"重铸卡片 #{card_id}，保存后的 card_type: {saved_card_type}")
                    
                    created_cards.append(existing_card)
                    logger.info(f"重铸卡片 #{card_id}，更新 evidence_ids: {card.evidence_ids}, card_type: {final_card_type}")
                else:
                    logger.error(f"重铸失败：找不到卡片 #{card_id}")
            else:
                # 正常铸造：创建新卡片
                created_card = await EvidenceCard.update_or_create(
                    db=db,
                    case_id=case_id,
                    evidence_ids=card.evidence_ids,
                    card_info=card.card_info
                )
                created_cards.append(created_card)
        except Exception as e:
            logger.error(f"创建卡片失败，evidence_ids: {card.evidence_ids}, 错误: {str(e)}")
            continue
    
    # 返回创建的卡片数据
    # 直接使用evidence_ids字段，不需要加载关系
    result_cards = []
    for card in created_cards:
        result_cards.append({
            "id": card.id,
            "evidence_ids": card.evidence_ids or [],
            "card_info": card.card_info,
            "updated_times": card.updated_times,
            "created_at": card.created_at.isoformat() if card.created_at else None,
            "updated_at": card.updated_at.isoformat() if card.updated_at else None,
        })
    
    return result_cards


async def get_card_by_id(db: AsyncSession, card_id: int) -> Optional[EvidenceCard]:
    """根据ID获取证据卡片，包含关联的证据信息（按序号排序）
    
    Args:
        db: 数据库会话
        card_id: 卡片ID
        
    Returns:
        EvidenceCard: 卡片实例，evidences 已按序号排序
    """
    from sqlalchemy import select
    
    result = await db.execute(
        select(EvidenceCard).where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    # 不再需要排序，因为evidence_ids字段已经按顺序存储
    # 如果需要获取证据列表，可以通过card.evidence_ids查询
    
    return card


async def check_evidence_is_minted(db: AsyncSession, evidence_id: int) -> bool:
    """检查证据是否已铸造（是否有卡片引用了该证据）
    
    Args:
        db: 数据库会话
        evidence_id: 证据ID
        
    Returns:
        bool: True表示已铸造（有卡片在evidence_ids字段中包含该证据ID），False表示未铸造
    """
    from app.evidences.models import EvidenceCard
    from sqlalchemy import select
    
    # 使用JSONB的@>操作符检查数组是否包含该证据ID
    result = await db.execute(
        select(EvidenceCard.id)
        .where(EvidenceCard.evidence_ids.contains([evidence_id]))
        .limit(1)
    )
    
    return result.scalar_one_or_none() is not None


async def get_card_evidence_ids_sorted(db: AsyncSession, card_id: int) -> tuple[List[int], bool, List[int]]:
    """获取卡片关联的证据ID列表（按顺序返回），同时返回异常信息
    
    Args:
        db: 数据库会话
        card_id: 卡片ID
        
    Returns:
        tuple[List[int], bool, List[int]]: 
            - 证据ID列表（过滤掉不存在的证据，保持原有顺序）
            - 是否存在异常关联（有证据被删除）
            - 异常关联的索引列表（在evidence_ids中的位置）
    """
    from app.evidences.models import EvidenceCard, Evidence
    from sqlalchemy import select
    
    # 获取卡片
    result = await db.execute(
        select(EvidenceCard).where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    if not card or not card.evidence_ids:
        return [], False, []
    
    # 检查每个evidence_id是否存在
    evidence_ids_result = await db.execute(
        select(Evidence.id).where(Evidence.id.in_(card.evidence_ids))
    )
    existing_evidence_ids = set(evidence_ids_result.scalars().all())
    
    # 过滤掉不存在的证据，保持原有顺序
    evidence_ids = []
    abnormal_indices = []
    
    for idx, evidence_id in enumerate(card.evidence_ids):
        if evidence_id in existing_evidence_ids:
            evidence_ids.append(evidence_id)
        else:
            # 证据不存在，记录索引
            abnormal_indices.append(idx)
    
    has_abnormal = len(abnormal_indices) > 0
    return evidence_ids, has_abnormal, abnormal_indices


async def card_to_response(card: EvidenceCard, db: AsyncSession) -> Any:
    """将 EvidenceCard 转换为 EvidenceCardResponse
    
    Args:
        card: 卡片实例
        db: 数据库会话（用于检查证据是否存在）
        
    Returns:
        EvidenceCardResponse: 响应模型
    """
    from app.evidences.schemas import EvidenceCardResponse
    
    # 获取所有引用ID（包括已删除的），从card.evidence_ids获取
    all_evidence_ids = card.evidence_ids or []
    
    # 获取存在的证据ID列表，以及异常信息
    evidence_ids, has_abnormal, abnormal_indices = await get_card_evidence_ids_sorted(db, card.id)
    
    # has_abnormal为True表示有异常，is_normal应该为False（反转逻辑）
    is_normal = not has_abnormal
    
    return EvidenceCardResponse(
        id=card.id,
        evidence_ids=evidence_ids,
        all_evidence_ids=all_evidence_ids,  # 所有引用ID（包括已删除的）
        card_info=card.card_info,
        updated_times=card.updated_times,
        is_normal=is_normal,
        abnormal_sequence_numbers=abnormal_indices,  # 使用索引而不是序号（在all_evidence_ids中的位置）
        created_at=card.created_at.isoformat() if card.created_at else None,
        updated_at=card.updated_at.isoformat() if card.updated_at else None,
    )


async def delete_card(
    db: AsyncSession,
    card_id: int,
) -> bool:
    """删除证据卡片
    
    Args:
        db: 数据库会话
        card_id: 卡片ID
        
    Returns:
        bool: 删除是否成功
        
    Note:
        - 删除卡片时，不需要处理任何关联，直接删除即可
        - 删除卡片时，关联表 EvidenceCardSlotAssignment 中的 card_id 会通过 SET NULL 自动设置为 NULL
        - 为了保持数据一致性，我们显式地将所有引用该卡片的槽位关联的 card_id 设置为 NULL
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    # 获取卡片
    result = await db.execute(
        select(EvidenceCard)
        .where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    if not card:
        return False
    
    # 显式地将所有引用该卡片的槽位关联的 card_id 设置为 NULL
    # 虽然数据库会自动 SET NULL，但显式处理更清晰
    slot_assignments_result = await db.execute(
        select(EvidenceCardSlotAssignment)
        .where(EvidenceCardSlotAssignment.card_id == card_id)
    )
    slot_assignments = slot_assignments_result.scalars().all()
    
    for assignment in slot_assignments:
        assignment.card_id = None
    
    # 删除卡片（关联表会自动处理）
    await db.delete(card)
    await db.commit()
    
    return True


async def update_card(
    db: AsyncSession,
    card_id: int,
    update_request: EvidenceCardUpdateRequest
) -> EvidenceCard:
    """更新证据卡片
    
    支持以下更新操作：
    1. 更新 card_info（可以部分更新）
    2. 更新 card_features（更新 card_info 中的 card_features 数组）
    3. 更新引用证据的关系和顺序（更新关联表）
    
    Args:
        db: 数据库会话
        card_id: 卡片ID
        update_request: 更新请求
        
    Returns:
        EvidenceCard: 更新后的卡片实例
        
    Raises:
        ValueError: 如果卡片不存在或更新数据无效
    """
    from sqlalchemy.orm.attributes import flag_modified
    from datetime import datetime
    import pytz
    from app.evidences.models import Evidence
    
    # 获取卡片
    result = await db.execute(
        select(EvidenceCard).where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise ValueError(f"卡片不存在: ID={card_id}")
    
    # 更新 card_info
    if update_request.card_info is not None:
        # 如果提供了完整的 card_info，则替换
        card.card_info = update_request.card_info
        # 标记 JSONB 字段已修改
        flag_modified(card, 'card_info')
    elif update_request.card_features is not None:
        # 如果只更新 card_features，则合并到现有的 card_info 中
        if card.card_info is None:
            card.card_info = {}
        
        # 获取或创建 card_features 数组
        if "card_features" not in card.card_info:
            card.card_info["card_features"] = []
        
        card_features = card.card_info["card_features"]
        
        # 更新每个特征
        for feature_update in update_request.card_features:
            # 查找对应的特征
            found = False
            for i, feature in enumerate(card_features):
                if feature.get("slot_name") == feature_update.slot_name:
                    # 更新特征值
                    card_features[i]["slot_value"] = feature_update.slot_value
                    found = True
                    break
            
            if not found:
                # 如果特征不存在，添加新特征
                card_features.append({
                    "slot_name": feature_update.slot_name,
                    "slot_value": feature_update.slot_value,
                    "slot_value_type": type(feature_update.slot_value).__name__,
                    "confidence": 0.0,
                    "reasoning": "手动更新"
                })
        
        card.card_info["card_features"] = card_features
        # 标记 JSONB 字段已修改（重要：修改 JSONB 字段内部内容后必须标记）
        flag_modified(card, 'card_info')
    
    # 更新引用证据的关系和顺序
    if update_request.referenced_evidences is not None:
        # 验证所有证据ID是否存在
        evidence_ids = [ref.evidence_id for ref in update_request.referenced_evidences]
        evidences_result = await db.execute(
            select(Evidence).where(Evidence.id.in_(evidence_ids))
        )
        evidences = evidences_result.scalars().all()
        
        if len(evidences) != len(evidence_ids):
            found_ids = {ev.id for ev in evidences}
            missing_ids = set(evidence_ids) - found_ids
            raise ValueError(f"以下证据不存在: {missing_ids}")
        
        # 验证序号是否连续且从0开始
        sequence_numbers = sorted([ref.sequence_number for ref in update_request.referenced_evidences])
        if sequence_numbers != list(range(len(sequence_numbers))):
            raise ValueError(f"序号必须从0开始且连续，当前序号: {sequence_numbers}")
        
        # 按序号排序evidence_ids
        sorted_refs = sorted(update_request.referenced_evidences, key=lambda x: x.sequence_number)
        evidence_ids_ordered = [ref.evidence_id for ref in sorted_refs]
        
        # 直接更新evidence_ids字段
        card.evidence_ids = evidence_ids_ordered
        flag_modified(card, 'evidence_ids')
    
    # 更新时间戳和更新次数
    shanghai_tz = pytz.timezone('Asia/Shanghai')
    card.updated_at = datetime.now(shanghai_tz)
    card.updated_times = (card.updated_times or 0) + 1
    
    await db.commit()
    
    # 刷新卡片
    await db.refresh(card)
    
    return card


async def get_cards_with_evidence_ids_sorted(
    db: AsyncSession,
    cards: List[EvidenceCard]
) -> List[tuple[EvidenceCard, List[int], bool, List[int]]]:
    """获取卡片列表及其按序号排序的证据ID列表，以及异常信息
    
    Args:
        db: 数据库会话
        cards: 卡片列表
        
    Returns:
        List[tuple[EvidenceCard, List[int], bool, List[int]]]: 
            卡片及其按序号排序的证据ID列表、是否存在异常关联、异常序号列表
    """
    result = []
    for card in cards:
        evidence_ids, has_abnormal, abnormal_sequence_numbers = await get_card_evidence_ids_sorted(db, card.id)
        result.append((card, evidence_ids, has_abnormal, abnormal_sequence_numbers))
    
    return result


async def get_cards_with_count(
    db: AsyncSession,
    *,
    case_id: int,
    skip: int = 0,
    limit: int = 100,
    card_type: Optional[str] = None,
    card_is_associated: Optional[bool] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
) -> tuple[List[EvidenceCard], int]:
    """获取案件的证据卡片列表，并返回总数，支持筛选和排序
    
    Args:
        db: 数据库会话
        case_id: 案件ID（必须）
        skip: 跳过记录数（分页）
        limit: 返回记录数限制（分页）
        card_type: 卡片类型（筛选条件，从card_info中提取）
        card_is_associated: 是否关联提取（筛选条件，从card_info中提取）
        sort_by: 排序字段（created_at, updated_at, updated_times）
        sort_order: 排序顺序（asc, desc）
        
    Returns:
        tuple[List[EvidenceCard], int]: 卡片列表和总数
    """
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import cast, Text, and_
    
    query = select(EvidenceCard)
    
    # 筛选条件
    conditions = []
    
    # 根据案件ID筛选（必须，直接通过case_id查询）
    conditions.append(EvidenceCard.case_id == case_id)
    
    # 根据卡片类型筛选（从 card_info JSONB 中提取）
    if card_type:
        conditions.append(
            func.jsonb_extract_path_text(EvidenceCard.card_info, cast('card_type', Text)) == card_type
        )
    
    # 根据是否关联提取筛选（从 card_info JSONB 中提取）
    if card_is_associated is not None:
        conditions.append(
            func.jsonb_extract_path_text(EvidenceCard.card_info, cast('card_is_associated', Text)) == str(card_is_associated).lower()
        )
    
    # 应用筛选条件
    if conditions:
        query = query.where(and_(*conditions))
    
    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # 排序
    if sort_by:
        # 验证排序字段
        valid_sort_fields = {
            'created_at': EvidenceCard.created_at,
            'updated_at': EvidenceCard.updated_at,
            'updated_times': EvidenceCard.updated_times,
        }
        
        if sort_by in valid_sort_fields:
            sort_column = valid_sort_fields[sort_by]
            if sort_order and sort_order.lower() == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            # 默认按创建时间倒序
            query = query.order_by(EvidenceCard.created_at.desc())
    else:
        # 默认按创建时间倒序
        query = query.order_by(EvidenceCard.created_at.desc())
    
    # 分页
    query = query.offset(skip).limit(limit)
    
    # 执行查询
    result = await db.execute(query)
    data = list(result.scalars().unique().all())
    
    return data, total


class SlotExtraction(BaseModel):
    """单个词槽提取结果"""
    slot_name: str  # 必须是extraction_slots中的slot_name
    slot_desc: str
    slot_value_type: str
    slot_required: Any
    slot_value: Any
    confidence: float
    reasoning: str  # 提取理由，特别说明来自哪些图片


demo_cards_data = [
    {
    "evidence_ids": [1],
    "card_info": {
        "card_type": "微信个人主页",
        "card_is_associated": False,
        "card_features": [{
            "slot_name": "微信备注名",
            "slot_value_type": "string",
            "slot_value": "明天会更好",
            "confidence": 0.95,
            "reasoning": "微信个人主页中提取的微信备注名",
            "slot_group_info": None
        },
        {
            "slot_name": "微信号",
            "slot_value_type": "string",
            "slot_value": "1234567890",
            "confidence": 0.95,
            "reasoning": "微信个人主页中提取的微信号",
            "slot_group_info": None,
        }]
    }
},
{
    "evidence_ids": [2, 3, 15, 17],
    "card_info": {
        "card_type": "微信聊天记录",
        "card_is_associated": True,
        "card_features": [
            {
                "slot_name": "微信备注名",
                "slot_value_type": "string",
                "slot_value": "明天会更好",
                "confidence": 0.95,
                "reasoning": "证据2,3种，微信聊天记录中提取的微信备注名",
                "slot_group_info": [
                    {
                        "group_name": "明天会更好",
                        "reference_evidence_ids": [2, 3],
                    }
                ],
            },
            {
                "slot_name": "欠款金额",
                "slot_value_type": "number",
                "slot_value": "10000",
                "confidence": 0.95,
                "reasoning": "证据15,17中，微信聊天记录中提取的欠款金额",
                "slot_group_info": [
                    {
                        "group_name": "10000",
                        "reference_evidence_ids": [15, 17],
                    }
                ],
            }
        ]
    }
},
{
    "evidence_ids": [33, 56],
    "card_info": {
        "card_type": "未知",
        "card_is_associated": False,
        "card_features": []
    }
}
]


async def get_evidence_card_slot_templates(db: AsyncSession, case_id: int) -> EvidenceCardSlotTemplatesResponse:
    """获取案件的证据卡槽模板
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        
    Returns:
        EvidenceCardSlotTemplatesResponse: 证据卡槽模板响应
    """
    # 获取案件信息
    result = await db.execute(
        select(Case)
        .options(joinedload(Case.case_parties))
        .where(Case.id == case_id)
    )
    case = result.unique().scalar_one_or_none()
    
    if not case:
        raise ValueError(f"案件不存在: {case_id}")
    
    # 获取案由
    case_cause = None
    if case.case_type:
        case_cause = case.case_type.value  # "contract" 或 "debt"
    
    # 获取债权人和债务人类型
    creditor_type = None
    debtor_type = None
    if case.case_parties:
        for party in case.case_parties:
            if party.party_role == "creditor":
                creditor_type = party.party_type  # "person", "company", "individual"
            elif party.party_role == "debtor":
                debtor_type = party.party_type
    
    # 加载证据卡槽配置
    config = config_manager.load_evidence_card_slots_config()
    
    # 类型映射（数据库枚举值到配置值）
    type_mapping = {
        'person': 'person',
        'company': 'company',
        'individual': 'individual'
    }
    
    # 筛选适用的场景规则
    applicable_rules = []
    if case_cause:
        for rule in config.scenario_rules:
            if rule.get('case_cause') == case_cause:
                applicable_rules.append(rule)
    
    # 如果没有适用的规则，返回空列表
    if not applicable_rules:
        return EvidenceCardSlotTemplatesResponse(
            case_id=case_id,
            case_cause=config.case_causes.get(case_cause) if case_cause else None,
            creditor_type=config.party_types.get(creditor_type) if creditor_type else None,
            debtor_type=config.party_types.get(debtor_type) if debtor_type else None,
            templates=[]
        )
    
    # 生成模板列表
    templates = []
    for rule in applicable_rules:
        key_evidence = rule.get('key_evidence')  # "wechat_record" 或 "iou_record"
        key_evidence_name = config.key_evidence_types.get(key_evidence, key_evidence)
        
        # 构建模板ID
        case_cause_name = config.case_causes.get(case_cause, case_cause) if case_cause else "未知"
        creditor_type_name = config.party_types.get(creditor_type, creditor_type) if creditor_type else "未知"
        debtor_type_name = config.party_types.get(debtor_type, debtor_type) if debtor_type else "未知"
        
        template_id_parts = [
            case_cause_name,
            key_evidence_name,
            creditor_type_name,
            debtor_type_name
        ]
        template_id = "-".join(template_id_parts) + "-卡片槽位模板"
        
        # 获取需要的证据类型列表
        required_evidence_types = rule.get('required_evidence_types', [])
        
        # 生成需要的卡片类型列表
        required_card_types = []
        
        for evidence_type_config in required_evidence_types:
            evidence_type = evidence_type_config.get('evidence_type')
            if not evidence_type:
                continue
            
            # 判断是否需要这个证据类型
            role_requirement = evidence_type_config.get('role_requirement')
            for_creditor_type = evidence_type_config.get('for_creditor_type')
            for_debtor_type = evidence_type_config.get('for_debtor_type')
            
            # 判断是否符合角色要求
            should_include = False
            if role_requirement == "ignore":
                should_include = True
            elif role_requirement == "all":
                should_include = True
            elif role_requirement == "creditor":
                should_include = creditor_type is not None
            elif role_requirement == "debtor":
                should_include = debtor_type is not None
            else:
                # 根据for_creditor_type和for_debtor_type动态判断
                if for_creditor_type and creditor_type == for_creditor_type:
                    should_include = True
                if for_debtor_type and debtor_type == for_debtor_type:
                    should_include = True
            
            if not should_include:
                continue
            
            # 查找对应的卡槽模板
            card_template = None
            for template in config.evidence_card_templates:
                if template.get('card_type') == evidence_type:
                    card_template = template
                    break
            
            if card_template:
                # 构建卡槽列表
                required_slots = []
                for slot_config in card_template.get('required_slots', []):
                    proofread_rules = slot_config.get('proofread_rules', [])
                    required_slots.append(EvidenceCardSlot(
                        slot_name=slot_config.get('slot_name'),
                        proofread_rules=proofread_rules
                    ))
                
                # 确定最终的role_requirement
                final_role_requirement = role_requirement
                if not final_role_requirement:
                    # 根据for_creditor_type和for_debtor_type动态决定
                    creditor_needs = for_creditor_type and creditor_type == for_creditor_type
                    debtor_needs = for_debtor_type and debtor_type == for_debtor_type
                    
                    if creditor_needs and debtor_needs:
                        final_role_requirement = "all"
                    elif creditor_needs:
                        final_role_requirement = "creditor"
                    elif debtor_needs:
                        final_role_requirement = "debtor"
                    else:
                        final_role_requirement = "ignore"
                
                # 获取or_group
                or_group = evidence_type_config.get('or_group')
                
                required_card_types.append(EvidenceCardTemplate(
                    card_type=evidence_type,
                    required_slots=required_slots,
                    role_requirement=final_role_requirement,
                    or_group=or_group if or_group is not None else None
                ))
        
        templates.append(EvidenceCardSlotTemplate(
            template_id=template_id,
            case_cause=case_cause_name,
            key_evidence=key_evidence or "",
            key_evidence_name=key_evidence_name or key_evidence or "未知",
            creditor_type=config.party_types.get(creditor_type) if creditor_type else None,
            debtor_type=config.party_types.get(debtor_type) if debtor_type else None,
            required_card_types=required_card_types
        ))
    
    return EvidenceCardSlotTemplatesResponse(
        case_id=case_id,
        case_cause=config.case_causes.get(case_cause) if case_cause else None,
        creditor_type=config.party_types.get(creditor_type) if creditor_type else None,
        debtor_type=config.party_types.get(debtor_type) if debtor_type else None,
        templates=templates
    )


# ==================== 槽位关联快照相关函数 ====================

async def get_slot_assignment_snapshot(
    db: AsyncSession,
    case_id: int,
    template_id: str,
) -> Dict[str, Any]:
    """
    获取某个案件、某个模板的槽位快照（包含校对结果）
    
    注意：会自动清理异常卡片所在的槽位关联
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        
    Returns:
        Dict包含:
            - assignments: Dict[str, Optional[int]] - 槽位ID到卡片ID的映射（已过滤异常卡片）
            - proofread_results: Dict[str, List[SlotProofreadResult]] - 校对结果：{slotId: [校对结果列表]}
    """
    from sqlalchemy import select
    
    # 获取槽位关联
    assignments = await EvidenceCardSlotAssignment.get_snapshot(db, case_id, template_id)
    
    # 检查并清理异常卡片所在的槽位关联
    slots_to_cleanup: List[str] = []
    cleaned_assignments: Dict[str, Optional[int]] = {}
    
    for slot_id, card_id in assignments.items():
        if card_id is None:
            # 空槽位，直接保留
            cleaned_assignments[slot_id] = None
            continue
        
        # 检查卡片是否存在且正常
        try:
            # 查询卡片
            result = await db.execute(
                select(EvidenceCard).where(EvidenceCard.id == card_id)
            )
            card = result.scalar_one_or_none()
            
            if card is None:
                # 卡片不存在，标记为需要清理
                logger.warning(f"槽位 {slot_id} 关联的卡片 {card_id} 不存在，将自动清理")
                slots_to_cleanup.append(slot_id)
                continue
            
            # 检查卡片是否异常
            evidence_ids, has_abnormal, abnormal_indices = await get_card_evidence_ids_sorted(db, card_id)
            is_normal = not has_abnormal
            
            if not is_normal:
                # 卡片异常，标记为需要清理
                logger.warning(f"槽位 {slot_id} 关联的卡片 {card_id} 异常（is_normal=False），将自动清理")
                slots_to_cleanup.append(slot_id)
                continue
            
            # 卡片正常，保留关联
            cleaned_assignments[slot_id] = card_id
            
        except Exception as e:
            logger.error(f"检查槽位 {slot_id} 关联的卡片 {card_id} 时出错: {e}")
            # 检查失败时，为了安全起见，也标记为需要清理
            slots_to_cleanup.append(slot_id)
    
    # 批量清理异常卡片所在的槽位关联
    if slots_to_cleanup:
        logger.info(f"自动清理 {len(slots_to_cleanup)} 个异常卡片所在的槽位关联: {slots_to_cleanup}")
        for slot_id in slots_to_cleanup:
            try:
                await EvidenceCardSlotAssignment.update_assignment(
                    db, case_id, template_id, slot_id, None
                )
            except Exception as e:
                logger.error(f"清理槽位 {slot_id} 关联失败: {e}")
    
    # 为每个有卡片的槽位获取校对结果（只处理正常卡片）
    proofread_results: Dict[str, List[SlotProofreadResult]] = {}
    slot_consistency: Dict[str, bool] = {}
    
    for slot_id, card_id in cleaned_assignments.items():
        if card_id is not None:
            try:
                # 调用校对函数获取校对结果
                proofread_response = await proofread_card_slot(
                    db=db,
                    case_id=case_id,
                    template_id=template_id,
                    slot_id=slot_id,
                    card_id=card_id
                )
                # 将校对结果存入字典
                proofread_results[slot_id] = proofread_response.proofread_results
                # 保存整体一致性状态
                slot_consistency[slot_id] = proofread_response.overall_consistency
            except Exception as e:
                logger.error(f"获取槽位 {slot_id} 的校对结果失败: {e}")
                # 校对失败时，不添加校对结果（空列表表示无校对结果）
                proofread_results[slot_id] = []
                # 校对失败时，视为不一致
                slot_consistency[slot_id] = False
    
    return {
        "assignments": cleaned_assignments,  # 返回清理后的关联（已过滤异常卡片）
        "proofread_results": proofread_results,
        "slot_consistency": slot_consistency
    }


async def update_slot_assignment(
    db: AsyncSession,
    case_id: int,
    template_id: str,
    slot_id: str,
    card_id: Optional[int],
) -> Optional[EvidenceCardSlotAssignment]:
    """
    更新或创建槽位关联
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        slot_id: 槽位ID
        card_id: 卡片ID（None表示删除关联记录）
        
    Returns:
        Optional[EvidenceCardSlotAssignment]: 更新或创建的关联记录，如果删除则返回None
    """
    return await EvidenceCardSlotAssignment.update_assignment(
        db, case_id, template_id, slot_id, card_id
    )


async def reset_slot_assignment_snapshot(
    db: AsyncSession,
    case_id: int,
    template_id: str,
) -> int:
    """
    重置某个案件、某个模板的所有槽位关联（删除所有关联记录）
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        
    Returns:
        int: 删除的记录数
    """
    return await EvidenceCardSlotAssignment.reset_snapshot(db, case_id, template_id)


# ==================== 卡槽校对相关函数 ====================

async def proofread_card_slot(
    db: AsyncSession,
    case_id: int,
    template_id: str,
    slot_id: str,
    card_id: int,
) -> CardSlotProofreadResponse:
    """
    校对卡槽中的卡片
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        slot_id: 槽位ID，格式：slot::{role}::{cardType}::{index}
        card_id: 卡片ID
        
    Returns:
        CardSlotProofreadResponse: 校对结果
    """
    from app.agentic.agents.evidence_proofreader import EvidenceProofreader, ProofreadRule, ProofreadResult, EvidenceFeatureItem
    from sqlalchemy.orm import joinedload
    from sqlalchemy import select
    
    # 获取案件信息（包含当事人信息）
    case_result = await db.execute(
        select(Case)
        .options(joinedload(Case.case_parties))
        .where(Case.id == case_id)
    )
    case = case_result.unique().scalar_one_or_none()
    if not case:
        raise ValueError(f"案件不存在: {case_id}")
    
    # 获取卡片信息
    card_result = await db.execute(
        select(EvidenceCard).where(EvidenceCard.id == card_id)
    )
    card = card_result.scalar_one_or_none()
    if not card:
        raise ValueError(f"卡片不存在: {card_id}")
    
    # 从slot_id中提取card_type信息
    # slot_id格式: slot::{role}::{cardType}::{index}
    slot_id_parts = slot_id.split('::')
    if len(slot_id_parts) < 3:
        raise ValueError(f"槽位ID格式错误: {slot_id}")
    
    card_type = slot_id_parts[2]
    
    # 验证卡片类型是否匹配
    card_info = card.card_info or {}
    actual_card_type = card_info.get('card_type', '')
    if actual_card_type != card_type:
        raise ValueError(f"卡片类型不匹配: 期望 {card_type}, 实际 {actual_card_type}")
    
    # 加载证据卡槽配置
    config = config_manager.load_evidence_card_slots_config()
    
    # 查找对应的卡槽模板配置
    card_template = None
    for template in config.evidence_card_templates:
        if template.get('card_type') == card_type:
            card_template = template
            break
    
    if not card_template:
        raise ValueError(f"未找到卡片类型 {card_type} 的配置")
    
    # 获取卡片的特征列表
    card_features = card_info.get('card_features', [])
    if not card_features:
        # 如果没有特征，返回空结果
        return CardSlotProofreadResponse(
            case_id=case_id,
            template_id=template_id,
            slot_id=slot_id,
            card_id=card_id,
            card_type=card_type,
            proofread_results=[],
            overall_consistency=True
        )
    
    # 创建校对器实例
    proofreader = EvidenceProofreader()
    
    # 构建校对任务列表
    proofread_results = []
    required_slots = card_template.get('required_slots', [])
    
    for slot_config in required_slots:
        slot_name = slot_config.get('slot_name')
        proofread_rules_config = slot_config.get('proofread_rules', [])
        
        # 如果没有校对规则，跳过
        if not proofread_rules_config:
            continue
        
        # 查找对应的卡片特征值（支持字段名同义词映射）
        slot_value = None
        
        # 字段名同义词映射表（用于处理不同来源的字段名差异）
        slot_name_aliases = {
            '经营名称': ['公司名称', '经营名称', '名称', '企业名称', '个体工商户名称'],
            '公司名称': ['公司名称', '企业名称', '名称', '经营名称'],
            '住所地': ['住所地', '地址', '住址', '注册地址', '经营场所', '住所'],
            '统一社会信用代码': ['统一社会信用代码', '社会信用代码', '信用代码', '统一代码'],
            '法定代表人': ['法定代表人', '法人代表', '负责人', '法人'],
            '经营者姓名': ['经营者姓名', '经营者', '姓名', '经营者名称'],
            '经营类型': ['经营类型', '公司类型', '企业类型', '类型'],
            # 身份证相关字段的同义词
            '出生': ['出生', '出生日期', '生日', '出生年月日'],
            '住址': ['住址', '地址', '住所地', '居住地址', '户籍地址'],
            '公民身份号码': ['公民身份号码', '身份证号', '身份证号码', '身份证'],
            '姓名': ['姓名', '名字', '真名', '名称'],
            # 其他常见字段的同义词
            '真名': ['真名', '姓名', '名字', '名称'],
            '地址': ['地址', '住址', '住所地', '居住地址', '注册地址', '经营场所'],
        }
        
        # 获取目标字段名的所有可能别名
        possible_names = slot_name_aliases.get(slot_name, [slot_name])
        
        # 查找匹配的字段（支持同义词匹配）
        for feature in card_features:
            if isinstance(feature, dict):
                feature_slot_name = feature.get('slot_name')
                if feature_slot_name:
                    # 检查是否匹配任何可能的别名
                    if feature_slot_name in possible_names:
                        slot_value = feature.get('slot_value')
                        logger.info(f"[proofread_card_slot] 找到字段值: slot_name={slot_name}, feature_slot_name={feature_slot_name}, slot_value={slot_value}")
                        break
        
        # 如果没有找到值，记录日志并跳过
        if slot_value is None or slot_value == '':
            logger.warning(f"[proofread_card_slot] 未找到字段值: slot_name={slot_name}, possible_names={possible_names}, card_features={[f.get('slot_name') for f in card_features if isinstance(f, dict)]}")
            continue
        
        # 解析校对规则
        rules = []
        for rule_data in proofread_rules_config:
            try:
                rule = ProofreadRule(**rule_data)
                rules.append(rule)
            except Exception as e:
                logger.error(f"解析校对规则失败: {e}")
                continue
        
        if not rules:
            continue
        
        # 创建特征项（模拟EvidenceFeatureItem，用于校对）
        feature_item = EvidenceFeatureItem(
            slot_name=slot_name,
            slot_value=slot_value,
            confidence=1.0,
            reasoning="",
            slot_desc="",
            slot_value_type="string",
            slot_required=True
        )
        
        # 创建最小化的Evidence对象（用于校对器API）
        # 从slot_id中提取role信息（格式：slot::{role}::{cardType}::{index}）
        # slot_id_parts 已在前面定义
        evidence_role = slot_id_parts[1] if len(slot_id_parts) > 1 else None
        
        # 创建最小化的Evidence对象
        class MinimalEvidence:
            def __init__(self, evidence_role):
                self.evidence_role = evidence_role
        
        minimal_evidence = MinimalEvidence(evidence_role)
        
        # 应用校对规则
        for rule in rules:
            try:
                # 使用cast来绕过类型检查，因为校对器只需要evidence_role属性
                result = await proofreader._apply_proofread_rule(
                    slot_name=slot_name,
                    rule=rule,
                    evidence_features=[feature_item],
                    case=case,
                    evidence=cast(Evidence, minimal_evidence)  # type: ignore
                )
                
                if result:
                    proofread_results.append(SlotProofreadResult(
                        slot_name=slot_name,
                        slot_value=slot_value,
                        is_consistent=result.is_consistent,
                        expected_value=result.expected_value,
                        proofread_reasoning=result.proofread_reasoning,
                        has_proofread_rules=True
                    ))
                    break  # 找到第一个适用的规则后停止
            except Exception as e:
                logger.error(f"应用校对规则失败: {e}")
                # 校对失败时，标记为不一致
                proofread_results.append(SlotProofreadResult(
                    slot_name=slot_name,
                    slot_value=slot_value,
                    is_consistent=False,
                    expected_value=None,
                    proofread_reasoning=f"校对过程出错: {str(e)}",
                    has_proofread_rules=True
                ))
    
    # 计算整体一致性
    overall_consistency = all(r.is_consistent for r in proofread_results) if proofread_results else True
    
    return CardSlotProofreadResponse(
        case_id=case_id,
        template_id=template_id,
        slot_id=slot_id,
        card_id=card_id,
        card_type=card_type,
        proofread_results=proofread_results,
        overall_consistency=overall_consistency
    )