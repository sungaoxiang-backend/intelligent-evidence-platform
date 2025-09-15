import os
from typing import BinaryIO, Dict, List, Optional, Union, Callable, Awaitable, Any
from datetime import datetime
from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime
from app.agentic.agents.evidence_classifier_v2 import EvidenceClassifier, EvidenceClassifiResults
from app.agentic.agents.evidence_extractor_v2 import EvidenceFeaturesExtractor, EvidenceExtractionResults, EvidenceImage


from loguru import logger
from agno.media import Image
from agno.run.response import RunResponse
from app.evidences.models import Evidence, EvidenceStatus
from app.cases.models import Case
from app.evidences.schemas import (
    EvidenceEditRequest, 
    UploadFileResponse
)
from app.integrations.cos import cos_service
from app.agentic.agents.evidence_proofreader import evidence_proofreader
from app.cases.models import Case


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
    
    # 只支持图片格式
    supported_image_formats = ["jpg", "jpeg", "png", "bmp", "webp"]
    if file_extension not in supported_image_formats:
        logger.error(f"不支持的文件格式: {file_extension}, 支持格式: {supported_image_formats}")
        raise ValueError(f"不支持的文件格式: {file_extension}，仅支持图片格式: {', '.join(supported_image_formats)}")
    
    # 所有文件都存储到images文件夹
    folder = "images"
    
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

    if not evidences:
        logger.error("没有成功上传或检索到证据")
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


