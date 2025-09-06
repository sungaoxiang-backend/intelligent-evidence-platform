# app/wecom/services.py
import httpx
import time
import base64
import hashlib
import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
import logging
import urllib.parse

from app.core.config import settings

logger = logging.getLogger(__name__)


class WeComService:
    """企业微信服务管理器 - 单例模式"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WeComService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._initialize()
            self._initialized = True

    def _initialize(self):
        """初始化配置"""
        self.corp_id = settings.WECOM_CORP_ID
        self.corp_secret = settings.WECOM_CORP_SECRET
        self.agent_id = settings.WECOM_AGENT_ID
        self.token = settings.WECOM_TOKEN
        self.encoding_aes_key = settings.WECOM_ENCODING_AES_KEY
        self.callback_url = settings.WECOM_CALLBACK_URL

        # 运行时状态
        self.access_token: Optional[str] = None
        self.token_expires_at: float = 0
        self.client = httpx.AsyncClient(timeout=30.0)

        logger.info(f"WeCom服务初始化完成 - CorpID: {self.corp_id}, AgentID: {self.agent_id}")

    async def close(self):
        """关闭服务"""
        await self.client.aclose()

    async def get_access_token(self) -> Optional[str]:
        """获取access_token"""
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token

        url = "https://qyapi.weixin.qq.com/cgi-bin/gettoken"
        params = {"corpid": self.corp_id, "corpsecret": self.corp_secret}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()

            if data["errcode"] == 0:
                self.access_token = data["access_token"]
                self.token_expires_at = time.time() + data["expires_in"] - 60
                return self.access_token
            else:
                error_msg = f"获取access_token失败: {data}"
                logger.error(error_msg)
                raise Exception(error_msg)
        except Exception as e:
            error_msg = f"获取access_token异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

    def verify_signature(
        self, signature: str, timestamp: str, nonce: str, echostr: str = None, msg_encrypt: str = None
    ) -> bool:
        """验证签名 - 支持URL验证和消息接收两种模式"""
        try:

            # URL验证阶段：使用token、timestamp、nonce、echostr四个参数
            # 消息接收阶段：使用token、timestamp、nonce、msg_encrypt四个参数
            if echostr is not None:
                # URL验证阶段 - 使用四个参数（包含echostr）
                tmp_list = [self.token, timestamp, nonce, echostr]
            elif msg_encrypt:
                # 消息接收阶段 - 使用四个参数  
                tmp_list = [self.token, timestamp, nonce, msg_encrypt]
            else:
                # 默认使用三个参数（不应该到达这里）
                tmp_list = [self.token, timestamp, nonce]
                
            tmp_list.sort()
            tmp_str = "".join(tmp_list)

            # 计算SHA1
            sha1 = hashlib.sha1(tmp_str.encode("utf-8")).hexdigest()
            return sha1 == signature
        except Exception as e:
            logger.error(f"签名验证异常: {e}")
            return False

    def decrypt_message(self, encrypted_msg: str) -> str:
        """解密消息"""
        try:
            # URL解码
            encrypted_msg_decoded = urllib.parse.unquote(encrypted_msg)

            # Base64解码
            encrypted_data = base64.b64decode(encrypted_msg_decoded)

            # 获取AES密钥 - 根据官方文档：AESKey = Base64_Decode(EncodingAESKey + "=")
            aes_key = base64.b64decode(self.encoding_aes_key + "=")

            # 获取IV - 根据官方文档，IV是AES密钥的前16字节
            iv = aes_key[:16]

            # 解密 - 使用正确的IV
            cipher = AES.new(aes_key, AES.MODE_CBC, iv)
            decrypted_data = cipher.decrypt(encrypted_data)

            # 去除填充
            decrypted_data = unpad(decrypted_data, AES.block_size)

            # 根据官方文档伪代码实现解密
            # content = rand_msg[16:]  # 去掉前16随机字节
            content = decrypted_data[16:]
            
            # msg_len = str_to_uint(content[0:4]) # 取出4字节的msg_len
            msg_len_bytes = content[0:4]
            content_length = int.from_bytes(msg_len_bytes, "big")
            
            # msg = content[4:msg_len+4] # 截取msg_len 长度的msg
            msg_content = content[4:4 + content_length]
            
            # receiveid = content[msg_len+4:] # 剩余字节为receiveid
            receive_id = content[4 + content_length:].decode("utf-8")
            
            # 企业微信要求返回的是msg字段的内容
            final_content = msg_content.decode("utf-8")
            return final_content
        except Exception as e:
            error_msg = f"消息解密失败: {e}"
            logger.error(f"消息解密异常: {error_msg}")
            raise Exception(error_msg)

    def parse_callback_event(self, decrypted_msg: str) -> Optional[Dict[str, Any]]:
        """解析回调事件"""
        try:
            root = ET.fromstring(decrypted_msg)
            event_data = {}
            for child in root:
                event_data[child.tag] = child.text
            return event_data
        except Exception as e:
            logger.error(f"解析回调事件失败: {e}")
            return None

    async def create_contact_way(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建联系方式"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_contact_way"
        access_token = await self.get_access_token()
        params = {"access_token": access_token}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, json=contact_data)
                data = response.json()

            return data
        except Exception as e:
            error_msg = f"创建联系方式异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def send_welcome_msg(self, welcome_data: Dict[str, Any]) -> Dict[str, Any]:
        """发送欢迎语"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/externalcontact/send_welcome_msg"
        access_token = await self.get_access_token()
        params = {"access_token": access_token}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, json=welcome_data)
                data = response.json()

            return data
        except Exception as e:
            error_msg = f"发送欢迎语异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def get_external_contact(self, external_userid: str) -> Dict[str, Any]:
        """获取客户详情"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/externalcontact/get_external_contact"
        access_token = await self.get_access_token()
        params = {"access_token": access_token}
        data = {"external_userid": external_userid}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, json=data)
                result = response.json()

            return result
        except Exception as e:
            error_msg = f"获取客户详情异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

# 创建全局实例
wecom_service = WeComService()
