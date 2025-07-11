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

    def recognize_ticket(self, image_path: str, ticket_type: str) -> dict:
        """通用票证识别（单张图片）."""
        try:
            image_data = self._get_image_content(image_path)
        except Exception as e:
            # 考虑在这里返回一个标准的错误格式
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
                    "encoding": "jpg", # Or other format like png
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
        response.raise_for_status() # Raise an exception for bad status codes
        
        result = response.json()
        # 根据讯飞文档，需要检查响应头中的code
        if result.get('header', {}).get('code') != 0:
            return result # 返回包含错误信息的完整响应

        # 提取并返回结构化结果
        # 注意：这里的路径可能需要根据实际返回的JSON结构进行调整
        payload_text = result.get('payload', {}).get('result', {}).get('text', '')
        if payload_text:
            # 响应体中的text是base64编码的json字符串
            decoded_text = base64.b64decode(payload_text).decode('utf-8')
            return json.loads(decoded_text)
        
        return result # 如果没有找到期望的结果，返回原始响应

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
                "sf8e6aca1": { # 此处sf8e6aca1为通用文字识别服务ID，固定值
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

if __name__ == '__main__':
    # Initialize the XunfeiOcrClient
    client = XunfeiOcrClient()

    # --- Test Ticket Recognition ---
    print("--- Testing Ticket Recognition ---")
    # Test with a local file path
    ticket_test_image_path = 'app/ocr_demos/TicketIdentification-python-demo/resource/input/img_1.png'
    print(f"Recognizing ticket from image: {ticket_test_image_path}")
    ticket_result = client.recognize_ticket(ticket_test_image_path, 'vat_invoice')
    print("--- Recognition Result ---")
    print(json.dumps(ticket_result, indent=4, ensure_ascii=False))
    print("--------------------------")

    # Test with an image URL
    ticket_test_image_url = 'https://img.aigcopen.com/aigc/2024-07-15/1721029823989_149.jpg'
    print(f"Recognizing ticket from URL: {ticket_test_image_url}")
    ticket_result_url = client.recognize_ticket(ticket_test_image_url, 'bank_card')
    print("--- Recognition Result ---")
    print(json.dumps(ticket_result_url, indent=4, ensure_ascii=False))
    print("--------------------------")

    # --- Test General Text Recognition ---
    print("\n--- Testing General Text Recognition ---")
    # Test general text recognition

    # if not os.path.exists(test_image_path):
    #     print(f"Error: Test image not found at '{test_image_path}'")
    #     print("Please update the 'test_image_path' variable in the script.")
    # else:
    #     try:
    #         print(f"\n--- Testing Ticket Recognition ---")
    #         print(f"Recognizing ticket '{ticket_type}' from image: {test_image_path}")
    #         result_data = client.recognize_ticket(test_image_path, ticket_type)
    #         print("--- Recognition Result ---")
    #         print(json.dumps(result_data, indent=4, ensure_ascii=False))
    #         print("--------------------------")

    #         print(f"\n--- Testing Ticket Recognition from URL ---")
    #         print(f"Recognizing ticket '{url_ticket_type}' from URL: {test_image_url}")
    #         result_data_url = client.recognize_ticket(test_image_url, url_ticket_type)
    #         print("--- Recognition Result ---")
    #         print(json.dumps(result_data_url, indent=4, ensure_ascii=False))
    #         print("--------------------------")

    #     except Exception as e:
    #         print(f"An error occurred during ticket recognition: {e}")

