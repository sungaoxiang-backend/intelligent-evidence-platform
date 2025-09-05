# app/wecom/services.py
import httpx
import time
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
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

        logger.info(
            f"WeCom服务初始化完成 - CorpID: {self.corp_id}, AgentID: {self.agent_id}"
        )
        logger.info(f"回调URL: {self.callback_url}")
        logger.info(f"Token: {self.token}")
        logger.info(f"EncodingAESKey: {self.encoding_aes_key}")

    async def close(self):
        """关闭服务"""
        await self.client.aclose()
        logger.info("WeCom服务已关闭")

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
                logger.info("Access token获取成功")
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
        self, signature: str, timestamp: str, nonce: str, echostr: str
    ) -> bool:
        """验证签名"""
        try:
            logger.info("=== 开始签名验证 ===")
            logger.info(f"接收到的参数:")
            logger.info(f"  - signature: {signature}")
            logger.info(f"  - timestamp: {timestamp}")
            logger.info(f"  - nonce: {nonce}")
            logger.info(f"  - echostr: {echostr}")
            logger.info(f"  - token: {self.token}")

            # URL解码 echostr
            echostr_decoded = urllib.parse.unquote(echostr)
            logger.info(f"URL解码后的echostr: {echostr_decoded}")

            # 构建签名字符串
            tmp_list = [self.token, timestamp, nonce, echostr_decoded]
            tmp_list.sort()
            tmp_str = "".join(tmp_list)
            logger.info(f"排序后的字符串: {tmp_str}")

            # 计算SHA1
            sha1 = hashlib.sha1(tmp_str.encode("utf-8")).hexdigest()
            logger.info(f"计算得到的签名: {sha1}")
            logger.info(f"接收到的签名: {signature}")

            is_valid = sha1 == signature
            logger.info(f"签名验证结果: {'通过' if is_valid else '失败'}")
            logger.info("=== 签名验证结束 ===")

            return is_valid
        except Exception as e:
            logger.error(f"签名验证异常: {e}")
            return False

    def decrypt_message(self, encrypted_msg: str) -> str:
        """解密消息"""
        try:
            logger.info("=== 开始消息解密 ===")
            logger.info(f"接收到的加密消息: {encrypted_msg}")

            # URL解码
            encrypted_msg_decoded = urllib.parse.unquote(encrypted_msg)
            logger.info(f"URL解码后的加密消息: {encrypted_msg_decoded}")

            # Base64解码
            encrypted_data = base64.b64decode(encrypted_msg_decoded)
            logger.info(f"Base64解码后的数据长度: {len(encrypted_data)}")

            # 获取AES密钥
            aes_key = base64.b64decode(self.encoding_aes_key + "=")
            logger.info(f"AES密钥长度: {len(aes_key)}")

            # 解密
            cipher = AES.new(aes_key, AES.MODE_CBC, encrypted_data[:16])
            decrypted_data = cipher.decrypt(encrypted_data[16:])
            logger.info(f"解密后的数据长度: {len(decrypted_data)}")

            # 去除填充
            decrypted_data = unpad(decrypted_data, AES.block_size)
            logger.info(f"去除填充后的数据长度: {len(decrypted_data)}")

            # 获取消息内容
            content_length = int.from_bytes(decrypted_data[16:20], "big")
            logger.info(f"消息内容长度: {content_length}")

            content = decrypted_data[20 : 20 + content_length].decode("utf-8")
            logger.info(f"解密后的消息内容: {content}")
            logger.info("=== 消息解密结束 ===")

            return content
        except Exception as e:
            error_msg = f"消息解密失败: {e}"
            logger.error(f"=== 消息解密异常 ===")
            logger.error(f"异常类型: {type(e).__name__}")
            logger.error(f"异常信息: {str(e)}")
            logger.error(f"加密消息: {encrypted_msg}")
            logger.error("=== 消息解密异常结束 ===")
            raise Exception(error_msg)

    def parse_callback_event(self, decrypted_msg: str) -> Optional[Dict[str, Any]]:
        """解析回调事件"""
        try:
            logger.info("=== 开始解析回调事件 ===")
            logger.info(f"解密后的消息: {decrypted_msg}")

            root = ET.fromstring(decrypted_msg)
            logger.info(f"XML根节点: {root.tag}")

            event_data = {}
            for child in root:
                event_data[child.tag] = child.text
                logger.info(f"解析到字段: {child.tag} = {child.text}")

            logger.info(f"解析完成的事件数据: {event_data}")
            logger.info("=== 解析回调事件结束 ===")
            return event_data
        except Exception as e:
            logger.error(f"解析回调事件失败: {e}")
            logger.error(f"解密后的消息: {decrypted_msg}")
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

            if data["errcode"] == 0:
                logger.info(f"创建联系方式成功: {data}")
            else:
                logger.error(f"创建联系方式失败: {data}")

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

            if data["errcode"] == 0:
                logger.info("欢迎语发送成功")
            else:
                logger.error(f"欢迎语发送失败: {data}")

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

            if result["errcode"] == 0:
                logger.info(f"获取客户详情成功: {external_userid}")
            else:
                logger.error(f"获取客户详情失败: {result}")

            return result
        except Exception as e:
            error_msg = f"获取客户详情异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

# 创建全局实例
wecom_service = WeComService()
