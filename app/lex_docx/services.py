"""
模板服务层
提供模板的创建、更新、查询、删除等核心功能
"""
import logging
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

from docxtpl import DocxTemplate
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.integrations.cos import cos_service
from app.lex_docx.models import DocumentGeneration, DocumentTemplate, TemplateStatus
from app.lex_docx.schemas import (
    DocumentGenerationCreate,
    DocumentTemplateCreate,
    DocumentTemplateUpdate,
    GenerationListQuery,
    PlaceholderMetadata,
    TemplateListQuery,
)
from app.lex_docx.utils import (
    docx_bytes_to_html,
    extract_placeholders,
    html_to_docx,
    parse_placeholder_metadata,
    update_docx_content_from_html,
    validate_template_content,
)

logger = logging.getLogger(__name__)

# 模板文件存储目录
TEMPLATE_DIR = Path("templates/document-templates")
TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)


def get_template_file_path(template_id: int) -> Path:
    """获取模板文件路径"""
    return TEMPLATE_DIR / f"{template_id}.docx"


async def create_template(
    db: AsyncSession,
    obj_in: DocumentTemplateCreate,
    created_by: int,
) -> DocumentTemplate:
    """
    创建模板
    
    Args:
        db: 数据库会话
        obj_in: 模板创建数据
        created_by: 创建人ID
        
    Returns:
        创建的模板对象
        
    Raises:
        HTTPException: 如果验证失败或创建失败
    """
    # 验证模板内容
    if obj_in.content_html:
        is_valid, error = validate_template_content(obj_in.content_html)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模板内容验证失败: {error}",
            )
    
    # 解析占位符元数据
    placeholder_metadata = None
    if obj_in.content_html:
        # 将输入的 placeholder_metadata 转换为 PlaceholderMetadata 对象
        existing_metadata = None
        if obj_in.placeholder_metadata:
            existing_metadata = {
                k: v if isinstance(v, PlaceholderMetadata) else PlaceholderMetadata(**v)
                for k, v in obj_in.placeholder_metadata.items()
            }
        
        placeholder_metadata = parse_placeholder_metadata(
            obj_in.content_html,
            existing_metadata,
        )
        # 转换为字典格式（用于JSONB存储）
        if placeholder_metadata:
            placeholder_metadata = {
                k: v.model_dump() for k, v in placeholder_metadata.items()
            }
    
    # 创建模板对象
    create_data = obj_in.model_dump(exclude_unset=True, exclude={"placeholder_metadata"})
    create_data["placeholder_metadata"] = placeholder_metadata
    create_data["created_by"] = created_by
    create_data["updated_by"] = created_by
    create_data["status"] = TemplateStatus.DRAFT
    
    db_obj = DocumentTemplate(**create_data)
    db.add(db_obj)
    await db.flush()  # 获取模板ID
    
    # 将 HTML 转换为 DOCX 并保存到文件系统
    if obj_in.content_html:
        try:
            docx_bytes = html_to_docx(obj_in.content_html)
            file_path = get_template_file_path(db_obj.id)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(docx_bytes)
            db_obj.content_path = str(file_path)
        except Exception as e:
            logger.error(f"保存模板文件失败: {e}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"保存模板文件失败: {str(e)}",
            )
    
    await db.commit()
    await db.refresh(db_obj)
    
    return db_obj


async def get_template_by_id(
    db: AsyncSession,
    template_id: int,
) -> Optional[DocumentTemplate]:
    """
    根据ID获取模板
    
    Args:
        db: 数据库会话
        template_id: 模板ID
        
    Returns:
        模板对象，如果不存在则返回None
    """
    # 使用 selectinload 预加载关联关系，避免 N+1 查询问题
    query = select(DocumentTemplate).options(
        selectinload(DocumentTemplate.creator),
        selectinload(DocumentTemplate.updater),
    ).where(DocumentTemplate.id == template_id)
    result = await db.execute(query)
    return result.scalars().first()


async def update_template(
    db: AsyncSession,
    db_obj: DocumentTemplate,
    obj_in: DocumentTemplateUpdate,
    updated_by: int,
) -> DocumentTemplate:
    """
    更新模板
    
    Args:
        db: 数据库会话
        db_obj: 现有模板对象
        obj_in: 更新数据
        updated_by: 更新人ID
        
    Returns:
        更新后的模板对象
        
    Raises:
        HTTPException: 如果验证失败或更新失败
    """
    # 如果模板已发布，不允许修改内容
    if db_obj.status == TemplateStatus.PUBLISHED:
        if obj_in.content_html is not None or obj_in.placeholder_metadata is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="已发布的模板不允许修改内容和占位符元数据",
            )
    
    # 验证模板内容
    content_html = obj_in.content_html if obj_in.content_html is not None else db_obj.content_html
    if content_html:
        is_valid, error = validate_template_content(content_html)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模板内容验证失败: {error}",
            )
    
    # 更新数据
    update_data = obj_in.model_dump(exclude_unset=True, exclude={"placeholder_metadata"})
    update_data["updated_by"] = updated_by
    
    # 处理占位符元数据
    if obj_in.content_html is not None:
        # 如果更新了内容，重新解析占位符元数据
        existing_metadata_dict = db_obj.placeholder_metadata or {}
        # 将字典转换为 PlaceholderMetadata 对象
        existing_metadata = {
            k: PlaceholderMetadata(**v) if isinstance(v, dict) else v
            for k, v in existing_metadata_dict.items()
        }
        
        # 如果提供了新的元数据，合并进去
        if obj_in.placeholder_metadata:
            for k, v in obj_in.placeholder_metadata.items():
                if isinstance(v, dict):
                    existing_metadata[k] = PlaceholderMetadata(**v)
                elif isinstance(v, PlaceholderMetadata):
                    existing_metadata[k] = v
        
        # 重要：保存时，同时更新HTML和DOCX文件
        # 编辑时，从DOCX重新生成HTML（包含格式）
        # 保存时，更新数据库HTML + 更新DOCX文件（保留格式）
        # 预览时，使用数据库中的HTML
        
        # 更新数据库中的HTML
        update_data["content_html"] = obj_in.content_html
        logger.info(f"模板 {db_obj.id} 保存时更新HTML内容")
        
        # 从编辑后的HTML重新解析占位符元数据
        placeholder_metadata = parse_placeholder_metadata(
            obj_in.content_html,
            existing_metadata,
        )
        # 转换为字典格式
        if placeholder_metadata:
            placeholder_metadata = {
                k: v.model_dump() for k, v in placeholder_metadata.items()
            }
        update_data["placeholder_metadata"] = placeholder_metadata
        
        # 同时更新DOCX文件（保留格式）
        if db_obj.content_path:
            from pathlib import Path
            from app.lex_docx.utils import update_docx_content_from_html
            
            file_path = Path(db_obj.content_path)
            if file_path.exists():
                try:
                    # 读取现有DOCX文件
                    docx_bytes = file_path.read_bytes()
                    # 使用update_docx_content_from_html更新内容（保留格式）
                    updated_docx_bytes = update_docx_content_from_html(
                        docx_bytes,
                        obj_in.content_html
                    )
                    # 保存更新后的DOCX文件
                    file_path.write_bytes(updated_docx_bytes)
                    logger.info(f"模板 {db_obj.id} 已更新DOCX文件（保留格式）")
                except Exception as e:
                            logger.error(f"模板 {db_obj.id} 更新DOCX文件失败: {e}")
                            import traceback
                            logger.error(traceback.format_exc())
                            # 不抛出异常，至少HTML已经保存了
            else:
                logger.warning(f"模板 {db_obj.id} 的DOCX文件不存在: {file_path}")
        else:
            logger.warning(f"模板 {db_obj.id} 没有DOCX文件路径，无法更新DOCX文件")
    elif obj_in.placeholder_metadata is not None:
        # 如果只更新了元数据，直接使用新值
        placeholder_metadata = obj_in.placeholder_metadata
        if placeholder_metadata:
            placeholder_metadata = {
                k: (
                    v.model_dump()
                    if isinstance(v, PlaceholderMetadata)
                    else PlaceholderMetadata(**v).model_dump()
                    if isinstance(v, dict)
                    else v
                )
                for k, v in placeholder_metadata.items()
            }
        update_data["placeholder_metadata"] = placeholder_metadata
    
    # 更新字段
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    
    return db_obj


async def list_templates(
    db: AsyncSession,
    query_params: TemplateListQuery,
) -> Tuple[List[DocumentTemplate], int]:
    """
    获取模板列表（支持搜索、筛选、分页）
    
    Args:
        db: 数据库会话
        query_params: 查询参数
        
    Returns:
        (模板列表, 总数)
    """
    # 构建基础查询
    query = select(DocumentTemplate)
    count_query = select(func.count()).select_from(DocumentTemplate)
    
    # 应用筛选条件
    conditions = []
    
    if query_params.status:
        conditions.append(DocumentTemplate.status == query_params.status)
    
    if query_params.category:
        conditions.append(DocumentTemplate.category == query_params.category)
    
    if query_params.search:
        search_pattern = f"%{query_params.search}%"
        conditions.append(DocumentTemplate.name.ilike(search_pattern))
    
    if conditions:
        for condition in conditions:
            query = query.where(condition)
            count_query = count_query.where(condition)
    
    # 获取总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    
    # 应用排序（默认按创建时间倒序）
    query = query.order_by(DocumentTemplate.created_at.desc())
    
    # 应用分页
    query = query.offset(query_params.skip).limit(query_params.limit)
    
    # 执行查询
    result = await db.execute(query)
    templates = list(result.scalars().all())
    
    return templates, total


async def delete_template(
    db: AsyncSession,
    template_id: int,
) -> bool:
    """
    删除模板
    
    Args:
        db: 数据库会话
        template_id: 模板ID
        
    Returns:
        是否删除成功
        
    Raises:
        HTTPException: 如果模板不存在或删除失败
    """
    template = await get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )
    
    # 删除模板文件
    if template.content_path:
        file_path = Path(template.content_path)
        if file_path.exists():
            try:
                file_path.unlink()
                logger.info(f"已删除模板文件: {template.content_path}")
            except Exception as e:
                logger.warning(f"删除模板文件失败: {e}")
    
    # 删除数据库记录
    # 注意：关联的生成记录不会被删除，template_id 会被设置为 NULL（通过外键约束 SET NULL）
    # 这样生成记录作为快照保留，可以继续访问，即使模板已删除
    await db.delete(template)
    await db.commit()
    
    logger.info(f"已删除模板: ID={template_id}, name={template.name}, status={template.status}")
    return True


async def batch_update_template_status(
    db: AsyncSession,
    template_ids: List[int],
    new_status: str,
    updated_by: int,
) -> int:
    """
    批量更新模板状态
    
    Args:
        db: 数据库会话
        template_ids: 模板ID列表
        new_status: 新状态（draft 或 published）
        updated_by: 更新人ID
        
    Returns:
        成功更新的数量
        
    Raises:
        HTTPException: 如果验证失败
    """
    if not template_ids:
        return 0
    
    # 验证状态值
    if new_status not in [TemplateStatus.DRAFT, TemplateStatus.PUBLISHED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的状态值: {new_status}",
        )
    
    # 获取所有模板
    query = select(DocumentTemplate).where(DocumentTemplate.id.in_(template_ids))
    result = await db.execute(query)
    templates = list(result.scalars().all())
    
    if len(templates) != len(template_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分模板不存在",
        )
    
    updated_count = 0
    for template in templates:
        # 如果状态没有变化，跳过
        if template.status == new_status:
            continue
        
        # 从草稿切换到已发布时的验证
        if template.status == TemplateStatus.DRAFT and new_status == TemplateStatus.PUBLISHED:
            # 验证模板至少包含一个占位符
            if not template.content_html:
                logger.warning(f"模板 {template.id} 内容为空，跳过发布")
                continue
            
            # 提取占位符
            placeholders = extract_placeholders(template.content_html)
            if not placeholders:
                logger.warning(f"模板 {template.id} 没有占位符，跳过发布")
                continue
            
            # 验证占位符元数据是否存在
            if not template.placeholder_metadata:
                logger.warning(f"模板 {template.id} 占位符元数据未配置，跳过发布")
                continue
        
        # 更新状态
        template.status = new_status
        template.updated_by = updated_by
        updated_count += 1
    
    await db.commit()
    
    return updated_count


async def batch_delete_templates(
    db: AsyncSession,
    template_ids: List[int],
) -> int:
    """
    批量删除模板
    
    Args:
        db: 数据库会话
        template_ids: 模板ID列表
        
    Returns:
        成功删除的数量
        
    Raises:
        HTTPException: 如果验证失败
    """
    if not template_ids:
        return 0
    
    # 获取所有模板
    query = select(DocumentTemplate).where(DocumentTemplate.id.in_(template_ids))
    result = await db.execute(query)
    templates = list(result.scalars().all())
    
    if len(templates) != len(template_ids):
        found_ids = {t.id for t in templates}
        missing_ids = set(template_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"部分模板不存在: {missing_ids}",
        )
    
    deleted_count = 0
    for template in templates:
        # 删除模板文件
        if template.content_path:
            file_path = Path(template.content_path)
            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.info(f"已删除模板文件: {template.content_path}")
                except Exception as e:
                    logger.warning(f"删除模板文件失败: {e}")
        
        # 删除数据库记录
        # 注意：关联的生成记录不会被删除，template_id 会被设置为 NULL（通过外键约束 SET NULL）
        # 这样生成记录作为快照保留，可以继续访问，即使模板已删除
        try:
            await db.delete(template)
            deleted_count += 1
            logger.info(f"已标记删除模板: ID={template.id}, name={template.name}, status={template.status}（关联的生成记录将保留，template_id 设置为 NULL）")
        except Exception as e:
            logger.error(f"删除模板失败: ID={template.id}, error={e}")
            raise
    
    # 提交所有删除操作
    try:
        await db.commit()
        logger.info(f"批量删除提交成功: 删除了 {deleted_count} 个模板")
    except Exception as e:
        logger.error(f"批量删除提交失败: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除提交失败: {str(e)}",
        )
    
    return deleted_count


async def update_template_status(
    db: AsyncSession,
    template_id: int,
    new_status: str,
    updated_by: int,
    is_superuser: bool = False,
) -> DocumentTemplate:
    """
    更新模板状态
    
    Args:
        db: 数据库会话
        template_id: 模板ID
        new_status: 新状态（draft 或 published）
        updated_by: 更新人ID
        is_superuser: 是否为超级管理员
        
    Returns:
        更新后的模板对象
        
    Raises:
        HTTPException: 如果验证失败或更新失败
    """
    # 模板管理不需要复杂权限，所有登录用户都可以切换状态
    # 权限检查已移除
    
    # 获取模板
    template = await get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )
    
    # 验证状态值
    if new_status not in [TemplateStatus.DRAFT, TemplateStatus.PUBLISHED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的状态值: {new_status}",
        )
    
    # 如果状态没有变化，直接返回
    if template.status == new_status:
        return template
    
    # 从草稿切换到已发布时的验证
    if template.status == TemplateStatus.DRAFT and new_status == TemplateStatus.PUBLISHED:
        # 验证模板至少包含一个占位符
        if not template.content_html:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模板内容为空，无法发布",
            )
        
        # 提取占位符
        placeholders = extract_placeholders(template.content_html)
        if not placeholders:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模板至少需要包含一个占位符才能发布",
            )
        
        # 验证占位符元数据是否存在
        if not template.placeholder_metadata:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模板占位符元数据未配置，无法发布",
            )
    
    # 从已发布切换为草稿时的提示（在路由层处理，这里只记录日志）
    if template.status == TemplateStatus.PUBLISHED and new_status == TemplateStatus.DRAFT:
        logger.warning(
            f"模板 {template_id} 从已发布状态切换为草稿，"
            f"可能影响正在使用该模板的生成任务"
        )
    
    # 更新状态
    template.status = new_status
    template.updated_by = updated_by
    
    db.add(template)
    await db.commit()
    await db.refresh(template)
    
    return template


async def import_template(
    db: AsyncSession,
    file: UploadFile,
    created_by: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    category: Optional[str] = None,
) -> DocumentTemplate:
    """
    导入模板（从 DOCX 文件）
    
    Args:
        db: 数据库会话
        file: 上传的 DOCX 文件
        created_by: 创建人ID
        name: 模板名称（可选，如果不提供则使用文件名）
        description: 模板描述（可选）
        category: 模板分类（可选）
        
    Returns:
        创建的模板对象（草稿状态）
        
    Raises:
        HTTPException: 如果验证失败或导入失败
    """
    # 验证文件类型
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件名为空",
        )
    
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ['.docx']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只支持 DOCX 格式的文件",
        )
    
    # 验证文件大小（限制为 10MB）
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）",
        )
    
    # 重置文件指针（如果需要再次读取）
    await file.seek(0)
    
    # 保存原始文件内容的副本（用于后续保存DOCX文件）
    original_docx_bytes = file_content
    
    try:
        # 将 DOCX 转换为 HTML（用于提取内容和占位符）
        html_content = docx_bytes_to_html(file_content)
        
        # 提取占位符
        placeholders = extract_placeholders(html_content)
        
        # 解析占位符元数据（创建默认配置）
        placeholder_metadata_dict = parse_placeholder_metadata(html_content)
        # 转换为字典格式（用于JSONB存储）
        placeholder_metadata_for_create = None
        if placeholder_metadata_dict:
            placeholder_metadata_for_create = {
                k: v.model_dump() if hasattr(v, 'model_dump') else v
                for k, v in placeholder_metadata_dict.items()
            }
        
        # 使用文件名作为模板名称（如果没有提供）
        template_name = name.strip() if name and name.strip() else Path(file.filename).stem
        
        # 处理 description 和 category：如果是空字符串，转换为 None
        template_description = description.strip() if description and description.strip() else None
        template_category = category.strip() if category and category.strip() else None
        
        # 创建模板
        template_create = DocumentTemplateCreate(
            name=template_name,
            description=template_description,
            category=template_category,
            content_html=html_content,
            placeholder_metadata=placeholder_metadata_for_create,  # type: ignore
        )
        
        # 调用创建模板方法（先创建数据库记录以获取ID）
        template = await create_template(
            db=db,
            obj_in=template_create,
            created_by=created_by,
        )
        
        # 重要：直接保存原始DOCX文件，而不是从HTML转换
        # 这样可以保留所有格式信息
        try:
            file_path = get_template_file_path(template.id)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            # 直接保存原始DOCX文件内容
            file_path.write_bytes(original_docx_bytes)
            template.content_path = str(file_path)
            await db.commit()
            await db.refresh(template)
            logger.info(f"模板 {template.id} 已保存原始DOCX文件（保留格式）")
        except Exception as e:
            logger.error(f"保存原始DOCX文件失败: {e}")
            # 如果失败，回退到从HTML生成（会丢失格式，但至少能保存）
            try:
                docx_bytes = html_to_docx(html_content)
                file_path = get_template_file_path(template.id)
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_bytes(docx_bytes)
                template.content_path = str(file_path)
                await db.commit()
                await db.refresh(template)
                logger.warning(f"模板 {template.id} 回退到从HTML生成DOCX（格式可能丢失）")
            except Exception as e2:
                logger.error(f"回退方案也失败: {e2}")
                # 不抛出异常，至少HTML已经保存了
        
        logger.info(f"模板导入成功: ID={template.id}, 名称={template_name}, 占位符数量={len(placeholders)}")
        
        return template
        
    except Exception as e:
        logger.error(f"模板导入失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模板导入失败: {str(e)}",
        )


async def export_template(
    db: AsyncSession,
    template_id: int,
) -> bytes:
    """
    导出模板（返回 DOCX 文件字节数据）
    
    Args:
        db: 数据库会话
        template_id: 模板ID
        
    Returns:
        DOCX 文件的字节数据
        
    Raises:
        HTTPException: 如果模板不存在或导出失败
    """
    template = await get_template_by_id(db, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )
    
    # 如果模板有文件路径，直接读取文件
    if template.content_path:
        file_path = Path(template.content_path)
        if file_path.exists():
            try:
                return file_path.read_bytes()
            except Exception as e:
                logger.error(f"读取模板文件失败: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"读取模板文件失败: {str(e)}",
                )
    
    # 如果没有文件，从 HTML 生成 DOCX
    if template.content_html:
        try:
            return html_to_docx(template.content_html)
        except Exception as e:
            logger.error(f"生成 DOCX 文件失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"生成 DOCX 文件失败: {str(e)}",
            )
    
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="模板没有可导出的内容",
    )


async def generate_document(
    db: AsyncSession,
    obj_in: DocumentGenerationCreate,
    generated_by: int,
) -> DocumentGeneration:
    """
    生成文档
    
    Args:
        db: 数据库会话
        obj_in: 文档生成请求数据
        generated_by: 生成人ID
        
    Returns:
        文档生成记录对象
        
    Raises:
        HTTPException: 如果验证失败或生成失败
    """
    # 获取模板
    template = await get_template_by_id(db, obj_in.template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )
    
    # 验证模板状态（只有已发布的模板可以生成文档）
    if template.status != TemplateStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能使用已发布的模板生成文档",
        )
    
    # 验证表单数据（检查必填字段）
    if template.placeholder_metadata:
        missing_fields = []
        for placeholder_name, metadata in template.placeholder_metadata.items():
            # metadata 可能是字典（从数据库读取）或 PlaceholderMetadata 对象
            if isinstance(metadata, dict):
                required = metadata.get("required", False)
                label = metadata.get("label", placeholder_name)
            else:
                # 如果是 PlaceholderMetadata 对象
                required = getattr(metadata, "required", False)
                label = getattr(metadata, "label", placeholder_name)
            
            if required:
                field_value = obj_in.form_data.get(placeholder_name)
                # 检查字段是否为空（None、空字符串、空列表等）
                if field_value is None or field_value == "" or (isinstance(field_value, list) and len(field_value) == 0):
                    missing_fields.append(label)
        
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"缺少必填字段: {', '.join(missing_fields)}",
            )
    
    # 获取模板文件路径
    if not template.content_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="模板文件不存在，无法生成文档",
        )
    
    template_file_path = Path(template.content_path)
    if not template_file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板文件不存在",
        )
    
    try:
        # 使用 docxtpl 渲染模板
        doc = DocxTemplate(template_file_path)
        
        # 准备渲染数据（将表单数据转换为模板变量）
        context = {}
        for key, value in obj_in.form_data.items():
            # 获取字段元数据（如果存在）
            metadata = None
            if template.placeholder_metadata:
                metadata_dict = template.placeholder_metadata.get(key)
                if metadata_dict:
                    # metadata_dict 可能是字典（从数据库读取）或 PlaceholderMetadata 对象
                    if isinstance(metadata_dict, dict):
                        from app.lex_docx.schemas import PlaceholderMetadata
                        try:
                            metadata = PlaceholderMetadata(**metadata_dict)
                        except Exception:
                            metadata = None
                    elif hasattr(metadata_dict, 'type'):
                        metadata = metadata_dict
            
            # 处理不同类型的值
            if isinstance(value, dict):
                context[key] = value
            elif isinstance(value, list):
                # 列表类型（通常是 multiselect）
                if metadata and metadata.type == 'multiselect' and metadata.options:
                    # 对于 multiselect 类型，提供格式化的字符串显示
                    # 格式：选项1☑ 选项2☐（选中的显示☑，未选中的显示☐）
                    selected_values = [str(v) for v in value] if value else []
                    
                    # 构建格式化的字符串：每个选项后跟选中状态
                    formatted_options = []
                    for option in metadata.options:
                        checkbox = "☑" if option in selected_values else "☐"
                        formatted_options.append(f"{option}{checkbox}")
                    context[key] = " ".join(formatted_options)
                    
                    # 同时提供每个选项的选中状态变量（供模板使用更复杂的格式）
                    for option in metadata.options:
                        context[f"{key}_{option}"] = "☑" if option in selected_values else "☐"
                    
                    # 提供选中的值列表（用逗号连接，兼容旧模板）
                    context[f"{key}_selected"] = "，".join(selected_values) if selected_values else ""
                else:
                    # 其他列表类型，转换为字符串（用逗号连接）
                    context[key] = "，".join(str(v) for v in value) if value else ""
            elif metadata and metadata.type == 'checkbox' and metadata.options:
                # 对于 checkbox/radio 类型，提供格式化的字符串显示
                # 格式：选项1☑ 选项2☐（选中的显示☑，未选中的显示☐）
                selected_value = str(value) if value is not None else ""
                
                # 构建格式化的字符串：每个选项后跟选中状态
                formatted_options = []
                for option in metadata.options:
                    checkbox = "☑" if option == selected_value else "☐"
                    formatted_options.append(f"{option}{checkbox}")
                context[key] = " ".join(formatted_options)
                
                # 同时提供每个选项的选中状态变量（供模板使用更复杂的格式）
                for option in metadata.options:
                    context[f"{key}_{option}"] = "☑" if option == selected_value else "☐"
                
                # 提供选中的值（兼容旧模板）
                context[f"{key}_selected"] = selected_value
            else:
                context[key] = str(value) if value is not None else ""
        
        # 渲染文档
        doc.render(context)
        
        # 将生成的文档保存到内存
        output_buffer = BytesIO()
        doc.save(output_buffer)
        output_buffer.seek(0)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{template.name}_{timestamp}.docx"
        
        # 上传到 COS
        file_url = cos_service.upload_file(
            file=output_buffer,
            filename=filename,
            folder="document-generations",
            disposition="attachment"
        )
        
        # 创建生成记录
        generation = DocumentGeneration(
            template_id=template.id,
            generated_by=generated_by,
            form_data=obj_in.form_data,
            document_url=file_url,
            document_filename=filename,
        )
        
        db.add(generation)
        await db.commit()
        await db.refresh(generation)
        
        logger.info(f"文档生成成功: ID={generation.id}, 模板ID={template.id}, 文件URL={file_url}")
        
        return generation
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文档生成失败: {e}")
        import traceback
        logger.error(f"错误详情: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文档生成失败: {str(e)}",
        )


async def get_generation_by_id(
    db: AsyncSession,
    generation_id: int,
) -> Optional[DocumentGeneration]:
    """
    根据ID获取生成记录
    
    Args:
        db: 数据库会话
        generation_id: 生成记录ID
        
    Returns:
        生成记录对象，如果不存在则返回None
    """
    query = select(DocumentGeneration).where(DocumentGeneration.id == generation_id)
    result = await db.execute(query)
    return result.scalars().first()


async def list_generations(
    db: AsyncSession,
    query_params: GenerationListQuery,
) -> Tuple[List[DocumentGeneration], int]:
    """
    获取生成记录列表（支持筛选、分页）
    
    Args:
        db: 数据库会话
        query_params: 查询参数
        
    Returns:
        (生成记录列表, 总数)
    """
    # 构建基础查询
    query = select(DocumentGeneration)
    count_query = select(func.count()).select_from(DocumentGeneration)
    
    # 应用筛选条件
    conditions = []
    
    if query_params.template_id:
        conditions.append(DocumentGeneration.template_id == query_params.template_id)
    
    if query_params.generated_by:
        conditions.append(DocumentGeneration.generated_by == query_params.generated_by)
    
    if query_params.start_date:
        conditions.append(DocumentGeneration.generated_at >= query_params.start_date)
    
    if query_params.end_date:
        conditions.append(DocumentGeneration.generated_at <= query_params.end_date)
    
    if conditions:
        for condition in conditions:
            query = query.where(condition)
            count_query = count_query.where(condition)
    
    # 获取总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    
    # 应用排序（默认按生成时间倒序）
    query = query.order_by(DocumentGeneration.generated_at.desc())
    
    # 应用分页
    query = query.offset(query_params.skip).limit(query_params.limit)
    
    # 执行查询
    result = await db.execute(query)
    generations = list(result.scalars().all())
    
    return generations, total

