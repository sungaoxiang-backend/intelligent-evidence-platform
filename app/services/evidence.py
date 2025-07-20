import os
from typing import BinaryIO, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.evidence import Evidence, EvidenceType
from app.schemas.evidence import EvidenceCreate, EvidenceUpdate, FileUploadResponse
from app.utils.cos import cos_service


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
    file: BinaryIO, filename: str, staff_id: int
) -> FileUploadResponse:
    """上传文件到COS"""
    # 获取文件扩展名
    _, file_extension = os.path.splitext(filename)
    file_extension = file_extension.lower().lstrip(".")
    
    # 确定文件类型
    evidence_type = EvidenceType.OTHER
    if file_extension in ["pdf", "doc", "docx", "txt", "xls", "xlsx"]:
        evidence_type = EvidenceType.DOCUMENT
        folder = "documents"
    elif file_extension in ["jpg", "jpeg", "png", "gif", "bmp"]:
        evidence_type = EvidenceType.IMAGE
        folder = "images"
    elif file_extension in ["mp3", "wav", "ogg", "flac"]:
        evidence_type = EvidenceType.AUDIO
        folder = "audios"
    elif file_extension in ["mp4", "avi", "mov", "wmv"]:
        evidence_type = EvidenceType.VIDEO
        folder = "videos"
    else:
        folder = "others"
    
    # 获取文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    # 上传文件到COS
    file_url = cos_service.upload_file(file, filename, folder)
    
    return FileUploadResponse(
        file_url=file_url,
        file_name=filename,
        file_size=file_size,
        file_extension=file_extension,
    )


async def create(
    db: AsyncSession,
    obj_in: EvidenceCreate,
    file_data: FileUploadResponse,
    staff_id: int,
) -> Evidence:
    """创建新证据"""
    db_obj = Evidence(
        title=obj_in.title,
        description=obj_in.description,
        evidence_type=obj_in.evidence_type or EvidenceType.OTHER,
        file_url=file_data.file_url,
        file_name=file_data.file_name,
        file_size=file_data.file_size,
        file_extension=file_data.file_extension,
        tags=obj_in.tags,
        case_id=obj_in.case_id,
        uploaded_by_id=staff_id,
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


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


async def get_multi(
    db: AsyncSession, *, skip: int = 0, limit: int = 100, case_id: Optional[int] = None
) -> list[Evidence]:
    """获取多个证据"""
    query = select(Evidence)
    if case_id is not None:
        query = query.where(Evidence.case_id == case_id)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_multi_with_cases(
    db: AsyncSession, *, skip: int = 0, limit: int = 100
) -> list[Evidence]:
    """获取多个证据，包含案件信息"""
    query = select(Evidence).options(joinedload(Evidence.case)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()