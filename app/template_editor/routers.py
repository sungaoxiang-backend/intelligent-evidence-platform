"""
模板编辑器 API 路由
"""

import logging
import io
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from app.integrations.cos import cos_service
from .services import template_editor_service, template_service
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
                status_code=status.HTTP_400_BAD_REQUEST,
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"解析 docx 时发生错误: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"解析 docx 时发生错误: {str(e)}",
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
                status_code=status.HTTP_400_BAD_REQUEST,
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

        # 转换为响应格式
        template_response = TemplateResponse.model_validate(template)
        if template.placeholders:
            from .schemas import PlaceholderInfo
            template_response.placeholders = PlaceholderInfo.model_validate(template.placeholders)

        return TemplateDetailResponse(
            code=200,
            message="解析并保存成功",
            data=template_response,
        )

    except ValueError as e:
        logger.error(f"解析 docx 失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"解析并保存 docx 时发生错误: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"解析并保存 docx 时发生错误: {str(e)}",
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
        docx_bytes = template_editor_service.export_prosemirror_to_docx(
            request.prosemirror_json
        )
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
        response = Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": content_disposition
            },
        )
        logger.info("响应创建成功")
        return response

    except ValueError as e:
        logger.error(f"导出 docx 失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"导出 docx 时发生错误: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出 docx 时发生错误: {str(e)}",
        )


# 模板管理 API

@router.post("/templates", response_model=TemplateDetailResponse, status_code=status.HTTP_201_CREATED)
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

        template_response = TemplateResponse.model_validate(template)
        if template.placeholders:
            from .schemas import PlaceholderInfo
            template_response.placeholders = PlaceholderInfo.model_validate(template.placeholders)

        return TemplateDetailResponse(
            code=201,
            message="创建模板成功",
            data=template_response,
        )
    except Exception as e:
        logger.error(f"创建模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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

        # 转换为响应格式
        template_responses = []
        for template in templates:
            template_response = TemplateResponse.model_validate(template)
            if template.placeholders:
                from .schemas import PlaceholderInfo
                template_response.placeholders = PlaceholderInfo.model_validate(template.placeholders)
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
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )

    template_response = TemplateResponse.model_validate(template)
    if template.placeholders:
        from .schemas import PlaceholderInfo
        template_response.placeholders = PlaceholderInfo.model_validate(template.placeholders)

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
            status_code=status.HTTP_404_NOT_FOUND,
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

        template_response = TemplateResponse.model_validate(updated_template)
        if updated_template.placeholders:
            from .schemas import PlaceholderInfo
            template_response.placeholders = PlaceholderInfo.model_validate(updated_template.placeholders)

        return TemplateDetailResponse(
            code=200,
            message="更新模板成功",
            data=template_response,
        )
    except Exception as e:
        logger.error(f"更新模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新模板失败: {str(e)}",
        )


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"模板 {template_id} 不存在",
        )

    try:
        success = await template_service.delete_template(db, template_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="删除模板失败",
            )
    except Exception as e:
        logger.error(f"删除模板失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除模板失败: {str(e)}",
        )

