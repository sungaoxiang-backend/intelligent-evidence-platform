"""
文档模板路由
提供模板列表、模板详情、表单数据提交等API
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from .services import template_service
from pydantic import BaseModel, Field


router = APIRouter()


class FormDataSubmitRequest(BaseModel):
    """表单数据提交请求"""
    template_id: str = Field(..., description="模板ID")
    form_data: Dict[str, Any] = Field(..., description="表单数据")


class FormDataSubmitResponse(BaseModel):
    """表单数据提交响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="响应消息")
    errors: List[str] = Field(default_factory=list, description="错误信息列表")
    data: Optional[Dict[str, Any]] = Field(None, description="响应数据")


@router.get("/templates")
async def get_template_list(
    current_staff: Staff = Depends(get_current_staff)
):
    """
    获取模板列表
    
    Returns:
        模板列表，包含模板基本信息
    """
    try:
        templates = template_service.get_template_list()
        return {
            "code": 200,
            "message": "获取模板列表成功",
            "data": templates
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板列表失败: {str(e)}"
        )


@router.get("/templates/{template_id}")
async def get_template_detail(
    template_id: str,
    current_staff: Staff = Depends(get_current_staff)
):
    """
    获取模板详情（包含完整的表单结构）
    
    Args:
        template_id: 模板ID
        
    Returns:
        模板详情，包含表单结构定义
    """
    try:
        form_schema = template_service.get_template_form_schema(template_id)
        if not form_schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"模板 {template_id} 不存在"
            )
        
        return {
            "code": 200,
            "message": "获取模板详情成功",
            "data": form_schema
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板详情失败: {str(e)}"
        )


@router.post("/templates/{template_id}/validate")
async def validate_form_data(
    template_id: str,
    request: Dict[str, Any],
    current_staff: Staff = Depends(get_current_staff)
):
    """
    验证表单数据
    
    Args:
        template_id: 模板ID
        request: 包含 form_data 的请求体
        
    Returns:
        验证结果
    """
    try:
        form_data = request.get("form_data", {})
        validation_result = template_service.validate_form_data(template_id, form_data)
        
        if validation_result["valid"]:
            return {
                "code": 200,
                "message": "表单数据验证通过",
                "data": {
                    "valid": True
                }
            }
        else:
            return {
                "code": 400,
                "message": "表单数据验证失败",
                "data": {
                    "valid": False,
                    "errors": validation_result["errors"]
                }
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证表单数据失败: {str(e)}"
        )


@router.post("/templates/{template_id}/generate")
async def generate_document_from_form(
    template_id: str,
    request: Dict[str, Any],
    current_staff: Staff = Depends(get_current_staff)
):
    """
    根据表单数据生成文书
    
    Args:
        template_id: 模板ID
        request: 包含 form_data 的请求体
        
    Returns:
        生成结果，包含文件下载信息
    """
    try:
        form_data = request.get("form_data", {})
        result = template_service.generate_document_from_form(template_id, form_data)
        
        if result["success"]:
            return {
                "code": 200,
                "message": result["message"],
                "data": result
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成文书失败: {str(e)}"
        )


@router.post("/templates/{template_id}/preview")
async def preview_document_html(
    template_id: str,
    request: Dict[str, Any],
    current_staff: Staff = Depends(get_current_staff)
):
    """
    预览文书HTML（用于网页预览和打印）
    
    Args:
        template_id: 模板ID
        request: 包含 form_data 的请求体
        
    Returns:
        HTML内容
    """
    try:
        form_data = request.get("form_data", {})
        html_content = template_service.generate_html_from_markdown(template_id, form_data)
        
        if html_content:
            return {
                "code": 200,
                "message": "预览生成成功",
                "data": {
                    "html_content": html_content
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="无法生成预览（模板不存在或Markdown模板不存在）"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成预览失败: {str(e)}"
        )


@router.get("/download/{filename:path}")
async def download_document(
    filename: str,
    current_staff: Staff = Depends(get_current_staff)
):
    """
    下载生成的文书
    
    Args:
        filename: 文件名
        
    Returns:
        文件响应
    """
    from fastapi.responses import FileResponse
    from pathlib import Path
    
    try:
        file_path = Path("static/documents") / filename
        
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文件不存在"
            )
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下载文件失败: {str(e)}"
        )

