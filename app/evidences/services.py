import os
from typing import BinaryIO, Dict, List, Optional, Union, Callable, Awaitable
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
from app.evidences.schemas import (
    EvidenceEditRequest, 
    UploadFileResponse
)
from app.integrations.cos import cos_service


async def get_by_id(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据"""
    return await db.get(Evidence, evidence_id)

async def get_multi_by_ids(db: AsyncSession, evidence_ids: List[int]) -> List[Evidence]:
    """根据ID列表获取证据"""
    result = await db.execute(select(Evidence).where(Evidence.id.in_(evidence_ids)))
    return result.scalars().all()

async def get_by_id_with_case(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据，包含案件信息"""
    result = await db.execute(
        select(Evidence).where(Evidence.id == evidence_id).options(joinedload(Evidence.case))
    )
    return result.scalars().first()


async def upload_file(
    file: BinaryIO, filename: str, disposition: str = 'inline'
) -> UploadFileResponse:
    """上传文件到COS"""
    from loguru import logger
    
    logger.debug(f"开始上传文件: {filename}")
    
    # 获取文件扩展名
    _, file_extension = os.path.splitext(filename)
    file_extension = file_extension.lower().lstrip(".")
    logger.debug(f"文件扩展名: {file_extension}")
    
    # 根据文件扩展名确定存储文件夹
    if file_extension in ["pdf", "doc", "docx", "txt", "xls", "xlsx"]:
        folder = "documents"
    elif file_extension in ["jpg", "jpeg", "png", "gif", "bmp"]:
        folder = "images"
    elif file_extension in ["mp3", "wav", "ogg", "flac"]:
        folder = "audios"
    elif file_extension in ["mp4", "avi", "mov", "wmv"]:
        folder = "videos"
    else:
        folder = "others"
    logger.debug(f"存储文件夹: {folder}")
    
    # 获取文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    logger.debug(f"文件大小: {file_size} 字节")
    
    try:
        # 检查文件内容是否为空
        first_bytes = file.read(10)
        file.seek(0)
        if not first_bytes:
            logger.error(f"文件内容为空: {filename}")
            raise ValueError("文件内容为空")
        
        # 上传文件到COS
        logger.debug(f"开始上传文件到COS: {filename}, disposition={disposition}")
        file_url = cos_service.upload_file(file, filename, folder, disposition)
        logger.debug(f"文件上传成功: {filename}, URL: {file_url}")
        
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
    await db.refresh(db_obj)
    return db_obj


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
    
    # 添加调试日志
    logger.debug(f"Evidence sorting parameters: sort_by={sort_by}, sort_order={sort_order}")
    
    query = select(Evidence).options(joinedload(Evidence.case))
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
                logger.debug(f"Applying DESC sort on {sort_by}")
                query = query.order_by(sort_column.desc())
            else:
                logger.debug(f"Applying ASC sort on {sort_by}")
                query = query.order_by(sort_column.asc())
        else:
            # 默认按创建时间倒序
            logger.debug("Invalid sort field, using default DESC sort on created_at")
            query = query.order_by(Evidence.created_at.desc())
    else:
        # 默认按创建时间倒序
        logger.debug("No sort field provided, using default DESC sort on created_at")
        query = query.order_by(Evidence.created_at.desc())

    # 获取数据
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    data = result.scalars().all()

    return data, total


async def get_multi_with_cases(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> list[Evidence]:
    """获取多个证据，包含案件信息"""
    query = select(Evidence).options(joinedload(Evidence.case)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_multi_with_cases_with_count(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
):
    """获取多个证据，包含案件信息，并返回总数"""
    query = select(Evidence).options(joinedload(Evidence.case))

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # 获取数据
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    data = result.scalars().all()

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
    
    logger.info(f"开始批量创建证据: 案件ID={case_id}, 文件数量={len(files)}")
    evidences = []
    
    for index, file in enumerate(files):
        try:
            logger.debug(f"处理第{index+1}个文件: {file.filename}, 大小: {file.size if hasattr(file, 'size') else '未知'}")
            
            # 上传单个文件
            file_data = await upload_file(file.file, file.filename)
            logger.debug(f"文件上传成功: {file.filename}, URL: {file_data.file_url}")
            
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
            logger.debug(f"证据对象创建成功: {file.filename}")
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
            logger.info(f"成功提交{len(evidences)}个证据到数据库")
            
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
    send_progress: Callable[[dict], Awaitable[None]] = None
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
            
        logger.info(f"成功完成{len(evidences)}个证据的上传和分类")
        
    except Exception as e:
        logger.error(f"分类失败，但证据已上传: {str(e)}")
        # 分类失败不影响证据上传，只是 is_classified 保持 False
    
    return evidences


async def auto_process(
    db: AsyncSession,
    case_id: int,
    files: List[UploadFile] = None,
    evidence_ids: List[int] = None,
    auto_classification: bool = False,
    auto_feature_extraction: bool = False,
    send_progress: Callable[[dict], Awaitable[None]] = None
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
            await send_progress({"status": "uploaded", "message": "文件已成功上传"})
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
                await send_progress({"status": "classifying", "message": "开始证据分类分析"})
            
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
                                logger.info(f"有效分类结果: {evidence.file_name} -> {res.evidence_type} (置信度: {res.confidence})")
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
                await send_progress({"status": "classified", "message": "证据分类完成"})
                
        except asyncio.TimeoutError:
            if send_progress:
                await send_progress({"status": "error", "message": "证据分类超时，请稍后重试"})
            raise Exception("证据分类超时")
        except Exception as e:
            if send_progress:
                await send_progress({"status": "error", "message": f"证据分类失败: {str(e)}"})
            raise

    # 3. 证据特征提取（可选，且只能在分类后）
    if auto_feature_extraction:
        try:
            if send_progress:
                await send_progress({"status": "extracting", "message": "开始证据特征分析"})
            
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
                    await send_progress({"status": "ocr_processing", "message": f"开始OCR处理 {len(ocr_evidences)} 个证据"})
                
                from app.utils.xunfei_ocr import XunfeiOcrService
                ocr_service = XunfeiOcrService()
                
                for evidence in ocr_evidences:
                    try:
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
                                await send_progress({
                                    "status": "ocr_success", 
                                    "message": f"OCR处理成功: {evidence.file_name}",
                                    "evidence_id": evidence.id
                                })
                        else:
                            # OCR处理失败，记录错误
                            error_msg = ocr_result.get("error", "OCR处理失败")
                            logger.warning(f"OCR处理失败 {evidence.file_name}: {error_msg}")
                            
                            if send_progress:
                                await send_progress({
                                    "status": "ocr_error", 
                                    "message": f"OCR处理失败: {evidence.file_name} - {error_msg}",
                                    "evidence_id": evidence.id
                                })
                                
                    except Exception as e:
                        logger.error(f"OCR处理异常 {evidence.file_name}: {str(e)}")
                        if send_progress:
                            await send_progress({
                                "status": "ocr_error", 
                                "message": f"OCR处理异常: {evidence.file_name} - {str(e)}",
                                "evidence_id": evidence.id
                            })
            
            # 处理需要LLM处理的证据类型
            if llm_evidences:
                if send_progress:
                    await send_progress({"status": "llm_processing", "message": f"开始LLM处理 {len(llm_evidences)} 个证据"})
                
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
                run_response: RunResponse = await asyncio.wait_for(
                    extractor.arun(images),
                    timeout=180.0
                )
                
                evidence_extraction_results: EvidenceExtractionResults = run_response.content
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
                    await send_progress({"status": "features_extracted", "message": "证据特征分析完成"})
                
        except asyncio.TimeoutError:
            if send_progress:
                await send_progress({"status": "error", "message": "证据特征分析超时，请稍后重试"})
            raise Exception("证据特征分析超时")
        except Exception as e:
            if send_progress:
                await send_progress({"status": "error", "message": f"证据特征分析失败: {str(e)}"})
            raise
        
        
    # 4. 发送完成状态
    if send_progress:
        logger.info(f"发送完成状态: 成功处理 {len(evidences)} 个证据")
        await send_progress({"status": "completed", "message": f"成功处理 {len(evidences)} 个证据"})
    
    # 5. 返回证据列表
    logger.info(f"auto_process函数完成，返回 {len(evidences)} 个证据")
    return evidences

        
