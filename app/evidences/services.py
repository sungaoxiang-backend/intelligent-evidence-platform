import os
from typing import BinaryIO, Dict, List, Optional, Union, Callable, Awaitable

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.evidences.models import Evidence
from app.evidences.schemas import (
    EvidenceCreate, 
    EvidenceUpdate, 
    FileUploadResponse
)
from app.integrations.cos import cos_service


async def get_by_id(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据"""
    return await db.get(Evidence, evidence_id)


async def get_by_id_with_case(db: AsyncSession, evidence_id: int) -> Optional[Evidence]:
    """根据ID获取证据，包含案件信息"""
    result = await db.execute(
        select(Evidence).where(Evidence.id == evidence_id).options(joinedload(Evidence.case))
    )
    return result.scalars().first()


async def upload_file(
    file: BinaryIO, filename: str, disposition: str = 'inline'
) -> FileUploadResponse:
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
        
        return FileUploadResponse(
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


async def update(db: AsyncSession, db_obj: Evidence, obj_in: EvidenceUpdate) -> Evidence:
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
    db: AsyncSession, *, skip: int = 0, limit: int = 100, case_id: Optional[int] = None, search: Optional[str] = None
) -> (List[Evidence], int):
    """获取多个证据，并返回总数"""
    query = select(Evidence).options(joinedload(Evidence.case))
    if case_id is not None:
        query = query.where(Evidence.case_id == case_id)
    if search:
        query = query.where(Evidence.file_name.ilike(f"%{search}%"))

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

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
) -> (list[Evidence], int):
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
    
    # 批量删除COS文件
    if object_keys:
        for object_key in object_keys:
            cos_service.delete_file(object_key)
    
    # 提交数据库事务
    await db.commit()
    
    return {"successful": successful, "failed": failed}


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
