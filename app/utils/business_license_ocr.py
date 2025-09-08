import base64
import hashlib
import hmac
import json
from datetime import datetime
from time import mktime
from urllib.parse import urlencode, urlparse
from wsgiref.handlers import format_date_time

import requests

from app.core.config import settings


class BusinessLicenseOcrClient:
    """讯飞营业执照识别客户端"""

    def __init__(self):
        self.app_id = settings.XUNFEI_OCR_APP_ID
        self.api_key = settings.XUNFEI_OCR_API_KEY
        self.api_secret = settings.XUNFEI_OCR_API_SECRET
        self.base_url = "https://webapi.xfyun.cn/v1/service/v1/ocr/business_license"

    def _build_auth_url(self, url: str, method: str = "POST") -> str:
        """构建带鉴权参数的URL - 参照xunfei_ocr.py的实现"""
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
        """从路径或URL获取图片内容 - 参照xunfei_ocr.py的实现"""
        if image_source.startswith(('http://', 'https://')):
            response = requests.get(image_source)
            response.raise_for_status()
            return response.content
        else:
            with open(image_source, "rb") as f:
                return f.read()

    def recognize_business_license(self, image_url: str) -> dict:
        """
        识别营业执照 - 参照xunfei_ocr.py的recognize_ticket方法
        
        Args:
            image_url: 图片URL
            
        Returns:
            dict: 识别结果
        """
        try:
            # 获取图片内容
            print(f"正在下载图片: {image_url}")
            image_data = self._get_image_content(image_url)
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            print(f"图片下载成功，大小: {len(image_base64)} 字符")

            # 构建请求数据 - 参照xunfei_ocr.py的格式
            request_data = {
                "header": {
                    "app_id": self.app_id,
                    "status": 3
                },
                "parameter": {
                    "ocr": {
                        "type": "bus_license",  # 营业执照类型
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

            # 构建鉴权URL
            auth_url = self._build_auth_url(self.base_url)
            headers = {
                'content-type': "application/json",
                'host': urlparse(self.base_url).hostname,
                'app_id': self.app_id
            }

            print(f"正在发送请求到: {auth_url}")
            response = requests.post(auth_url, data=json.dumps(request_data), headers=headers)
            response.raise_for_status()
            
            result = response.json()
            print(f"讯飞API响应: {result}")
            
            # 检查响应状态 - 参照xunfei_ocr.py的检查方式
            if result.get('header', {}).get('code') != 0:
                return {
                    'error': f"OCR识别失败: {result.get('header', {}).get('message', '未知错误')}"
                }

            # 解析payload中的结果 - 参照xunfei_ocr.py的解析方式
            payload_text = result.get('payload', {}).get('result', {}).get('text', '')
            if payload_text:
                decoded_text = base64.b64decode(payload_text).decode('utf-8')
                ocr_result = json.loads(decoded_text)
                print(f"解码后的OCR结果: {ocr_result}")
                return self._parse_ocr_result(ocr_result)
            
            return {
                'error': "OCR识别结果为空"
            }

        except requests.exceptions.RequestException as e:
            return {
                'error': f"网络请求失败: {str(e)}"
            }
        except Exception as e:
            return {
                'error': f"OCR识别失败: {str(e)}"
            }

    def _parse_ocr_result(self, ocr_result: dict) -> dict:
        """
        解析OCR识别结果 - 参照xunfei_ocr.py的解析方式
        
        Args:
            ocr_result: OCR返回的原始数据
            
        Returns:
            dict: 解析后的结果
        """
        try:
            # 提取关键信息
            result = {
                'company_name': '',
                'name': '',
                'company_address': '',
                'company_code': '',
                'company_type': '',
                'registered_capital': '',
                'establishment_date': '',
                'business_scope': ''
            }

            if not ocr_result or 'object_list' not in ocr_result:
                return result

            # 遍历object_list查找营业执照对象
            for obj in ocr_result.get('object_list', []):
                if obj.get('type') != 'bus_license':
                    continue
                    
                # 遍历region_list提取字段
                for region in obj.get('region_list', []):
                    region_type = region.get('type')
                    
                    # 提取文本内容
                    slot_value = ""
                    for text_block in region.get('text_block_list', []):
                        slot_value = text_block.get('value', '')
                        break  # 取第一个文本块
                    
                    # 根据region_type映射到我们的字段
                    if region_type == 'bl-company-name':
                        result['company_name'] = slot_value
                    elif region_type == 'bl-owner-name':
                        result['name'] = slot_value
                    elif region_type == 'bl-corporate-residence':
                        result['company_address'] = slot_value
                    elif region_type == 'bl-code':
                        result['company_code'] = slot_value
                    elif region_type == 'bl-type':
                        result['company_type'] = slot_value
                    elif region_type == 'bl-date':
                        result['establishment_date'] = slot_value

            return result

        except Exception as e:
            return {
                'error': f"解析OCR结果失败: {str(e)}"
            }


# 使用示例
if __name__ == '__main__':
    client = BusinessLicenseOcrClient()
    result = client.recognize_business_license("https://example.com/business_license.jpg")
    print(json.dumps(result, ensure_ascii=False, indent=2))
