"""
模板编辑器 API 路由
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_staff, get_db
from app.staffs.models import Staff
from .services import template_editor_service
from .schemas import ParseDocxResponse, ExportDocxRequest, ExportDocxResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/parse", response_model=ParseDocxResponse)
async def parse_docx(
    file: UploadFile = File(...),
    current_staff: Staff = Depends(get_current_staff),
):
    """
    解析 docx 文件为 ProseMirror JSON 格式

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

