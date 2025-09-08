from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional
from app.utils.xunfei_ocr import XunfeiOcrService
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
    识别证据并返回表单可用的数据
    
    Args:
        request: OCR识别请求
        
    Returns:
        OcrResponse: 包含识别结果的响应
    """
    try:
        # 调用OCR服务
        ocr_service = XunfeiOcrService()
        result = ocr_service.extract_evidence_features(
            str(request.image_url), 
            request.evidence_type
        )
        
        # 检查是否有错误
        if "error" in result:
            logger.error(f"OCR识别失败: {result['error']}")
            return OcrResponse(
                success=False,
                error_message=result["error"]
            )
        
        # 提取evidence_features并转换为表单数据
        evidence_features = result.get("evidence_features", [])
        
        form_data = _convert_to_form_data(evidence_features)
        
        return OcrResponse(
            success=True,
            data=form_data
        )
        
    except Exception as e:
        logger.error(f"OCR API调用失败: {str(e)}")
        return OcrResponse(
            success=False,
            error_message=f"OCR识别失败: {str(e)}"
        )

def _convert_to_form_data(evidence_features: List[Dict]) -> Dict[str, Any]:
    """
    将OCR识别的evidence_features转换为表单数据
    
    Args:
        evidence_features: OCR识别的特征列表
        
    Returns:
        Dict: 表单数据
    """
    form_data = {}
    
    # 字段映射 - 统一处理营业执照信息
    field_mapping = {
        "公司名称": "company_name",
        "法定代表人": "name",
        "经营者姓名": "name", 
        "经营者": "name",
        "姓名": "name",  # 可能的其他字段名
        "负责人": "name",  # 可能的其他字段名
        "住所地": "company_address", 
        "统一社会信用代码": "company_code",
    }
    
    # 提取字段值
    for feature in evidence_features:
        slot_name = feature.get("slot_name", "")
        slot_value = feature.get("slot_value", "")
        confidence = feature.get("confidence", 0.0)
        
        # 调试信息：打印所有识别的字段
        logger.info(f"OCR识别字段: {slot_name} = {slot_value} (置信度: {confidence})")
        
        # 只处理置信度较高的结果
        if confidence > 0.5 and slot_name in field_mapping:
            form_field = field_mapping[slot_name]
            form_data[form_field] = slot_value
            logger.info(f"字段映射: {slot_name} -> {form_field} = {slot_value}")
        elif confidence > 0.5:
            logger.warning(f"未映射的字段: {slot_name} = {slot_value} (置信度: {confidence})")
    
    return form_data

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