"""
文书生成模块的路由
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from .services import DocumentGenerator
from .schemas import (
    DocumentGenerateRequest, 
    DocumentGenerateByCaseRequest,
    DocumentGenerateResponse,
    DocumentTemplateInfo,
    DocumentRecordInfo,
    HealthCheckResponse
)

router = APIRouter()

# 文书生成器实例
document_generator = DocumentGenerator()


@router.get("/templates")
async def get_templates(
    current_staff: Staff = Depends(get_current_staff)
):
    """获取可用的文书模板列表"""
    try:
        templates = document_generator.get_available_templates()
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


@router.post("/generate")
async def generate_document(
    request: DocumentGenerateRequest,
    current_staff: Staff = Depends(get_current_staff)
):
    """生成文书"""
    try:
        # 获取模板配置
        template = document_generator.get_template(request.template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"模板 {request.template_id} 不存在"
            )
        
        # 构建案件数据，使用配置中的默认值作为基础
        case_data = document_generator._build_case_data_from_template(template, request.variables or {})
        case_data.update({
            "case_id": request.case_id,
            "created_at": current_staff.created_at
        })
        
        # 验证必需字段
        required_fields = ["creditor_name", "debtor_name", "loan_amount"]
        missing_fields = [field for field in required_fields if not case_data.get(field)]
        
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"缺少必需字段: {', '.join(missing_fields)}"
            )
        
        # 验证数据类型
        try:
            loan_amount = float(case_data["loan_amount"])
            if loan_amount <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="货款金额必须大于0"
                )
            case_data["loan_amount"] = loan_amount
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="货款金额必须是有效的数字"
            )
        
        # 生成文书
        result = document_generator.generate_document(
            template_id=request.template_id,
            case_data=case_data,
            custom_variables=request.variables
        )
        
        if result["success"]:
            # 转换为统一的API响应格式
            return {
                "code": 200,
                "message": result["message"],
                "data": {
                    "file_path": result["file_path"],
                    "filename": result["filename"]
                }
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


@router.post("/generate-by-case")
async def generate_document_by_case(
    request: DocumentGenerateByCaseRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: Staff = Depends(get_current_staff)
):
    """通过案件ID生成文书（集成版本）"""
    try:
        # 生成文书
        result = await document_generator.generate_document_by_case_id(
            db=db,
            template_id=request.template_id,
            case_id=request.case_id,
            custom_variables=request.custom_variables
        )
        
        if result["success"]:
            # 转换为统一的API响应格式
            return {
                "code": 200,
                "message": result["message"],
                "data": {
                    "file_path": result["file_path"],
                    "filename": result["filename"]
                }
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


@router.get("/download/{filename:path}")
async def download_document(
    filename: str,
    current_staff: Staff = Depends(get_current_staff)
):
    """下载生成的文书"""
    try:
        file_path = document_generator.output_dir / filename
        
        # 检查文件是否存在
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="文书文件不存在"
            )
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"下载文书失败: {str(e)}"
        )


@router.post("/init-templates")
async def initialize_templates(
    current_staff: Staff = Depends(get_current_staff)
):
    """初始化示例模板"""
    try:
        document_generator.create_sample_templates()
        return {"message": "示例模板创建成功"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"初始化模板失败: {str(e)}"
        )


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """健康检查"""
    try:
        return document_generator.get_health_status()
    except Exception as e:
        return {
            "status": "unhealthy",
            "template_dir_exists": False,
            "output_dir_exists": False,
            "template_dir": str(document_generator.template_dir),
            "output_dir": str(document_generator.output_dir),
            "error": str(e)
        }
