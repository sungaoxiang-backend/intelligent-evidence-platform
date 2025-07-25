import base64
import hashlib
import hmac
import json
import re
from datetime import datetime
from enum import Enum
from time import mktime
from urllib.parse import urlencode, urlparse
from wsgiref.handlers import format_date_time

import requests

from app.core.config import settings


class EvidenceType(str, Enum):
    """证据类型枚举"""
    COMPANY_BUSINESS_LICENSE = "公司营业执照"
    INDIVIDUAL_BUSINESS_LICENSE = "个体工商户营业执照"
    ID_CARD = "身份证"
    VAT_INVOICE = "增值税发票"
    # 后续可以继续添加其他类型
    COMPANY_GSXT_LICENSE = "公司全国企业公示系统营业执照"
    INDIVIDUAL_GSXT_LICENSE = "个体工商户全国企业公示系统营业执照"
    


class OCRFieldMapping(str, Enum):
    """OCR字段映射枚举 - 将OCR的key映射到业务key"""
    
    # 营业执照相关字段
    BL_COMPANY_NAME = "bl-company-name"
    BL_OWNER_NAME = "bl-owner-name"
    BL_CORPORATE_RESIDENCE = "bl-corporate-residence"
    BL_DATE = "bl-date"
    BL_OPERATING_PERIOD = "bl-operating-period"
    BL_CODE = "bl-code"
    BL_TYPE = "bl-type"
    
    # 身份证相关字段（根据实际OCR返回格式）
    ID_NAME = "Name"
    ID_GENDER = "Gender"
    ID_NATION = "Nation"
    ID_BIRTH = "Birthday"
    ID_ADDRESS = "Address"
    ID_NUMBER = "ID"
    
    # 增值税发票相关字段（根据实际OCR返回格式）
    INVOICE_PAYER_NAME = "vat-invoice-payer-name"
    INVOICE_PAYER_ID = "vat-invoice-payer-id"
    INVOICE_SELLER_NAME = "vat-invoice-seller-name"
    INVOICE_SELLER_ID = "vat-invoice-seller-id"
    INVOICE_TOTAL_AMOUNT = "vat-invoice-total-cover-tax"
    INVOICE_MACHINE_CODE = "vat-invoice-machine-code"
    INVOICE_TYPE = "vat-invoice-type"
    INVOICE_CRYPTOGRAPHIC_AREA = "vat-invoice-cryptographic-area"
    INVOICE_REVIEW = "vat-invoice-review"
    INVOICE_SELLER_ADDR_TELL = "vat-invoice-seller-addr-tell"
    INVOICE_SELLER_BANK_ACCOUNT = "vat-invoice-seller-bank-account"
    INVOICE_PAYER_ADDR_TELL = "vat-invoice-payer-addr-tell"


class BusinessField(str, Enum):
    """业务字段枚举 - 业务系统中使用的字段名"""
    
    # 通用字段
    COMPANY_NAME = "公司名称"
    LEGAL_REPRESENTATIVE = "法定代表人"
    ADDRESS = "住所地"
    ESTABLISHMENT_DATE = "成立日期"
    OPERATING_PERIOD = "营业期限"
    UNIFIED_SOCIAL_CREDIT_CODE = "统一社会信用代码"
    COMPANY_TYPE = "公司类型"
    
    # 身份证字段
    NAME = "姓名"
    GENDER = "性别"
    NATION = "民族"
    BIRTH_DATE = "出生日期"
    ID_NUMBER = "身份证号"
    
    # 增值税发票字段
    BUYER_NAME = "购买方名称"
    BUYER_TAX_NUMBER = "购买方纳税人识别号"
    SELLER_NAME = "销售方名称"
    SELLER_TAX_NUMBER = "销售方纳税人识别号"
    TOTAL_AMOUNT = "价税合计"
    MACHINE_CODE = "机器编码"
    INVOICE_TYPE = "发票类型"
    CRYPTOGRAPHIC_AREA = "密码区"
    REVIEWER = "复核人"
    SELLER_ADDRESS_PHONE = "销售方地址电话"
    SELLER_BANK_ACCOUNT = "销售方银行账户"
    BUYER_ADDRESS_PHONE = "购买方地址电话"


class XunfeiOcrClient:
    def __init__(self):
        self.app_id = settings.XUNFEI_OCR_APP_ID
        self.api_key = settings.XUNFEI_OCR_API_KEY
        self.api_secret = settings.XUNFEI_OCR_API_SECRET
        self.api_url = settings.XUNFEI_OCR_INVOICE_API_URL
        self.general_api_url = settings.XUNFEI_OCR_GENERAL_API_URL

    def _build_auth_url(self, url: str, method: str = "POST") -> str:
        """构建带鉴权参数的URL"""
        url_result = urlparse(url)
        date = format_date_time(mktime(datetime.now().timetuple()))
        signature_origin = f"host: {url_result.hostname}\ndate: {date}\nPOST {url_result.path} HTTP/1.1"
        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        signature_sha_base64 = base64.b64encode(signature_sha).decode(encoding='utf-8')
        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha_base64}"'
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')
        values = {
            "host": url_result.hostname,
            "date": date,
            "authorization": authorization
        }
        return url + "?" + urlencode(values)

    def _get_image_content(self, image_source: str) -> bytes:
        """从路径或URL获取图片内容."""
        if image_source.startswith(('http://', 'https://')):
            response = requests.get(image_source)
            response.raise_for_status()
            return response.content
        else:
            with open(image_source, "rb") as f:
                return f.read()

    def _clean_slot_value(self, value: str, field_name: str) -> str:
        """清理和标准化slot_value
        
        Args:
            value: 原始值
            field_name: 字段名称
            
        Returns:
            str: 清理后的值
        """
        if not value:
            return value
        
        # 移除多余的空白字符和换行符
        cleaned = value.strip().replace('\n', ' ').replace('\r', ' ')
        
        # 处理多个连续空格
        cleaned = re.sub(r'\s+', ' ', cleaned)
        
        # 针对特定字段的特殊处理
        if field_name in [BusinessField.ADDRESS, BusinessField.UNIFIED_SOCIAL_CREDIT_CODE]:
            # 地址和统一社会信用代码字段，移除空格
            cleaned = cleaned.replace(' ', '')
        
        elif field_name == BusinessField.COMPANY_TYPE:
            # 公司类型字段，标准化括号格式
            cleaned = cleaned.replace('(', '（').replace(')', '）')
        
        return cleaned.strip()

    def _get_field_mapping(self, evidence_type: EvidenceType) -> dict:
        """根据证据类型获取字段映射关系
        
        Args:
            evidence_type: 证据类型
            
        Returns:
            dict: OCR字段到业务字段的映射
        """
        mappings = {
            EvidenceType.COMPANY_BUSINESS_LICENSE: {
                OCRFieldMapping.BL_COMPANY_NAME: BusinessField.COMPANY_NAME,
                OCRFieldMapping.BL_OWNER_NAME: BusinessField.LEGAL_REPRESENTATIVE,
                OCRFieldMapping.BL_CORPORATE_RESIDENCE: BusinessField.ADDRESS,
                OCRFieldMapping.BL_DATE: BusinessField.ESTABLISHMENT_DATE,
                OCRFieldMapping.BL_OPERATING_PERIOD: BusinessField.OPERATING_PERIOD,
                OCRFieldMapping.BL_CODE: BusinessField.UNIFIED_SOCIAL_CREDIT_CODE,
                OCRFieldMapping.BL_TYPE: BusinessField.COMPANY_TYPE,
            },
            EvidenceType.INDIVIDUAL_BUSINESS_LICENSE: {
                OCRFieldMapping.BL_COMPANY_NAME: BusinessField.COMPANY_NAME,
                OCRFieldMapping.BL_OWNER_NAME: BusinessField.LEGAL_REPRESENTATIVE,
                OCRFieldMapping.BL_CORPORATE_RESIDENCE: BusinessField.ADDRESS,
                OCRFieldMapping.BL_DATE: BusinessField.ESTABLISHMENT_DATE,
                OCRFieldMapping.BL_OPERATING_PERIOD: BusinessField.OPERATING_PERIOD,
                OCRFieldMapping.BL_CODE: BusinessField.UNIFIED_SOCIAL_CREDIT_CODE,
                OCRFieldMapping.BL_TYPE: BusinessField.COMPANY_TYPE,
            },
            EvidenceType.COMPANY_GSXT_LICENSE: {
                OCRFieldMapping.BL_COMPANY_NAME: BusinessField.COMPANY_NAME,
                OCRFieldMapping.BL_OWNER_NAME: BusinessField.LEGAL_REPRESENTATIVE,
                OCRFieldMapping.BL_CORPORATE_RESIDENCE: BusinessField.ADDRESS,
                OCRFieldMapping.BL_DATE: BusinessField.ESTABLISHMENT_DATE,
                OCRFieldMapping.BL_OPERATING_PERIOD: BusinessField.OPERATING_PERIOD,
                OCRFieldMapping.BL_CODE: BusinessField.UNIFIED_SOCIAL_CREDIT_CODE,
                OCRFieldMapping.BL_TYPE: BusinessField.COMPANY_TYPE,
            },
            EvidenceType.INDIVIDUAL_GSXT_LICENSE: {
                OCRFieldMapping.BL_COMPANY_NAME: BusinessField.COMPANY_NAME,
                OCRFieldMapping.BL_OWNER_NAME: BusinessField.LEGAL_REPRESENTATIVE,
                OCRFieldMapping.BL_CORPORATE_RESIDENCE: BusinessField.ADDRESS,
                OCRFieldMapping.BL_DATE: BusinessField.ESTABLISHMENT_DATE,
                OCRFieldMapping.BL_OPERATING_PERIOD: BusinessField.OPERATING_PERIOD,
                OCRFieldMapping.BL_CODE: BusinessField.UNIFIED_SOCIAL_CREDIT_CODE,
                OCRFieldMapping.BL_TYPE: BusinessField.COMPANY_TYPE,
            },
            EvidenceType.ID_CARD: {
                OCRFieldMapping.ID_NAME: BusinessField.NAME,
                OCRFieldMapping.ID_GENDER: BusinessField.GENDER,
                OCRFieldMapping.ID_NATION: BusinessField.NATION,
                OCRFieldMapping.ID_BIRTH: BusinessField.BIRTH_DATE,
                OCRFieldMapping.ID_ADDRESS: BusinessField.ADDRESS,
                OCRFieldMapping.ID_NUMBER: BusinessField.ID_NUMBER,
            },
            EvidenceType.VAT_INVOICE: {
                OCRFieldMapping.INVOICE_PAYER_NAME: BusinessField.BUYER_NAME,
                OCRFieldMapping.INVOICE_PAYER_ID: BusinessField.BUYER_TAX_NUMBER,
                OCRFieldMapping.INVOICE_SELLER_NAME: BusinessField.SELLER_NAME,
                OCRFieldMapping.INVOICE_SELLER_ID: BusinessField.SELLER_TAX_NUMBER,
                OCRFieldMapping.INVOICE_TOTAL_AMOUNT: BusinessField.TOTAL_AMOUNT,
                OCRFieldMapping.INVOICE_MACHINE_CODE: BusinessField.MACHINE_CODE,
                OCRFieldMapping.INVOICE_TYPE: BusinessField.INVOICE_TYPE,
                OCRFieldMapping.INVOICE_CRYPTOGRAPHIC_AREA: BusinessField.CRYPTOGRAPHIC_AREA,
                OCRFieldMapping.INVOICE_REVIEW: BusinessField.REVIEWER,
                OCRFieldMapping.INVOICE_SELLER_ADDR_TELL: BusinessField.SELLER_ADDRESS_PHONE,
                OCRFieldMapping.INVOICE_SELLER_BANK_ACCOUNT: BusinessField.SELLER_BANK_ACCOUNT,
                OCRFieldMapping.INVOICE_PAYER_ADDR_TELL: BusinessField.BUYER_ADDRESS_PHONE,
            },
        }
        
        return mappings.get(evidence_type, {})

    def _get_ocr_type(self, evidence_type: EvidenceType) -> str:
        """根据证据类型获取OCR服务类型
        
        Args:
            evidence_type: 证据类型
            
        Returns:
            str: OCR服务类型
        """
        ocr_type_mapping = {
            EvidenceType.COMPANY_BUSINESS_LICENSE: "bus_license",
            EvidenceType.INDIVIDUAL_BUSINESS_LICENSE: "bus_license",
            EvidenceType.COMPANY_GSXT_LICENSE: "bus_license",  # 公示系统营业执照也使用bus_license
            EvidenceType.INDIVIDUAL_GSXT_LICENSE: "bus_license",  # 公示系统个体工商户营业执照也使用bus_license
            EvidenceType.ID_CARD: "id_card",
            EvidenceType.VAT_INVOICE: "vat_invoice",
        }
        
        return ocr_type_mapping.get(evidence_type, "general")

    def _parse_ocr_result(self, ocr_result: dict, evidence_type: EvidenceType) -> list:
        """通用OCR结果解析方法
        
        Args:
            ocr_result: OCR原始结果
            evidence_type: 证据类型
            
        Returns:
            list: 解析后的evidence_features列表
        """
        if not ocr_result or 'object_list' not in ocr_result:
            return []
        
        # 获取字段映射
        field_mapping = self._get_field_mapping(evidence_type)
        evidence_features = []
        
        for obj in ocr_result.get('object_list', []):
            # 根据证据类型确定对象类型
            expected_obj_type = self._get_ocr_type(evidence_type)
            if obj.get('type') != expected_obj_type:
                continue
                
            for region in obj.get('region_list', []):
                region_type = region.get('type')
                if region_type in field_mapping:
                    business_field = field_mapping[region_type]
                    
                    # 提取文本内容
                    slot_value = ""
                    confidence = 0.0
                    confidence_scores = []
                    
                    for text_block in region.get('text_block_list', []):
                        slot_value = text_block.get('value', '')
                        
                        # 计算置信度（取det_score和score的平均值）
                        for text_sent in text_block.get('text_sent_list', []):
                            det_score = text_sent.get('det_score', 0.0)
                            score = text_sent.get('score', 0.0)
                            avg_score = (det_score + score) / 2
                            confidence_scores.append(avg_score)
                    
                    # 计算平均置信度
                    if confidence_scores:
                        confidence = sum(confidence_scores) / len(confidence_scores)
                    
                    # 清理和标准化slot_value
                    cleaned_value = self._clean_slot_value(slot_value, business_field)
                    
                    # 构建evidence_feature
                    evidence_feature = {
                        "slot_name": business_field.value,  # 使用枚举的value作为slot_name
                        "slot_value": cleaned_value,
                        "confidence": confidence,
                        "reasoning": ""  # OCR没有提供reasoning，留空
                    }
                    
                    evidence_features.append(evidence_feature)
        
        return evidence_features

    def recognize_ticket(self, image_path: str, ticket_type: str) -> dict:
        """通用票证识别（单张图片）."""
        try:
            image_data = self._get_image_content(image_path)
        except Exception as e:
            return {"error": f"Failed to read image source: {e}"}
        
        image_base64 = base64.b64encode(image_data).decode('utf-8')

        request_data = {
            "header": {
                "app_id": self.app_id,
                "status": 3
            },
            "parameter": {
                "ocr": {
                    "type": ticket_type,
                    "level": 1,
                    "result": {
                        "encoding": "utf8",
                        "compress": "raw",
                        "format": "json"
                    }
                }
            },
            "payload": {
                "image": {
                    "encoding": "jpg",
                    "image": image_base64,
                    "status": 3
                }
            }
        }

        auth_url = self._build_auth_url(self.api_url)
        headers = {
            'content-type': "application/json",
            'host': urlparse(self.api_url).hostname,
            'app_id': self.app_id
        }

        response = requests.post(auth_url, data=json.dumps(request_data), headers=headers)
        response.raise_for_status()
        
        result = response.json()
        if result.get('header', {}).get('code') != 0:
            return result

        payload_text = result.get('payload', {}).get('result', {}).get('text', '')
        if payload_text:
            decoded_text = base64.b64decode(payload_text).decode('utf-8')
            return json.loads(decoded_text)
        
        return result

    def recognize_evidence(self, image_path: str, evidence_type: EvidenceType) -> dict:
        """识别证据并返回业务可用的evidence_features格式
        
        Args:
            image_path: 图片路径或URL
            evidence_type: 证据类型
            
        Returns:
            dict: 包含OCR结果和evidence_features的字典
        """
        # 获取OCR类型
        ocr_type = self._get_ocr_type(evidence_type)
        
        # 调用通用票证识别
        ocr_result = self.recognize_ticket(image_path, ocr_type)
        
        # 检查是否有错误
        if 'error' in ocr_result:
            return ocr_result
        
        # 解析OCR结果为业务格式
        evidence_features = self._parse_ocr_result(ocr_result, evidence_type)
        
        return {
            "ocr_result": ocr_result,
            "evidence_features": evidence_features
        }

    def recognize_general_text(self, image_source: str) -> dict:
        """通用文字识别."""
        try:
            image_data = self._get_image_content(image_source)
            image_base64 = base64.b64encode(image_data).decode('utf-8')
        except Exception as e:
            return {"error": f"Failed to read image source: {e}"}

        request_data = {
            "header": {
                "app_id": self.app_id,
                "status": 3
            },
            "parameter": {
                "sf8e6aca1": {
                    "category": "ch_en_public_cloud",
                    "result": {
                        "encoding": "utf8",
                        "compress": "raw",
                        "format": "json"
                    }
                }
            },
            "payload": {
                "sf8e6aca1_data_1": {
                    "encoding": "jpg",
                    "image": image_base64,
                    "status": 3
                }
            }
        }

        auth_url = self._build_auth_url(self.general_api_url)
        headers = {
            'content-type': "application/json",
            'host': urlparse(self.general_api_url).hostname,
            'app_id': self.app_id
        }

        response = requests.post(auth_url, data=json.dumps(request_data), headers=headers)
        response.raise_for_status()
        result = response.json()

        if result.get('header', {}).get('code') != 0:
            return result

        payload_text = result.get('payload', {}).get('result', {}).get('text', '')
        if payload_text:
            decoded_text = base64.b64decode(payload_text).decode('utf-8')
            return json.loads(decoded_text)

        return result


class XunfeiOcrService:
    """讯飞OCR服务集成类"""
    
    def __init__(self):
        self.client = XunfeiOcrClient()
    
    def extract_evidence_features(self, image_url: str, evidence_type: str) -> dict:
        """根据证据类型提取特征信息
        
        Args:
            image_url: 图片URL
            evidence_type: 证据类型字符串
            
        Returns:
            dict: 包含OCR结果和evidence_features的字典
        """
        try:
            # 将字符串转换为枚举
            evidence_type_enum = EvidenceType(evidence_type)
            
            result = self.client.recognize_evidence(image_url, evidence_type_enum)
            return result
        except ValueError:
            return {
                "error": f"暂不支持的证据类型: {evidence_type}",
                "evidence_features": []
            }
        except Exception as e:
            return {
                "error": f"OCR识别失败: {str(e)}",
                "evidence_features": []
            }


if __name__ == '__main__':
    # Initialize the XunfeiOcrClient
    client = XunfeiOcrClient()

    # --- Test Business License Recognition ---
    image1 = 'https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250722142654_营业执照.png'
    image2 = 'https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/images/20250722110609_身份证正面.png'
    image3 = 'https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/c1625a42ffec408d9c97acb821dbb75e_微信截图_20240527180019.png'  # 个体工商户营业执照
    image4 = 'https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/41f3d0bf6477454c9edbb801deb44065_发票.png'
    image5 = 'https://hui-ai-lawyer-1309488351.cos.ap-guangzhou.myqcloud.com/uploads/debug/edd9060524874a6fbba0d77094e80efd_苏州市立松鞋业有限公司.png'  # 公示系统营业执照

    # 使用新的通用方法测试个体工商户公示系统营业执照
    res = client.recognize_evidence(image3, EvidenceType.INDIVIDUAL_GSXT_LICENSE)

    print(json.dumps(res, indent=4, ensure_ascii=False))


