"""
文档模板管理 API 路由
"""
from typing import Annotated, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from loguru import logger

from app.core.deps import DBSession, get_current_staff
from app.core.response import ListResponse, Pagination, SingleResponse
from app.lex_docx import services
from app.lex_docx.schemas import (
    BatchDeleteRequest,
    BatchUpdateStatusRequest,
    DocumentGenerationCreate,
    DocumentGenerationResponse,
    DocumentTemplateCreate,
    DocumentTemplateResponse,
    DocumentTemplateUpdate,
    GenerationListQuery,
    TemplateListQuery,
    TemplateStatusUpdate,
)
from app.staffs.models import Staff

router = APIRouter()


# ==================== 模板管理端点 ====================

@router.get("", response_model=ListResponse[DocumentTemplateResponse])
async def list_templates(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    search: Optional[str] = Query(None, description="搜索模板名称"),
    category: Optional[str] = Query(None, description="按分类筛选"),
    status_filter: Optional[str] = Query(None, alias="status", description="按状态筛选"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
):
    """获取模板列表（支持搜索、筛选、分页）"""
    try:
        from app.lex_docx.models import TemplateStatus
        
        query_params = TemplateListQuery(
            search=search,
            category=category,
            status=TemplateStatus(status_filter) if status_filter else None,
            skip=skip,
            limit=limit,
        )
        
        templates, total = await services.list_templates(db, query_params)
        
        # 转换为响应模型
        template_responses = [
            DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=template.content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            for template in templates
        ]
        
        return ListResponse(
            data=template_responses,
            pagination=Pagination(
                total=total,
                page=(skip // limit) + 1 if limit > 0 else 1,
                size=limit,
                pages=(total + limit - 1) // limit if limit > 0 else 1,
            ),
        )
    except Exception as e:
        logger.error(f"获取模板列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板列表失败: {str(e)}",
        )


@router.get("/published", response_model=ListResponse[DocumentTemplateResponse])
async def list_published_templates(
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
):
    """获取已发布的模板列表（用于生成页面）"""
    try:
        from app.lex_docx.models import TemplateStatus
        
        query_params = TemplateListQuery(
            status=TemplateStatus.PUBLISHED,
            skip=skip,
            limit=limit,
        )
        
        templates, total = await services.list_templates(db, query_params)
        
        # 转换为响应模型（不包含 HTML 内容）
        template_responses = [
            DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=None,  # 不返回 HTML 内容
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            for template in templates
        ]
        
        return ListResponse(
            data=template_responses,
            pagination=Pagination(
                total=total,
                page=(skip // limit) + 1 if limit > 0 else 1,
                size=limit,
                pages=(total + limit - 1) // limit if limit > 0 else 1,
            ),
        )
    except Exception as e:
        logger.error(f"获取已发布模板列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取已发布模板列表失败: {str(e)}",
        )


@router.get("/{template_id}", response_model=SingleResponse[DocumentTemplateResponse])
async def get_template(
    template_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
    for_editing: bool = Query(False, description="是否用于编辑（如果是，则从DOCX重新生成HTML以确保格式）"),
):
    """获取模板详情"""
    try:
        template = await services.get_template_by_id(db, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模板不存在",
            )
        
        # 如果用于编辑，优先使用数据库中的HTML（保留用户编辑）
        # 只有在数据库HTML无格式时，才从DOCX重新生成
        content_html = template.content_html
        if for_editing:
            # 首先检查数据库中的HTML是否包含格式
            db_has_table = '<table' in (template.content_html or '')
            db_has_style = 'style=' in (template.content_html or '')
            
            if db_has_table or db_has_style:
                # 数据库中的HTML包含格式，直接使用（保留用户编辑）
                logger.info(
                    f"模板 {template_id} 编辑时使用数据库中的HTML（包含格式，保留用户编辑）"
                )
                content_html = template.content_html
            elif template.content_path:
                # 数据库中的HTML无格式，尝试从DOCX重新生成
                from app.lex_docx.utils import docx_bytes_to_html
                from pathlib import Path
                
                file_path = Path(template.content_path)
                if file_path.exists():
                    try:
                        docx_bytes = file_path.read_bytes()
                        generated_html = docx_bytes_to_html(docx_bytes)
                        
                        # 检查生成的HTML是否包含格式
                        has_table = '<table' in generated_html
                        has_style = 'style=' in generated_html
                        
                        if has_table or has_style:
                            # DOCX文件正常，使用生成的HTML
                            content_html = generated_html
                            logger.info(
                                f"模板 {template_id} 编辑时从DOCX重新生成HTML（包含格式）"
                            )
                        else:
                            # DOCX文件也无格式，使用数据库中的HTML（即使无格式）
                            logger.warning(
                                f"模板 {template_id} DOCX和数据库HTML都无格式，"
                                f"使用数据库中的HTML"
                            )
                            content_html = template.content_html
                    except Exception as e:
                        logger.warning(
                            f"模板 {template_id} 从DOCX重新生成HTML失败，使用数据库中的HTML: {e}"
                        )
                        import traceback
                        logger.warning(traceback.format_exc())
                        # 如果失败，使用数据库中的HTML
                else:
                    logger.warning(f"模板 {template_id} 的DOCX文件不存在: {file_path}")
            else:
                # 没有DOCX文件，使用数据库中的HTML
                logger.info(f"模板 {template_id} 编辑时使用数据库中的HTML（无DOCX文件）")
            
            logger.info(f"最终返回的HTML长度: {len(content_html) if content_html else 0}")
            logger.info(f"最终返回的HTML包含表格: {'<table' in content_html if content_html else False}")
            logger.info(f"最终返回的HTML包含样式: {'style=' in content_html if content_html else False}")
            logger.info(f"最终返回的HTML前500字符: {content_html[:500] if content_html else ''}")
        else:
            logger.info(f"模板 {template_id} 获取HTML（非编辑模式），使用数据库中的HTML")
            logger.info(f"数据库HTML长度: {len(content_html) if content_html else 0}")
            logger.info(f"数据库HTML包含表格: {'<table' in content_html if content_html else False}")
            logger.info(f"数据库HTML包含样式: {'style=' in content_html if content_html else False}")
        
        return SingleResponse(
            data=DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模板详情失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板详情失败: {str(e)}",
        )


@router.post("", response_model=SingleResponse[DocumentTemplateResponse], status_code=status.HTTP_201_CREATED)
async def create_template(
    obj_in: DocumentTemplateCreate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """创建模板（需要认证）"""
    try:
        template = await services.create_template(
            db=db,
            obj_in=obj_in,
            created_by=current_staff.id,
        )
        
        return SingleResponse(
            data=DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=template.content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建模板失败: {str(e)}",
        )


@router.put("/{template_id}", response_model=SingleResponse[DocumentTemplateResponse])
async def update_template(
    template_id: int,
    obj_in: DocumentTemplateUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新模板（需要认证）"""
    try:
        template = await services.get_template_by_id(db, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模板不存在",
            )
        
        template = await services.update_template(
            db=db,
            db_obj=template,
            obj_in=obj_in,
            updated_by=current_staff.id,
        )
        
        return SingleResponse(
            data=DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=template.content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模板失败: {str(e)}",
        )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """删除模板（需要认证）"""
    try:
        await services.delete_template(db, template_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模板失败: {str(e)}",
        )


@router.put("/{template_id}/status", response_model=SingleResponse[DocumentTemplateResponse])
async def update_template_status(
    template_id: int,
    obj_in: TemplateStatusUpdate,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """更新模板状态"""
    try:
        template = await services.update_template_status(
            db=db,
            template_id=template_id,
            new_status=obj_in.status,
            updated_by=current_staff.id,
            is_superuser=True,  # 模板管理不需要复杂权限，所有登录用户都可以发布
        )
        
        return SingleResponse(
            data=DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=template.content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新模板状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模板状态失败: {str(e)}",
        )


@router.get("/{template_id}/preview")
async def preview_template(
    template_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """获取模板预览 HTML"""
    try:
        template = await services.get_template_by_id(db, template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模板不存在",
            )
        
        if not template.content_html:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="模板没有预览内容",
            )
        
        return Response(
            content=template.content_html,
            media_type="text/html",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模板预览失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板预览失败: {str(e)}",
        )


@router.post("/import", response_model=SingleResponse[DocumentTemplateResponse], status_code=status.HTTP_201_CREATED)
async def import_template(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    smart_import: bool = Form(False, description="是否启用智能导入（自动识别和配置占位符）"),
    db: DBSession = None,
    current_staff: Annotated[Staff, Depends(get_current_staff)] = None,
):
    """导入模板（文件上传）"""
    try:
        template = await services.import_template(
            db=db,
            file=file,
            created_by=current_staff.id,
            name=name,
            description=description,
            category=category,
            smart_import=smart_import,
        )
        
        return SingleResponse(
            data=DocumentTemplateResponse(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category,
                status=template.status,
                content_path=template.content_path,
                content_html=template.content_html,
                placeholder_metadata=template.placeholder_metadata,
                created_by=template.created_by,
                updated_by=template.updated_by,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入模板失败: {str(e)}",
        )


@router.get("/{template_id}/export")
async def export_template(
    template_id: int,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """导出模板（文件下载）"""
    try:
        docx_bytes = await services.export_template(db, template_id)
        
        # 获取模板名称用于文件名
        template = await services.get_template_by_id(db, template_id)
        filename = f"{template.name if template else 'template'}.docx"
        
        # 对文件名进行 URL 编码，支持中文文件名
        encoded_filename = quote(filename.encode('utf-8'))
        
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{encoded_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出模板失败: {str(e)}",
        )


@router.post("/batch/update-status", response_model=SingleResponse[dict])
async def batch_update_template_status(
    obj_in: BatchUpdateStatusRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """批量更新模板状态"""
    try:
        from app.lex_docx.models import TemplateStatus
        
        # 验证状态值
        if obj_in.new_status not in [TemplateStatus.DRAFT, TemplateStatus.PUBLISHED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的状态值: {obj_in.new_status}",
            )
        
        result = await services.batch_update_template_status(
            db=db,
            template_ids=obj_in.template_ids,
            new_status=obj_in.new_status,
            updated_by=current_staff.id,
        )
        
        # result 是一个字典，包含 updated_count 和 failed_templates
        updated_count = result.get("updated_count", 0)
        failed_templates = result.get("failed_templates", [])
        
        return SingleResponse(
            data={
                "updated_count": updated_count,
                "total": len(obj_in.template_ids),
                "failed_templates": failed_templates
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量更新模板状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量更新模板状态失败: {str(e)}",
        )


@router.post("/batch/delete", response_model=SingleResponse[dict])
async def batch_delete_templates(
    obj_in: BatchDeleteRequest,
    db: DBSession,
    current_staff: Annotated[Staff, Depends(get_current_staff)],
):
    """批量删除模板"""
    try:
        deleted_count = await services.batch_delete_templates(
            db=db,
            template_ids=obj_in.template_ids,
        )
        
        return SingleResponse(
            data={"deleted_count": deleted_count, "total": len(obj_in.template_ids)}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量删除模板失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除模板失败: {str(e)}",
        )


# ==================== 文书生成端点 ====================

@router.post("/generations", response_model=SingleResponse[DocumentGenerationResponse], status_code=status.HTTP_201_CREATED)
async def create_generation(
    obj_in: DocumentGenerationCreate,
    db: DBSession = None,
    current_staff: Annotated[Staff, Depends(get_current_staff)] = None,
):
    """生成文书（需要认证）"""
    try:
        generation = await services.generate_document(
            db=db,
            obj_in=obj_in,
            generated_by=current_staff.id,
        )
        
        return SingleResponse(
            data=DocumentGenerationResponse(
                id=generation.id,
                template_id=generation.template_id,
                generated_by=generation.generated_by,
                form_data=generation.form_data,
                document_url=generation.document_url,
                document_filename=generation.document_filename,
                generated_at=generation.generated_at,
                created_at=generation.created_at,
                updated_at=generation.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成文书失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成文书失败: {str(e)}",
        )


@router.get("/generations", response_model=ListResponse[DocumentGenerationResponse])
async def list_generations(
    db: DBSession = None,
    current_staff: Annotated[Staff, Depends(get_current_staff)] = None,
    template_id: Optional[int] = Query(None, description="按模板ID筛选"),
    generated_by: Optional[int] = Query(None, description="按生成人ID筛选"),
    start_date: Optional[str] = Query(None, description="开始时间（ISO格式）"),
    end_date: Optional[str] = Query(None, description="结束时间（ISO格式）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(10, ge=1, le=100, description="返回数量限制"),
):
    """获取生成记录列表（支持筛选、分页）"""
    try:
        from datetime import datetime
        
        # 解析日期字符串
        start_date_obj = None
        end_date_obj = None
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="开始时间格式不正确，请使用 ISO 格式",
                )
        if end_date:
            try:
                end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="结束时间格式不正确，请使用 ISO 格式",
                )
        
        query_params = GenerationListQuery(
            template_id=template_id,
            generated_by=generated_by,
            start_date=start_date_obj,
            end_date=end_date_obj,
            skip=skip,
            limit=limit,
        )
        
        generations, total = await services.list_generations(db, query_params)
        
        # 转换为响应模型
        generation_responses = [
            DocumentGenerationResponse(
                id=generation.id,
                template_id=generation.template_id,
                generated_by=generation.generated_by,
                form_data=generation.form_data,
                document_url=generation.document_url,
                document_filename=generation.document_filename,
                generated_at=generation.generated_at,
                created_at=generation.created_at,
                updated_at=generation.updated_at,
            )
            for generation in generations
        ]
        
        return ListResponse(
            data=generation_responses,
            pagination=Pagination(
                total=total,
                page=(skip // limit) + 1 if limit > 0 else 1,
                size=limit,
                pages=(total + limit - 1) // limit if limit > 0 else 1,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取生成记录列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取生成记录列表失败: {str(e)}",
        )


@router.get("/generations/{generation_id}", response_model=SingleResponse[DocumentGenerationResponse])
async def get_generation(
    generation_id: int,
    db: DBSession = None,
    current_staff: Annotated[Staff, Depends(get_current_staff)] = None,
):
    """获取生成记录详情"""
    try:
        generation = await services.get_generation_by_id(db, generation_id)
        if not generation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="生成记录不存在",
            )
        
        return SingleResponse(
            data=DocumentGenerationResponse(
                id=generation.id,
                template_id=generation.template_id,
                generated_by=generation.generated_by,
                form_data=generation.form_data,
                document_url=generation.document_url,
                document_filename=generation.document_filename,
                generated_at=generation.generated_at,
                created_at=generation.created_at,
                updated_at=generation.updated_at,
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取生成记录详情失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取生成记录详情失败: {str(e)}",
        )


@router.get("/generations/{generation_id}/download")
async def download_generation(
    generation_id: int,
    db: DBSession = None,
    current_staff: Annotated[Staff, Depends(get_current_staff)] = None,
):
    """下载生成的文档"""
    try:
        generation = await services.get_generation_by_id(db, generation_id)
        if not generation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="生成记录不存在",
            )
        
        # 从 COS URL 下载文件
        import requests
        
        try:
            response = requests.get(generation.document_url, stream=True)
            response.raise_for_status()
            
            # 获取文件内容
            file_content = response.content
            
            return Response(
                content=file_content,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={
                    "Content-Disposition": f'attachment; filename="{generation.document_filename}"',
                },
            )
        except requests.RequestException as e:
            logger.error(f"从 COS 下载文件失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"下载文件失败: {str(e)}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载生成文档失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下载生成文档失败: {str(e)}",
        )

