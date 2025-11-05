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
    EvidenceCardSlot
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
    """删除证据"""
    evidence = await get_by_id(db, evidence_id)
    if not evidence:
        return False
    
    # 从COS删除文件
    # 从URL中提取对象键
    file_url = evidence.file_url
    object_key = file_url.split(".com/")[-1] if ".com/" in file_url else file_url
    cos_service.delete_file(object_key)
    
    # 从数据库删除记录
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
            
            # 刷新所有对象
            for evidence in evidences:
                await db.refresh(evidence)
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
    """
    successful = []
    failed = []
    object_keys = []
    
    # 先获取所有证据
    for evidence_id in evidence_ids:
        evidence = await get_by_id(db, evidence_id)
        if not evidence:
            failed.append(f"证据ID {evidence_id} 不存在")
            continue
        
        # 从URL中提取对象键
        file_url = evidence.file_url
        object_key = file_url.split(".com/")[-1] if ".com/" in file_url else file_url
        object_keys.append(object_key)
        
        # 标记为删除
        await db.delete(evidence)
        successful.append(evidence_id)
    
    # 删除关联的association_evidence_features记录
    # 检查是否包含"微信聊天记录"类型的证据
    from app.cases.models import AssociationEvidenceFeature
    from sqlalchemy import func
    
    # 获取被删除的证据信息，检查是否包含"微信聊天记录"类型
    deleted_evidences = []
    for evidence_id in evidence_ids:
        evidence = await get_by_id(db, evidence_id)
        if evidence and evidence.classification_category == "微信聊天记录":
            deleted_evidences.append(evidence)
    
    # 如果包含"微信聊天记录"类型的证据，删除所有相关的association_evidence_features记录
    if deleted_evidences:
        deleted_evidence_ids = [e.id for e in deleted_evidences]
        
        # 查找所有包含被删除证据ID的关联特征记录
        for evidence_id in deleted_evidence_ids:
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
    ):
    """
    证据卡片铸造（从证据特征中铸造证据卡片）
    
    支持两种场景：
    1. 单个证据提取：每个证据生成一个卡片
    2. 关联证据提取：多个证据共同生成一个卡片（未来功能）
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        evidence_ids: 证据ID列表
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
    if not filtered_evidences:
        return []

    # 建立 evidence_id 到 evidence 的映射，用于后续匹配
    evidence_map: Dict[int, Evidence] = {ev.id: ev for ev in filtered_evidences}
    
    # 初始化卡片数据（当前实现：每个证据一个卡片，后续可扩展为关联提取）
    card_data = [
        EvidenceCardSchema(
            evidence_ids=[evidence.id]  # 单个证据提取，后续可扩展为多个
        )
        for evidence in filtered_evidences
    ]

        
    # 卡片铸造数据构建
    # Step1. 证据分类
    evidence_classifier = EvidenceClassifier()
    classification_response: RunResponse = await asyncio.wait_for(
                evidence_classifier.arun([evidence.file_url for evidence in filtered_evidences]),
                timeout=180.0
            )
    if classification_response.content is None:
        raise ValueError("证据分类结果为空")

    # Step2: 证据分类结果处理
    evidence_classifi_results = cast(EvidenceClassifiResults, classification_response.content)
    
    if not evidence_classifi_results.results:
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
    
    # Step2: 证据分类结果处理（使用映射关系匹配）
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
                                        # 获取第一个证据的类型（所有同组证据应该是同一类型）
                                        first_evidence_id = reference_evidence_ids[0]
                                        first_card = evidence_id_to_card.get(first_evidence_id)
                                        card_type = first_card.card_info.get("card_type") if first_card and first_card.card_info else "微信聊天记录"
                                        
                                        grouped_cards[slot_group_name] = EvidenceCardSchema(
                                            evidence_ids=sorted(reference_evidence_ids),  # 排序以确保一致性
                                            card_info={
                                                "card_type": card_type,
                                                "card_is_associated": True,
                                                "card_features": []
                                            }
                                        )
                                    
                                    card = grouped_cards[slot_group_name]
                                    
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
                                            "reference_evidence_ids": sorted(reference_evidence_ids)  # 排序以确保一致性
                                        }] if reference_evidence_ids else None
                                        
                                        card.card_info["card_features"].append({
                                            "slot_name": slot_dict["slot_name"],
                                            "slot_value_type": slot_dict.get("slot_value_type", "string"),
                                            "slot_value": slot_dict.get("slot_value", ""),
                                            "confidence": slot_dict.get("confidence", 0.0),
                                            "reasoning": slot_dict.get("reasoning", ""),
                                            "slot_group_info": slot_group_info
                                        })
                                    
                                    logger.info(f"创建关联分组卡片: group_name={slot_group_name}, evidence_ids={sorted(reference_evidence_ids)}")
                                
                                # 将按 slot_group_name 分组的卡片替换掉原来按单个证据创建的卡片
                                # 首先移除所有微信聊天记录类型的原始卡片
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
    
    # 收集所有具有 slot_group_name 的特征
    group_to_features: Dict[str, Dict[str, Any]] = {}  # group_name -> {evidence_ids: set, features: list, card_type: str}
    group_to_card_info: Dict[str, Dict] = {}  # group_name -> card_info (card_type, card_is_associated)
    
    # 收集没有 slot_group_name 的卡片（保持原有逻辑）
    cards_without_group = []
    
    for card in card_data:
        if not card.card_info or not card.card_info.get("card_features"):
            # 如果没有特征，保持原有逻辑
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
    
    # Step5: 证据卡片批量创建（使用 update_or_create 方法）
    created_cards = []
    for card in final_card_data:
        try:
            # 只有 card_info 不为空时才创建卡片
            if not card.card_info:
                logger.warning(f"跳过卡片创建（缺少信息），evidence_ids: {card.evidence_ids}")
                continue
            
            # 确保 card_info 有 card_type（即使是"未知"）
            if "card_type" not in card.card_info:
                card.card_info["card_type"] = "未知"
            if "card_is_associated" not in card.card_info:
                card.card_info["card_is_associated"] = len(card.evidence_ids) > 1
            if "card_features" not in card.card_info:
                card.card_info["card_features"] = []
            
            created_card = await EvidenceCard.update_or_create(
                db=db,
                evidence_ids=card.evidence_ids,
                card_info=card.card_info
            )
            created_cards.append(created_card)
        except Exception as e:
            logger.error(f"创建卡片失败，evidence_ids: {card.evidence_ids}, 错误: {str(e)}")
            continue
    
    # 返回创建的卡片数据
    # 需要预先加载 evidences 关系，避免在访问时触发异步操作
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    
    result_cards = []
    for card in created_cards:
        # 重新查询并加载关系
        card_result = await db.execute(
            select(EvidenceCard)
            .options(selectinload(EvidenceCard.evidences))
            .where(EvidenceCard.id == card.id)
        )
        card_with_relations = card_result.scalar_one_or_none()
        
        if card_with_relations:
            result_cards.append({
                "id": card_with_relations.id,
                "evidence_ids": [ev.id for ev in card_with_relations.evidences],
                "card_info": card_with_relations.card_info,
                "updated_times": card_with_relations.updated_times,
                "created_at": card_with_relations.created_at.isoformat() if card_with_relations.created_at else None,
                "updated_at": card_with_relations.updated_at.isoformat() if card_with_relations.updated_at else None,
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
    from sqlalchemy.orm import selectinload
    from app.evidences.models import evidence_card_evidence_association
    from sqlalchemy import select
    
    result = await db.execute(
        select(EvidenceCard)
        .options(selectinload(EvidenceCard.evidences))
        .where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    if card:
        # 按序号排序证据
        evidence_with_seq = []
        for evidence in card.evidences:
            # 查询该证据在关联表中的序号
            seq_result = await db.execute(
                select(evidence_card_evidence_association.c.sequence_number)
                .where(
                    evidence_card_evidence_association.c.evidence_card_id == card_id,
                    evidence_card_evidence_association.c.evidence_id == evidence.id
                )
            )
            sequence_number = seq_result.scalar_one_or_none() or 0
            evidence_with_seq.append((sequence_number, evidence))
        
        # 按序号排序
        evidence_with_seq.sort(key=lambda x: x[0])
        # 重新设置 evidences 关系（按序号排序）
        card.evidences = [ev for _, ev in evidence_with_seq]
    
    return card


async def get_card_evidence_ids_sorted(db: AsyncSession, card_id: int) -> List[int]:
    """获取卡片关联的证据ID列表（按序号排序）
    
    Args:
        db: 数据库会话
        card_id: 卡片ID
        
    Returns:
        List[int]: 按序号排序的证据ID列表
    """
    from app.evidences.models import evidence_card_evidence_association
    from sqlalchemy import select
    
    result = await db.execute(
        select(
            evidence_card_evidence_association.c.evidence_id,
            evidence_card_evidence_association.c.sequence_number
        )
        .where(evidence_card_evidence_association.c.evidence_card_id == card_id)
        .order_by(evidence_card_evidence_association.c.sequence_number)
    )
    
    evidence_records = result.all()
    return [record.evidence_id for record in evidence_records]


async def card_to_response(card: EvidenceCard, db: AsyncSession) -> Any:
    """将 EvidenceCard 转换为 EvidenceCardResponse
    
    Args:
        card: 卡片实例
        db: 数据库会话（用于获取按序号排序的证据ID）
        
    Returns:
        EvidenceCardResponse: 响应模型
    """
    from app.evidences.schemas import EvidenceCardResponse
    
    # 获取按序号排序的证据ID列表
    evidence_ids = await get_card_evidence_ids_sorted(db, card.id)
    
    return EvidenceCardResponse(
        id=card.id,
        evidence_ids=evidence_ids,
        card_info=card.card_info,
        updated_times=card.updated_times,
        created_at=card.created_at.isoformat() if card.created_at else None,
        updated_at=card.updated_at.isoformat() if card.updated_at else None,
    )


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
    from sqlalchemy.orm import selectinload
    from sqlalchemy import delete, insert, update as sql_update
    from datetime import datetime
    import pytz
    from app.evidences.models import evidence_card_evidence_association, Evidence
    
    # 获取卡片
    result = await db.execute(
        select(EvidenceCard)
        .options(selectinload(EvidenceCard.evidences))
        .where(EvidenceCard.id == card_id)
    )
    card = result.scalar_one_or_none()
    
    if not card:
        raise ValueError(f"卡片不存在: ID={card_id}")
    
    # 更新 card_info
    if update_request.card_info is not None:
        # 如果提供了完整的 card_info，则替换
        card.card_info = update_request.card_info
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
        
        # 删除现有的关联关系
        await db.execute(
            delete(evidence_card_evidence_association)
            .where(evidence_card_evidence_association.c.evidence_card_id == card_id)
        )
        
        # 插入新的关联关系（带序号）
        association_records = [
            {
                "evidence_card_id": card_id,
                "evidence_id": ref.evidence_id,
                "sequence_number": ref.sequence_number
            }
            for ref in update_request.referenced_evidences
        ]
        
        await db.execute(
            insert(evidence_card_evidence_association).values(association_records)
        )
    
    # 更新时间戳和更新次数
    shanghai_tz = pytz.timezone('Asia/Shanghai')
    card.updated_at = datetime.now(shanghai_tz)
    card.updated_times = (card.updated_times or 0) + 1
    
    await db.commit()
    
    # 刷新卡片以加载更新后的关联关系
    await db.refresh(card, ["evidences"])
    
    # 按序号排序证据
    if card.evidences:
        evidence_with_seq = []
        for evidence in card.evidences:
            # 查询该证据在关联表中的序号
            seq_result = await db.execute(
                select(evidence_card_evidence_association.c.sequence_number)
                .where(
                    evidence_card_evidence_association.c.evidence_card_id == card_id,
                    evidence_card_evidence_association.c.evidence_id == evidence.id
                )
            )
            sequence_number = seq_result.scalar_one_or_none() or 0
            evidence_with_seq.append((sequence_number, evidence))
        
        # 按序号排序
        evidence_with_seq.sort(key=lambda x: x[0])
        card.evidences = [ev for _, ev in evidence_with_seq]
    
    return card


async def get_cards_with_evidence_ids_sorted(
    db: AsyncSession,
    cards: List[EvidenceCard]
) -> List[tuple[EvidenceCard, List[int]]]:
    """获取卡片列表及其按序号排序的证据ID列表
    
    Args:
        db: 数据库会话
        cards: 卡片列表
        
    Returns:
        List[tuple[EvidenceCard, List[int]]]: 卡片及其按序号排序的证据ID列表
    """
    result = []
    for card in cards:
        evidence_ids = await get_card_evidence_ids_sorted(db, card.id)
        result.append((card, evidence_ids))
    
    return result


async def get_cards_with_count(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 100,
    case_id: Optional[int] = None,
    evidence_ids: Optional[List[int]] = None,
    card_type: Optional[str] = None,
    card_is_associated: Optional[bool] = None,
    sort_by: Optional[str] = None,
    sort_order: Optional[str] = "desc"
) -> tuple[List[EvidenceCard], int]:
    """获取多个证据卡片，并返回总数，支持筛选和排序"""
    from sqlalchemy.orm import selectinload
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import cast, Text, and_
    from app.evidences.models import evidence_card_evidence_association
    
    query = select(EvidenceCard).options(selectinload(EvidenceCard.evidences))
    
    # 筛选条件
    conditions = []
    
    # 根据案件ID筛选（需要通过关联的证据来筛选）
    if case_id is not None:
        query = query.join(
            evidence_card_evidence_association,
            EvidenceCard.id == evidence_card_evidence_association.c.evidence_card_id
        ).join(
            Evidence,
            evidence_card_evidence_association.c.evidence_id == Evidence.id
        ).where(Evidence.case_id == case_id)
    
    # 根据证据ID筛选
    if evidence_ids:
        query = query.join(
            evidence_card_evidence_association,
            EvidenceCard.id == evidence_card_evidence_association.c.evidence_card_id
        ).where(
            evidence_card_evidence_association.c.evidence_id.in_(evidence_ids)
        )
    
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
                    required_slots.append(EvidenceCardSlot(
                        slot_name=slot_config.get('slot_name'),
                        need_proofreading=slot_config.get('need_proofreading', False)
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
) -> Dict[str, Optional[int]]:
    """
    获取某个案件、某个模板的槽位快照
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        
    Returns:
        Dict[str, Optional[int]]: 槽位ID到卡片ID的映射
    """
    return await EvidenceCardSlotAssignment.get_snapshot(db, case_id, template_id)


async def update_slot_assignment(
    db: AsyncSession,
    case_id: int,
    template_id: str,
    slot_id: str,
    card_id: Optional[int],
) -> EvidenceCardSlotAssignment:
    """
    更新或创建槽位关联
    
    Args:
        db: 数据库会话
        case_id: 案件ID
        template_id: 模板ID
        slot_id: 槽位ID
        card_id: 卡片ID（None表示移除关联）
        
    Returns:
        EvidenceCardSlotAssignment: 更新或创建的关联记录
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