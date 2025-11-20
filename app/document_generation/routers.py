"""
文书生成 API 路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.db.session import get_db
from app.staffs.models import Staff
from app.core.deps import get_current_staff
from app.document_generation.services import document_generation_service
from app.document_generation.schemas import (
    DocumentGenerationCreateRequest,
    DocumentGenerationUpdateRequest,
    DocumentGenerationExportRequest,
    DocumentGenerationResponse,
    DocumentGenerationDetailResponse,
    PublishedTemplateListResponse,
    TemplateDetailInfo,
)

router = APIRouter()


@router.get("/templates", response_model=PublishedTemplateListResponse)
async def get_published_templates(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """
    获取已发布的模板列表
    
    Args:
        skip: 跳过记录数
        limit: 返回记录数（最大 100）
        category: 分类过滤
        search: 搜索关键词
        db: 数据库会话
        current_staff: 当前登录员工
    
    Returns:
        已发布模板列表
    """
    if limit > 100:
        limit = 100
    
    try:
        templates, total = await document_generation_service.get_published_templates(
            db=db,
            skip=skip,
            limit=limit,
            category=category,
            search=search
        )
        
        # 转换为响应格式 - 直接使用 model_validate
        template_list = [TemplateDetailInfo.model_validate(t) for t in templates]
        
        return PublishedTemplateListResponse(
            code=200,
            message="查询成功",
            data=template_list,
            total=total
        )
    except Exception as e:
        logger.error(f"获取已发布模板列表失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取模板列表失败"
        )


@router.get("/{generation_id}", response_model=DocumentGenerationDetailResponse)
async def get_generation_detail(
    generation_id: int,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """
    获取文书生成记录详情
    
    Args:
        generation_id: 文书生成记录ID
        db: 数据库会话
        current_staff: 当前登录员工
    
    Returns:
        文书生成记录详情（包含案件和模板信息）
    """
    try:
        generation = await document_generation_service.get_generation_detail(
            db=db,
            generation_id=generation_id
        )
        
        if not generation:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="文书生成记录不存在"
            )
        
        # 构建响应数据 - 使用 model_validate
        return DocumentGenerationDetailResponse.model_validate(generation)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文书生成记录详情失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取文书生成记录失败"
        )


@router.post("", response_model=DocumentGenerationResponse, status_code=http_status.HTTP_201_CREATED)
async def create_or_get_generation(
    request: DocumentGenerationCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """
    创建或获取文书生成记录（同一案件同一模板唯一）
    
    Args:
        request: 创建请求
        db: 数据库会话
        current_staff: 当前登录员工
    
    Returns:
        文书生成记录
    """
    try:
        generation = await document_generation_service.create_or_get_generation(
            db=db,
            case_id=request.case_id,
            template_id=request.template_id,
            staff_id=current_staff.id
        )
        
        return DocumentGenerationResponse.model_validate(generation)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建文书生成记录失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建文书生成记录失败"
        )


@router.patch("/{generation_id}", response_model=DocumentGenerationResponse)
async def update_generation_data(
    generation_id: int,
    request: DocumentGenerationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """
    更新文书生成的表单数据（草稿保存）
    
    Args:
        generation_id: 文书生成记录ID
        request: 更新请求
        db: 数据库会话
        current_staff: 当前登录员工
    
    Returns:
        更新后的文书生成记录
    """
    try:
        generation = await document_generation_service.update_generation_data(
            db=db,
            generation_id=generation_id,
            form_data=request.form_data,
            staff_id=current_staff.id
        )
        
        return DocumentGenerationResponse.model_validate(generation)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新文书生成记录失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新文书生成记录失败"
        )


@router.post("/{generation_id}/export")
async def export_document(
    generation_id: int,
    request: DocumentGenerationExportRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """
    导出文书到 COS
    
    Args:
        generation_id: 文书生成记录ID
        request: 导出请求（可选文件名）
        db: 数据库会话
        current_staff: 当前登录员工
    
    Returns:
        文件 URL 和警告信息
    """
    try:
        result = await document_generation_service.generate_document(
            db=db,
            generation_id=generation_id,
            filename=request.filename
        )
        
        return {
            "code": 200,
            "message": "导出成功",
            "data": {
                "file_url": result["file_url"],
                "filename": result["filename"],
                "warnings": result["warnings"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出文书失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出文书失败"
        )
