"""
文书管理 API 路由
完全独立实现，不依赖现有模板管理和文书生成模块
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status as http_status, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from app.documents_management.services import document_management_service
from app.documents_management.schemas import (
    DocumentCreateRequest,
    DocumentUpdateRequest,
    DocumentResponse,
    DocumentListResponse,
    DocumentDetailResponse,
    DocumentExportRequest,
)
from app.documents_management.pdf_export import html_to_pdf_sync

router = APIRouter()


@router.post("", response_model=DocumentDetailResponse, status_code=http_status.HTTP_201_CREATED)
async def create_document(
    request: DocumentCreateRequest,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    创建文书
    
    Args:
        request: 创建请求
        current_staff: 当前登录用户
        db: 数据库会话
        
    Returns:
        创建的文书详情
    """
    try:
        document = await document_management_service.create_document(
            db=db,
            request=request,
            staff_id=current_staff.id if current_staff else None
        )
        
        return DocumentDetailResponse(
            code=201,
            message="创建成功",
            data=DocumentResponse.model_validate(document)
        )
    except Exception as e:
        logger.error(f"创建文书失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建文书失败"
        )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类筛选"),
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    获取文书列表
    
    Args:
        skip: 跳过数量
        limit: 返回数量
        search: 搜索关键词
        category: 分类筛选
        current_staff: 当前登录用户
        db: 数据库会话
        
    Returns:
        文书列表
    """
    try:
        documents, total = await document_management_service.list_documents(
            db=db,
            skip=skip,
            limit=limit,
            search=search,
            category=category
        )
        
        return DocumentListResponse(
            code=200,
            message="查询成功",
            data=[DocumentResponse.model_validate(doc) for doc in documents],
            total=total
        )
    except Exception as e:
        logger.error(f"获取文书列表失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取文书列表失败"
        )


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: int,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    获取文书详情
    
    Args:
        document_id: 文书ID
        current_staff: 当前登录用户
        db: 数据库会话
        
    Returns:
        文书详情
    """
    try:
        document = await document_management_service.get_document(db, document_id)
        if not document:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="文书不存在"
            )
        
        return DocumentDetailResponse(
            code=200,
            message="查询成功",
            data=DocumentResponse.model_validate(document)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文书详情失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取文书详情失败"
        )


@router.put("/{document_id}", response_model=DocumentDetailResponse)
async def update_document(
    document_id: int,
    request: DocumentUpdateRequest,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    更新文书
    
    Args:
        document_id: 文书ID
        request: 更新请求
        current_staff: 当前登录用户
        db: 数据库会话
        
    Returns:
        更新后的文书详情
    """
    try:
        document = await document_management_service.update_document(
            db=db,
            document_id=document_id,
            request=request,
            staff_id=current_staff.id if current_staff else None
        )
        
        if not document:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="文书不存在"
            )
        
        return DocumentDetailResponse(
            code=200,
            message="更新成功",
            data=DocumentResponse.model_validate(document)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新文书失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新文书失败"
        )


@router.delete("/{document_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    删除文书
    
    Args:
        document_id: 文书ID
        current_staff: 当前登录用户
        db: 数据库会话
    """
    try:
        success = await document_management_service.delete_document(db, document_id)
        if not success:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="文书不存在"
            )
        
        return Response(status_code=http_status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除文书失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除文书失败"
        )


@router.post("/{document_id}/export")
async def export_document_to_pdf(
    document_id: int,
    request: DocumentExportRequest,
    current_staff: Staff = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    """
    导出文书为 PDF
    
    Args:
        document_id: 文书ID
        request: 导出请求（包含 HTML 内容）
        current_staff: 当前登录用户
        db: 数据库会话
        
    Returns:
        PDF 文件流
    """
    try:
        # 验证文书存在
        document = await document_management_service.get_document(db, document_id)
        if not document:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="文书不存在"
            )
        
        # 生成 PDF
        pdf_bytes = html_to_pdf_sync(
            html_content=request.html_content,
            filename=request.filename or f"{document.name}.pdf"
        )
        
        # 确定文件名
        filename = request.filename or f"{document.name}.pdf"
        if not filename.endswith(".pdf"):
            filename = f"{filename}.pdf"
        
        # 处理文件名编码
        from urllib.parse import quote
        encoded_filename = quote(filename, safe='')
        safe_filename = "document.pdf"
        content_disposition = f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": content_disposition
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出 PDF 失败: {str(e)}")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出 PDF 失败"
        )

