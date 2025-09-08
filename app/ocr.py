from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional
from app.utils.business_license_ocr import BusinessLicenseOcrClient
from app.core.response import SingleResponse
from app.core.logging import logger

router = APIRouter()

# 请求模型
class OcrRequest(BaseModel):
    """OCR识别请求"""
    image_url: HttpUrl
    evidence_type: str

# 响应模型
class OcrResponse(BaseModel):
    """OCR识别响应"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

@router.post("/recognize", response_model=OcrResponse)
async def recognize_evidence(request: OcrRequest):
    """
    识别营业执照并返回表单可用的数据
    
    Args:
        request: OCR识别请求
        
    Returns:
        OcrResponse: 包含识别结果的响应
    """
    try:
        # 调用营业执照识别服务
        ocr_client = BusinessLicenseOcrClient()
        result = ocr_client.recognize_business_license(str(request.image_url))
        
        # 检查是否有错误
        if "error" in result:
            logger.error(f"OCR识别失败: {result['error']}")
            return OcrResponse(
                success=False,
                error_message=result["error"]
            )
        
        # 直接返回识别结果
        return OcrResponse(
            success=True,
            data=result
        )
        
    except Exception as e:
        logger.error(f"OCR API调用失败: {str(e)}")
        return OcrResponse(
            success=False,
            error_message=f"OCR识别失败: {str(e)}"
        )


@router.get("/supported-types")
async def get_supported_types():
    """
    获取支持的OCR类型
    
    Returns:
        Dict: 支持的证据类型列表
    """
    return {
        "supported_evidence_types": [
            {"value": "公司营业执照", "label": "公司营业执照"},
            {"value": "个体工商户营业执照", "label": "个体工商户营业执照"},
        ]
    }