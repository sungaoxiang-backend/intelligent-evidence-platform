"""
模板编辑器 API 路由
"""

import logging
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status as http_status, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from app.integrations.cos import cos_service
from .services import template_editor_service, template_service, placeholder_service
from .schemas import (
    ParseDocxResponse, 
    ExportDocxRequest, 
    ExportDocxResponse,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateResponse,
    TemplateListResponse,
    TemplateDetailResponse,
    ParseAndSaveRequest,
    PlaceholderCreateRequest,
    PlaceholderUpdateRequest,
    PlaceholderResponse,
    PlaceholderListResponse,
    PlaceholderDetailResponse,
)
from .models import DocumentTemplate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/parse", response_model=ParseDocxResponse)
async def parse_docx(
    file: UploadFile = File(...),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    解析 docx 文件为 ProseMirror JSON 格式（不保存到数据库）

    Args:
        file: 上传的 docx 文件
        current_staff: 当前登录用户

    Returns:
        ProseMirror JSON 格式的文档
    """
    try:
        # 验证文件类型
        if not file.filename or not file.filename.endswith(".docx"):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="文件必须是 .docx 格式",
            )

        # 读取文件内容
        docx_bytes = await file.read()

        # 解析为 ProseMirror JSON
        prosemirror_json = template_editor_service.parse_docx_to_prosemirror(
            docx_bytes
        )

        return ParseDocxResponse(
            code=200,
            message="解析成功",
            data=prosemirror_json,
        )

    except ValueError as e:
        logger.error(f"解析 docx 失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "parse_failed",
                "message": str(e),
                "context": {"filename": file.filename},
            },
        )
    except Exception as e:
        logger.error(f"解析 docx 时发生错误: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "parse_error",
                "message": "解析 docx 时发生错误",
                "context": {"filename": file.filename, "error": str(e)},
            },
        )


@router.post("/parse-and-save", response_model=TemplateDetailResponse)
async def parse_and_save_docx(
    file: UploadFile = File(...),
    name: str = Form(..., description="模板名称"),
    description: Optional[str] = Form(None, description="模板描述"),
    category: Optional[str] = Form(None, description="分类名称"),
    status: str = Form("draft", description="状态：draft/published"),
    save_to_cos: bool = Form(True, description="是否将 DOCX 文件保存到 COS"),
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    解析 docx 文件并保存为模板

    Args:
        file: 上传的 docx 文件
        name: 模板名称
        description: 模板描述
        category: 分类名称
        status: 状态
        save_to_cos: 是否将 DOCX 文件保存到 COS
        current_staff: 当前登录用户
        db: 数据库会话

    Returns:
        创建的模板详情
    """
    try:
        # 验证文件类型
        if not file.filename or not file.filename.endswith(".docx"):
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail="文件必须是 .docx 格式",
            )

        # 读取文件内容
        docx_bytes = await file.read()

        # 解析为 ProseMirror JSON
        prosemirror_json = template_editor_service.parse_docx_to_prosemirror(
            docx_bytes
        )

        # 上传到 COS（如果需要）
        docx_url = None
        if save_to_cos:
            try:
                file_obj = io.BytesIO(docx_bytes)
                docx_url = cos_service.upload_file(
                    file_obj, 
                    file.filename or "template.docx",
                    folder="templates",
                    disposition="attachment"
                )
                logger.info(f"DOCX 文件已上传到 COS: {docx_url}")
            except Exception as e:
                logger.warning(f"上传 DOCX 到 COS 失败: {str(e)}，继续创建模板")

        # 创建模板
        template = await template_service.create_template(
            db=db,
            name=name,
            prosemirror_json=prosemirror_json,
            docx_url=docx_url,
            description=description,
            category=category,
            status=status,
            created_by_id=current_staff.id,
        )

        # 转换为响应格式（排除 placeholders 关系字段，避免触发懒加载）
        template_dict = {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'category': template.category,
            'status': template.status,
            'prosemirror_json': template.prosemirror_json,
            'docx_url': template.docx_url,
            'created_by_id': template.created_by_id,
            'updated_by_id': template.updated_by_id,
            'created_at': template.created_at,
            'updated_at': template.updated_at,
        }
        template_response = TemplateResponse.model_validate(template_dict)

        return TemplateDetailResponse(
            code=200,
            message="解析并保存成功",
            data=template_response,
        )

    except ValueError as e:
        logger.error(f"解析 docx 失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "parse_failed",
                "message": str(e),
                "context": {"filename": file.filename},
            },
        )
    except Exception as e:
        logger.error(f"解析并保存 docx 时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "parse_save_error",
                "message": "解析并保存 docx 时发生错误",
                "context": {"filename": file.filename, "error": str(e)},
            },
        )


@router.post("/export")
async def export_docx(
    request: ExportDocxRequest,
    current_staff: Staff = Depends(get_current_staff),
):
    """
    从 ProseMirror JSON 导出为 docx 文件

    Args:
        request: 包含 ProseMirror JSON 的请求
        current_staff: 当前登录用户

    Returns:
        docx 文件（二进制流）
    """
    try:
        # 导出为 docx
        logger.info("开始导出 DOCX")
        result = template_editor_service.export_prosemirror_to_docx(
            request.prosemirror_json
        )
        docx_bytes = result if isinstance(result, bytes) else result["docx"]
        warnings = [] if isinstance(result, bytes) else result.get("warnings", [])
        logs = [] if isinstance(result, bytes) else result.get("logs", [])
        logger.info(f"DOCX 导出成功，大小: {len(docx_bytes)} bytes")

        # 确定文件名
        filename = request.filename or "document.docx"
        if not filename.endswith(".docx"):
            filename = f"{filename}.docx"
        
        logger.info(f"文件名: {filename}, 类型: {type(filename)}")

        # 处理文件名编码（避免 latin-1 编码错误）
        # 使用 RFC 5987 格式编码文件名，支持 UTF-8
        from urllib.parse import quote
        encoded_filename = quote(filename, safe='')
        logger.info(f"编码后的文件名: {encoded_filename}")
        
        # 构建 Content-Disposition header
        # 只使用 filename* 部分，避免 latin-1 编码错误
        # 或者使用 ASCII 安全的文件名作为 fallback
        safe_filename = "document.docx"  # ASCII 安全的文件名
        content_disposition = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        logger.info(f"Content-Disposition: {content_disposition}")
        
        # 返回文件响应
        logger.info("准备返回响应")
        headers = {
            "Content-Disposition": content_disposition
        }
        if warnings:
            headers["X-Template-Warnings"] = ",".join(
                warning.get("code", "unknown") for warning in warnings
            )
        if logs:
            headers["X-Template-Logs"] = str(len(logs))

        response = Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers=headers,
        )
        logger.info("响应创建成功")
        return response

    except ValueError as e:
        logger.error(f"导出 docx 失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"导出 docx 时发生错误: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出 docx 时发生错误: {str(e)}",
        )


# 模板管理 API

@router.post("/templates", response_model=TemplateDetailResponse, status_code=http_status.HTTP_201_CREATED)
async def create_template(
    request: TemplateCreateRequest,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    创建模板

    Args:
        request: 创建模板请求
        current_staff: 当前登录用户
        db: 数据库会话

    Returns:
        创建的模板详情
    """
    try:
        template = await template_service.create_template(
            db=db,
            name=request.name,
            prosemirror_json=request.prosemirror_json,
            docx_url=request.docx_url,
            description=request.description,
            category=request.category,
            status=request.status,
            created_by_id=current_staff.id,
        )

        # 转换为响应格式（排除 placeholders 关系字段，避免触发懒加载）
        template_dict = {
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'category': template.category,
            'status': template.status,
            'prosemirror_json': template.prosemirror_json,
            'docx_url': template.docx_url,
            'created_by_id': template.created_by_id,
            'updated_by_id': template.updated_by_id,
            'created_at': template.created_at,
            'updated_at': template.updated_at,
        }
        template_response = TemplateResponse.model_validate(template_dict)

        return TemplateDetailResponse(
            code=201,
            message="创建模板成功",
            data=template_response,
        )
    except Exception as e:
        logger.error(f"创建模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建模板失败: {str(e)}",
        )


@router.get("/templates", response_model=TemplateListResponse)
async def list_templates(
    status: Optional[str] = Query(None, description="状态筛选"),
    category: Optional[str] = Query(None, description="分类筛选"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量"),
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    列出模板

    Args:
        status: 状态筛选
        category: 分类筛选
        skip: 跳过数量
        limit: 返回数量
        current_staff: 当前登录用户
        db: 数据库会话

    Returns:
        模板列表
    """
    try:
        templates = await template_service.list_templates(
            db=db,
            status=status,
            category=category,
            skip=skip,
            limit=limit,
        )

        # 获取总数
        count_query = select(func.count(DocumentTemplate.id))
        if status:
            count_query = count_query.where(DocumentTemplate.status == status)
        if category:
            count_query = count_query.where(DocumentTemplate.category == category)
        result = await db.execute(count_query)
        total = result.scalar() or 0

        # 转换为响应格式（排除 placeholders 关系字段，避免触发懒加载）
        template_responses = []
        for template in templates:
            template_dict = {
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'category': template.category,
                'status': template.status,
                'prosemirror_json': template.prosemirror_json,
                'docx_url': template.docx_url,
                'created_by_id': template.created_by_id,
                'updated_by_id': template.updated_by_id,
                'created_at': template.created_at,
                'updated_at': template.updated_at,
            }
            template_response = TemplateResponse.model_validate(template_dict)
            template_responses.append(template_response)

        return TemplateListResponse(
            code=200,
            message="查询成功",
            data=template_responses,
            total=total,
        )
    except Exception as e:
        logger.error(f"查询模板列表失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询模板列表失败: {str(e)}",
        )


@router.get("/templates/{template_id}", response_model=TemplateDetailResponse)
async def get_template(
    template_id: int,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    获取模板详情

    Args:
        template_id: 模板ID
        current_staff: 当前登录用户
        db: 数据库会话

    Returns:
        模板详情
    """
    template = await template_service.get_template(db, template_id)
    if template is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )

    # 转换为响应格式（排除 placeholders 关系字段，避免触发懒加载）
    template_dict = {
        'id': template.id,
        'name': template.name,
        'description': template.description,
        'category': template.category,
        'status': template.status,
        'prosemirror_json': template.prosemirror_json,
        'docx_url': template.docx_url,
        'created_by_id': template.created_by_id,
        'updated_by_id': template.updated_by_id,
        'created_at': template.created_at,
        'updated_at': template.updated_at,
    }
    template_response = TemplateResponse.model_validate(template_dict)

    return TemplateDetailResponse(
        code=200,
        message="查询成功",
        data=template_response,
    )


@router.put("/templates/{template_id}", response_model=TemplateDetailResponse)
async def update_template(
    template_id: int,
    request: TemplateUpdateRequest,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    更新模板

    Args:
        template_id: 模板ID
        request: 更新模板请求
        current_staff: 当前登录用户
        db: 数据库会话

    Returns:
        更新后的模板详情
    """
    template = await template_service.get_template(db, template_id)
    if template is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )

    try:
        updated_template = await template_service.update_template(
            db=db,
            template=template,
            name=request.name,
            prosemirror_json=request.prosemirror_json,
            docx_url=request.docx_url,
            description=request.description,
            category=request.category,
            status=request.status,
            updated_by_id=current_staff.id,
        )

        # 转换为响应格式（排除 placeholders 关系字段，避免触发懒加载）
        template_dict = {
            'id': updated_template.id,
            'name': updated_template.name,
            'description': updated_template.description,
            'category': updated_template.category,
            'status': updated_template.status,
            'prosemirror_json': updated_template.prosemirror_json,
            'docx_url': updated_template.docx_url,
            'created_by_id': updated_template.created_by_id,
            'updated_by_id': updated_template.updated_by_id,
            'created_at': updated_template.created_at,
            'updated_at': updated_template.updated_at,
        }
        template_response = TemplateResponse.model_validate(template_dict)

        return TemplateDetailResponse(
            code=200,
            message="更新模板成功",
            data=template_response,
        )
    except Exception as e:
        logger.error(f"更新模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模板失败: {str(e)}",
        )


@router.delete("/templates/{template_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: int,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    删除模板

    Args:
        template_id: 模板ID
        current_staff: 当前登录用户
        db: 数据库会话
    """
    template = await template_service.get_template(db, template_id)
    if template is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )

    try:
        success = await template_service.delete_template(db, template_id)
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除模板失败",
            )
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模板失败: {str(e)}",
        )


# 占位符管理 API

@router.post("/placeholders", response_model=PlaceholderDetailResponse, status_code=http_status.HTTP_201_CREATED)
async def create_placeholder(
    request: PlaceholderCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    创建占位符
    
    如果占位符已存在，返回 HTTP 409 Conflict 错误
    """
    try:
        options_dict = [opt.dict() for opt in request.options] if request.options else None
        
        placeholder = await placeholder_service.create_placeholder(
            db=db,
            name=request.name,
            type=request.type,
            options=options_dict,
            created_by_id=current_staff.id,
        )
        
        return PlaceholderDetailResponse(
            code=200,
            message="创建成功",
            data=PlaceholderResponse.model_validate(placeholder),
        )
    except ValueError as e:
        # 占位符已存在的情况
        logger.warning(f"创建占位符失败: {e}")
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"创建占位符失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建占位符失败: {str(e)}"
        )


@router.get("/placeholders", response_model=PlaceholderListResponse)
async def list_placeholders(
    template_id: Optional[int] = Query(None, description="模板ID（可选，如果提供则只返回该模板关联的占位符）"),
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(100, ge=1, le=1000, description="返回记录数限制"),
    db: AsyncSession = Depends(get_db),
):
    """
    列出占位符
    
    如果提供 template_id，则只返回该模板关联的占位符
    """
    try:
        placeholders, total = await placeholder_service.list_placeholders(
            db=db,
            template_id=template_id,
            skip=skip,
            limit=limit,
        )
        
        return PlaceholderListResponse(
            code=200,
            message="查询成功",
            data=[PlaceholderResponse.model_validate(p) for p in placeholders],
            total=total,
        )
    except Exception as e:
        logger.error(f"查询占位符列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询占位符列表失败: {str(e)}"
        )


@router.get("/placeholders/{name}", response_model=PlaceholderDetailResponse)
async def get_placeholder(
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """
    根据占位符名称获取占位符详情
    """
    try:
        placeholder = await placeholder_service.get_placeholder(
            db=db,
            placeholder_name=name,
        )
        
        if not placeholder:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"占位符不存在: {name}"
            )
        
        return PlaceholderDetailResponse(
            code=200,
            message="查询成功",
            data=PlaceholderResponse.model_validate(placeholder),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询占位符详情失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询占位符详情失败: {str(e)}"
        )


@router.put("/placeholders/{name}", response_model=PlaceholderDetailResponse)
async def update_placeholder(
    name: str,
    request: PlaceholderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    更新占位符
    """
    try:
        # 转换 options
        options_dict = None
        if request.options is not None:
            options_dict = [opt.dict() for opt in request.options]
        
        placeholder = await placeholder_service.update_placeholder(
            db=db,
            placeholder_name=name,
            new_name=request.name,
            type=request.type,
            options=options_dict,
            updated_by_id=current_staff.id,
        )
        
        if not placeholder:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"占位符不存在: {name}"
            )
        
        return PlaceholderDetailResponse(
            code=200,
            message="更新成功",
            data=PlaceholderResponse.model_validate(placeholder),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新占位符失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新占位符失败: {str(e)}"
        )


@router.delete("/placeholders/{name}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_placeholder(
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """
    删除占位符
    """
    try:
        success = await placeholder_service.delete_placeholder(
            db=db,
            placeholder_name=name,
        )
        
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"占位符不存在: {name}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除占位符失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除占位符失败: {str(e)}"
        )


@router.post("/templates/{template_id}/placeholders/{name}", status_code=http_status.HTTP_204_NO_CONTENT)
async def associate_placeholder_to_template(
    template_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """
    将占位符关联到模板
    """
    try:
        success = await placeholder_service.associate_placeholder_to_template(
            db=db,
            template_id=template_id,
            placeholder_name=name,
        )
        
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="模板或占位符不存在"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"关联占位符到模板失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"关联占位符到模板失败: {str(e)}"
        )


@router.delete("/templates/{template_id}/placeholders/{name}", status_code=http_status.HTTP_204_NO_CONTENT)
async def disassociate_placeholder_from_template(
    template_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
):
    """
    从模板中移除占位符关联
    """
    try:
        success = await placeholder_service.disassociate_placeholder_from_template(
            db=db,
            template_id=template_id,
            placeholder_name=name,
        )
        
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="模板或占位符不存在，或关联关系不存在"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"移除占位符关联失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"移除占位符关联失败: {str(e)}"
        )

