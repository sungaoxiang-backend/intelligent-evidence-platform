# app/wecom/services.py
import httpx
import time
import base64
import hashlib
import os
from datetime import datetime
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad, pad
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional
import logging
import urllib.parse

from app.core.config import settings
from app.wecom.models import (
    WeComStaff, ExternalContact, CustomerSession, ContactWay, CustomerEventLog,
    WeComStaffStatus, ExternalContactStatus, ContactType
)
from app.db.session import SessionLocal
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

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
        """解析回调事件 - 增强版本，支持所有事件类型"""
        try:
            root = ET.fromstring(decrypted_msg)
            event_data = {}
            
            # 解析所有字段
            for child in root:
                event_data[child.tag] = child.text
            
            # 标准化事件数据
            event_data['MsgType'] = event_data.get('MsgType', '')
            event_data['Event'] = event_data.get('Event', '')
            event_data['EventKey'] = event_data.get('EventKey', '')
            event_data['ToUserName'] = event_data.get('ToUserName', '')
            event_data['FromUserName'] = event_data.get('FromUserName', '')
            event_data['CreateTime'] = event_data.get('CreateTime', '')
            
            # 记录关键事件信息用于调试
            logger.info(f"事件解析成功 - MsgType: {event_data['MsgType']}, Event: {event_data['Event']}, From: {event_data['FromUserName']}")
            
            return event_data
        except Exception as e:
            logger.error(f"解析回调事件失败: {e}")
            logger.error(f"原始XML内容: {decrypted_msg[:200]}...")  # 只记录前200字符避免日志过长
            return None

    async def create_contact_way(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        """创建联系方式 - 企业微信官方标准版本，严格遵循文档规范"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_contact_way"
        access_token = await self.get_access_token()
        params = {"access_token": access_token}

        try:
            # ===== 严格参数验证 - 遵循官方文档 =====
            
            # 1. 必填参数检查
            if 'type' not in contact_data:
                raise Exception("缺少必需参数: type (联系方式类型)")
            if 'scene' not in contact_data:
                raise Exception("缺少必需参数: scene (场景)")
            
            # 2. 参数类型和范围验证
            contact_type = contact_data.get('type')
            scene = contact_data.get('scene')
            
            # type 范围验证
            valid_types = {1, 2, 3} | set(range(10, 41))  # 1-3, 10-40
            if contact_type not in valid_types:
                raise Exception(f"无效的type参数: {contact_type}，有效范围: 1-3, 10-40")
            
            # scene 范围验证  
            if scene not in {1, 2}:
                raise Exception(f"无效的scene参数: {scene}，有效值: 1, 2")
            
            # 3. type/scene 组合验证（关键！）
            type_scene_rules = {
                1: {1},      # 单人联系方式，仅支持场景1
                2: {2},      # 多人联系方式，仅支持场景2  
                3: {1},      # 单人二维码，仅支持场景1
            }
            
            # 对于type≥10的规则（10-40仅支持scene=2）
            if contact_type >= 10:
                if scene != 2:
                    raise Exception(f"type={contact_type} 仅支持 scene=2，当前scene={scene}")
            elif contact_type in type_scene_rules:
                if scene not in type_scene_rules[contact_type]:
                    raise Exception(f"type={contact_type} 仅支持 scene={type_scene_rules[contact_type]}，当前scene={scene}")
            
            # 4. userid 参数验证（官方文档要求的是userid，不是user！）
            userid = contact_data.get('userid')
            if not userid:
                # 兼容我们之前的user参数
                user_list = contact_data.get('user', [])
                if user_list and isinstance(user_list, list) and len(user_list) > 0:
                    userid = user_list[0]  # 取第一个用户
                    contact_data['userid'] = userid  # 转换为官方格式
                    # 移除旧的user参数，避免企微API报错
                    if 'user' in contact_data:
                        del contact_data['user']
                else:
                    raise Exception("缺少必需参数: userid (成员UserID)")
            
            # 5. 验证员工存在性和权限
            user_detail = await self.get_user_detail(userid)
            if user_detail.get('errcode') != 0:
                raise Exception(f"员工不存在或无权限 - UserID: {userid}, 错误: {user_detail.get('errmsg')}")
            
            # 6. 特殊类型验证
            if contact_type == 2:  # 多人联系方式
                party = contact_data.get('party')
                if not party:
                    logger.warning("多人联系方式（type=2）建议指定 party 参数，否则可能创建失败")
            
            # ===== 智能参数设置 =====
            
            # 自动设置回调所需的参数
            if 'skip_verify' not in contact_data:
                contact_data['skip_verify'] = 0  # 必须设为0才能触发事件
            
            # 如果没有state，自动生成一个
            if 'state' not in contact_data:
                contact_data['state'] = f"api_created_{int(time.time())}"
            
            # 确保参数类型正确
            if isinstance(contact_data.get('skip_verify'), bool):
                contact_data['skip_verify'] = 1 if contact_data['skip_verify'] else 0
            
            logger.info(f"创建联系方式请求参数: {contact_data}")

            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, json=contact_data)
                data = response.json()

            if data.get('errcode') == 0:
                logger.info(f"联系方式创建成功 - config_id: {data.get('config_id')}")
                
                # 保存到数据库
                await self._save_contact_way(data, contact_data)
                
                # 返回增强数据，包含回调URL
                enhanced_data = data.copy()
                enhanced_data['callback_enabled_url'] = self._build_callback_url(data.get('config_id'), contact_data.get('state'))
                enhanced_data['qr_code_url'] = data.get('qr_code')
                
                return enhanced_data
            else:
                error_msg = f"创建联系方式失败 - 错误码: {data.get('errcode')}, 错误信息: {data.get('errmsg')}"
                logger.error(error_msg)
                raise Exception(error_msg)
                
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

    async def handle_customer_add_event(self, event_data: Dict[str, Any]) -> bool:
        """处理添加企业客户事件 - 增强版本，确保数据持久化"""
        try:
            user_id = event_data.get('UserID')
            external_user_id = event_data.get('ExternalUserID')
            welcome_code = event_data.get('WelcomeCode')
            state = event_data.get('State', '')
            
            logger.info(f"[CUSTOMER_ADD] 开始处理添加企业客户事件 - User: {user_id}, External: {external_user_id}, State: {state}, WelcomeCode: {'有' if welcome_code else '无'}")
            
            # 事件开始时间
            start_time = datetime.now()
            
            async with SessionLocal() as session:
                # 1. 获取或创建员工记录
                logger.info(f"[CUSTOMER_ADD] 步骤1: 获取员工记录 - UserID: {user_id}")
                staff_stmt = select(WeComStaff).where(WeComStaff.user_id == user_id)
                staff_result = await session.execute(staff_stmt)
                staff = staff_result.scalar_one_or_none()
                
                if not staff:
                    logger.info(f"[CUSTOMER_ADD] 员工不存在，创建基础记录 - UserID: {user_id}")
                    staff = WeComStaff(
                        user_id=user_id,
                        name=user_id,  # 临时使用UserID作为名称
                        status=WeComStaffStatus.ACTIVE
                    )
                    session.add(staff)
                    await session.flush()
                    logger.info(f"[CUSTOMER_ADD] 员工记录创建成功 - ID: {staff.id}")
                else:
                    logger.info(f"[CUSTOMER_ADD] 找到现有员工记录 - ID: {staff.id}, Name: {staff.name}")
                
                # 2. 获取外部联系人详情
                logger.info(f"[CUSTOMER_ADD] 步骤2: 获取外部联系人详情 - ExternalUserID: {external_user_id}")
                try:
                    contact_info = await self.get_external_contact(external_user_id)
                    if contact_info.get('errcode') != 0:
                        logger.warning(f"[CUSTOMER_ADD] 获取外部联系人详情失败 - ExternalUserID: {external_user_id}, 错误: {contact_info}")
                        # 即使获取详情失败，也继续处理，使用基础信息
                        contact_data = {}
                    else:
                        contact_data = contact_info.get('external_contact', {})
                        logger.info(f"[CUSTOMER_ADD] 获取外部联系人详情成功 - Name: {contact_data.get('name')}, Type: {contact_data.get('type')}")
                except Exception as e:
                    logger.error(f"[CUSTOMER_ADD] 获取外部联系人详情异常 - ExternalUserID: {external_user_id}, 错误: {e}")
                    # 即使获取详情失败，也继续处理，使用基础信息
                    contact_data = {}
                
                # 3. 创建外部联系人记录
                logger.info(f"[CUSTOMER_ADD] 步骤3: 创建外部联系人记录 - ExternalUserID: {external_user_id}")
                external_contact = ExternalContact(
                    external_user_id=external_user_id,
                    name=contact_data.get('name', ''),
                    avatar=contact_data.get('avatar', ''),
                    type=contact_data.get('type', 1),
                    gender=contact_data.get('gender'),
                    union_id=contact_data.get('unionid'),
                    corp_name=contact_data.get('corp_name', ''),
                    corp_full_name=contact_data.get('corp_full_name', ''),
                    status=ExternalContactStatus.NORMAL,
                    contact_type=ContactType.FULL,
                    staff_id=staff.id
                )
                session.add(external_contact)
                await session.flush()
                logger.info(f"[CUSTOMER_ADD] 外部联系人记录创建成功 - ID: {external_contact.id}, Name: {external_contact.name}")
                
                # 4. 创建客户会话
                logger.info(f"[CUSTOMER_ADD] 步骤4: 创建客户会话 - StaffID: {staff.id}, ExternalContactID: {external_contact.id}")
                session_record = CustomerSession(
                    session_id=f"{user_id}_{external_user_id}_{int(datetime.now().timestamp())}",
                    staff_id=staff.id,
                    external_contact_id=external_contact.id,
                    source="external_contact_add",
                    state=state,
                    is_active=True,
                    started_at=datetime.now()
                )
                session.add(session_record)
                logger.info(f"[CUSTOMER_ADD] 客户会话创建成功 - SessionID: {session_record.session_id}")
                
                # 5. 记录事件日志
                logger.info(f"[CUSTOMER_ADD] 步骤5: 记录事件日志 - StaffUserID: {user_id}, ExternalUserID: {external_user_id}")
                event_log = CustomerEventLog(
                    event_type="change_external_contact",
                    change_type="add_external_contact",
                    staff_user_id=user_id,
                    external_user_id=external_user_id,
                    event_data=event_data,
                    status="success",
                    welcome_code=welcome_code,
                    state=state
                )
                session.add(event_log)
                
                logger.info(f"[CUSTOMER_ADD] 步骤6: 提交数据库事务")
                await session.commit()
                logger.info(f"[CUSTOMER_ADD] 数据库事务提交成功")
                
                # 7. 发送欢迎语（异步调用，不影响主流程）
                if welcome_code:
                    try:
                        logger.info(f"[CUSTOMER_ADD] 步骤7: 异步发送欢迎语 - WelcomeCode: {welcome_code[:20]}...")
                        await self.send_welcome_msg_async(welcome_code)
                        logger.info(f"[CUSTOMER_ADD] 欢迎语发送成功 - WelcomeCode: {welcome_code[:20]}...")
                    except Exception as e:
                        logger.warning(f"[CUSTOMER_ADD] 欢迎语发送失败，但不影响主流程 - {e}")
                
                # 8. 记录处理完成
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()
                logger.info(f"[CUSTOMER_ADD] ✅ 添加企业客户事件处理完成 - User: {user_id}, External: {external_user_id}, 耗时: {duration:.2f}s")
                return True
                
        except Exception as e:
            logger.error(f"[CUSTOMER_ADD] ❌ 处理添加企业客户事件失败: {e}")
            # 记录失败日志
            await self._log_event_error("add_external_contact", event_data, str(e))
            return False

    async def handle_customer_edit_event(self, event_data: Dict[str, Any]) -> bool:
        """处理编辑企业客户事件"""
        try:
            user_id = event_data.get('UserID')
            external_user_id = event_data.get('ExternalUserID')
            
            logger.info(f"处理编辑企业客户事件 - User: {user_id}, External: {external_user_id}")
            
            async with SessionLocal() as session:
                # 1. 查找现有外部联系人
                contact_stmt = select(ExternalContact).where(
                    ExternalContact.external_user_id == external_user_id,
                    ExternalContact.status == ExternalContactStatus.NORMAL
                ).options(selectinload(ExternalContact.staff))
                
                contact_result = await session.execute(contact_stmt)
                contact = contact_result.scalar_one_or_none()
                
                if not contact:
                    logger.warning(f"未找到外部联系人记录 - ExternalUserID: {external_user_id}")
                    # 如果找不到，可能需要创建新记录（降级为添加事件）
                    return await self.handle_customer_add_event(event_data)
                
                # 2. 获取最新联系人详情
                contact_info = await self.get_external_contact(external_user_id)
                if contact_info.get('errcode') != 0:
                    logger.error(f"获取外部联系人详情失败 - ExternalUserID: {external_user_id}")
                    return False
                
                contact_data = contact_info.get('external_contact', {})
                
                # 3. 更新联系人信息
                contact.name = contact_data.get('name', contact.name)
                contact.avatar = contact_data.get('avatar', contact.avatar)
                contact.gender = contact_data.get('gender', contact.gender)
                contact.union_id = contact_data.get('unionid', contact.union_id)
                contact.corp_name = contact_data.get('corp_name', contact.corp_name)
                contact.corp_full_name = contact_data.get('corp_full_name', contact.corp_full_name)
                contact.updated_at = datetime.now()
                
                # 4. 记录事件日志
                event_log = CustomerEventLog(
                    event_type="change_external_contact",
                    change_type="edit_external_contact",
                    staff_user_id=user_id,
                    external_user_id=external_user_id,
                    event_data=event_data,
                    status="success"
                )
                session.add(event_log)
                
                await session.commit()
                
                logger.info(f"编辑企业客户事件处理成功 - User: {user_id}, External: {external_user_id}")
                return True
                
        except Exception as e:
            logger.error(f"处理编辑企业客户事件失败: {e}")
            await self._log_event_error("edit_external_contact", event_data, str(e))
            return False

    async def handle_customer_delete_event(self, event_data: Dict[str, Any]) -> bool:
        """处理删除企业客户事件"""
        try:
            user_id = event_data.get('UserID')
            external_user_id = event_data.get('ExternalUserID')
            
            logger.info(f"处理删除企业客户事件 - User: {user_id}, External: {external_user_id}")
            
            async with SessionLocal() as session:
                # 1. 查找现有外部联系人
                contact_stmt = select(ExternalContact).where(
                    ExternalContact.external_user_id == external_user_id,
                    ExternalContact.status == ExternalContactStatus.NORMAL
                )
                
                contact_result = await session.execute(contact_stmt)
                contact = contact_result.scalar_one_or_none()
                
                if not contact:
                    logger.warning(f"未找到外部联系人记录 - ExternalUserID: {external_user_id}")
                    return True  # 已经删除或不存在，也算成功
                
                # 2. 更新联系人状态为已删除
                contact.status = ExternalContactStatus.DELETED
                contact.updated_at = datetime.now()
                
                # 3. 关闭相关会话
                session_stmt = select(CustomerSession).where(
                    CustomerSession.external_contact_id == contact.id,
                    CustomerSession.is_active == True
                )
                session_result = await session.execute(session_stmt)
                sessions = session_result.scalars().all()
                
                for session_record in sessions:
                    session_record.is_active = False
                    session_record.ended_at = datetime.now()
                
                # 4. 记录事件日志
                event_log = CustomerEventLog(
                    event_type="change_external_contact",
                    change_type="del_external_contact",
                    staff_user_id=user_id,
                    external_user_id=external_user_id,
                    event_data=event_data,
                    status="success"
                )
                session.add(event_log)
                
                await session.commit()
                
                logger.info(f"删除企业客户事件处理成功 - User: {user_id}, External: {external_user_id}")
                return True
                
        except Exception as e:
            logger.error(f"处理删除企业客户事件失败: {e}")
            await self._log_event_error("del_external_contact", event_data, str(e))
            return False

    async def handle_half_customer_add_event(self, event_data: Dict[str, Any]) -> bool:
        """处理外部联系人免验证添加成员事件"""
        try:
            user_id = event_data.get('UserID')
            external_user_id = event_data.get('ExternalUserID')
            welcome_code = event_data.get('WelcomeCode')
            state = event_data.get('State', '')
            
            logger.info(f"处理免验证添加成员事件 - User: {user_id}, External: {external_user_id}, State: {state}")
            
            async with SessionLocal() as session:
                # 1. 获取或创建员工记录
                staff_stmt = select(WeComStaff).where(WeComStaff.user_id == user_id)
                staff_result = await session.execute(staff_stmt)
                staff = staff_result.scalar_one_or_none()
                
                if not staff:
                    logger.warning(f"未找到员工记录 - UserID: {user_id}, 将创建基础记录")
                    staff = WeComStaff(
                        user_id=user_id,
                        name=user_id,
                        status=WeComStaffStatus.ACTIVE
                    )
                    session.add(staff)
                    await session.flush()
                
                # 2. 获取外部联系人详情
                contact_info = await self.get_external_contact(external_user_id)
                if contact_info.get('errcode') != 0:
                    logger.error(f"获取外部联系人详情失败 - ExternalUserID: {external_user_id}")
                    return False
                
                contact_data = contact_info.get('external_contact', {})
                
                # 3. 创建半关系外部联系人记录
                external_contact = ExternalContact(
                    external_user_id=external_user_id,
                    name=contact_data.get('name', ''),
                    avatar=contact_data.get('avatar', ''),
                    type=contact_data.get('type', 1),
                    gender=contact_data.get('gender'),
                    union_id=contact_data.get('unionid'),
                    corp_name=contact_data.get('corp_name', ''),
                    corp_full_name=contact_data.get('corp_full_name', ''),
                    status=ExternalContactStatus.NORMAL,
                    contact_type=ContactType.HALF,  # 关键：标记为半联系
                    staff_id=staff.id
                )
                session.add(external_contact)
                await session.flush()
                
                # 4. 创建客户会话
                session_record = CustomerSession(
                    session_id=f"{user_id}_{external_user_id}_{int(datetime.now().timestamp())}",
                    staff_id=staff.id,
                    external_contact_id=external_contact.id,
                    source="half_external_contact_add",
                    state=state,
                    is_active=True,
                    started_at=datetime.now()
                )
                session.add(session_record)
                
                # 5. 记录事件日志
                event_log = CustomerEventLog(
                    event_type="change_external_contact",
                    change_type="add_half_external_contact",
                    staff_user_id=user_id,
                    external_user_id=external_user_id,
                    event_data=event_data,
                    status="success",
                    welcome_code=welcome_code,
                    state=state
                )
                session.add(event_log)
                
                await session.commit()
                
                # 6. 发送欢迎语（异步调用，不影响主流程）
                if welcome_code:
                    try:
                        await self.send_welcome_msg_async(welcome_code)
                        logger.info(f"免验证欢迎语发送已触发 - welcome_code: {welcome_code[:20]}...")
                    except Exception as e:
                        logger.warning(f"免验证欢迎语发送失败，但不影响主流程 - {e}")
                
                logger.info(f"免验证添加成员事件处理成功 - User: {user_id}, External: {external_user_id}")
                return True
                
        except Exception as e:
            logger.error(f"处理免验证添加成员事件失败: {e}")
            await self._log_event_error("add_half_external_contact", event_data, str(e))
            return False

    async def _log_event_error(self, change_type: str, event_data: Dict[str, Any], error_msg: str):
        """记录事件处理失败日志"""
        try:
            async with SessionLocal() as session:
                event_log = CustomerEventLog(
                    event_type="change_external_contact",
                    change_type=change_type,
                    staff_user_id=event_data.get('UserID', ''),
                    external_user_id=event_data.get('ExternalUserID', ''),
                    event_data=event_data,
                    status="failed",
                    error_message=error_msg
                )
                session.add(event_log)
                await session.commit()
        except Exception as e:
            logger.error(f"记录事件错误日志失败: {e}")

    async def get_staff_by_user_id(self, user_id: str) -> Optional[WeComStaff]:
        """根据UserID获取员工信息"""
        try:
            async with SessionLocal() as session:
                stmt = select(WeComStaff).where(WeComStaff.user_id == user_id)
                result = await session.execute(stmt)
                return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取员工信息失败 - UserID: {user_id}, 错误: {e}")
            return None

    async def get_external_contact_by_id(self, external_user_id: str) -> Optional[ExternalContact]:
        """根据ExternalUserID获取外部联系人信息"""
        try:
            async with SessionLocal() as session:
                stmt = select(ExternalContact).where(
                    ExternalContact.external_user_id == external_user_id,
                    ExternalContact.status == ExternalContactStatus.NORMAL
                ).options(selectinload(ExternalContact.staff))
                
                result = await session.execute(stmt)
                return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取外部联系人信息失败 - ExternalUserID: {external_user_id}, 错误: {e}")
            return None

    async def get_department_users(self, department_id: int = 1) -> Dict[str, Any]:
        """获取部门成员列表"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/user/simplelist"
        access_token = await self.get_access_token()
        params = {
            "access_token": access_token,
            "department_id": department_id,
            "fetch_child": 1  # 获取子部门成员
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
            
            return data
        except Exception as e:
            error_msg = f"获取部门成员列表异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)

    async def get_user_detail(self, user_id: str) -> Dict[str, Any]:
        """获取成员详情"""
        url = "https://qyapi.weixin.qq.com/cgi-bin/user/get"
        access_token = await self.get_access_token()
        params = {
            "access_token": access_token,
            "userid": user_id
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params)
                data = response.json()
            
            return data
        except Exception as e:
            error_msg = f"获取成员详情异常: {e}"
            logger.error(error_msg)
            raise Exception(error_msg)



    async def send_welcome_msg_async(self, welcome_code: str) -> Dict[str, Any]:
        """异步发送欢迎语 - 包装原有的send_welcome_msg方法"""
        try:
            welcome_data = {
                "welcome_code": welcome_code,
                "text": {"content": "欢迎添加我们为好友！我们将为您提供专业的法律服务。"},
            }
            
            result = await self.send_welcome_msg(welcome_data)
            
            if result.get("errcode") == 0:
                logger.info(f"欢迎语发送成功 - welcome_code: {welcome_code[:20]}...")
            else:
                logger.error(f"欢迎语发送失败 - errcode: {result.get('errcode')}, errmsg: {result.get('errmsg')}")
            
            return result
            
        except Exception as e:
            logger.error(f"发送欢迎语异常 - welcome_code: {welcome_code[:20]}..., 错误: {e}")
            raise

    async def _save_contact_way(self, api_response: Dict[str, Any], request_data: Dict[str, Any]):
        """保存联系方式到数据库"""
        try:
            async with SessionLocal() as session:
                contact_way = ContactWay(
                    config_id=api_response.get('config_id'),
                    type=request_data.get('type', 1),
                    scene=request_data.get('scene', 1),
                    style=request_data.get('style'),
                    remark=request_data.get('remark'),
                    skip_verify=request_data.get('skip_verify', 0) == 1,
                    is_active=True,
                    qr_code=api_response.get('qr_code'),
                    callback_enabled=request_data.get('skip_verify', 0) == 0,  # skip_verify=0 启用回调
                    state=request_data.get('state'),
                    extra_data={
                        'api_response': api_response,
                        'request_data': request_data
                    }
                )
                session.add(contact_way)
                await session.commit()
                logger.info(f"联系方式已保存到数据库 - config_id: {api_response.get('config_id')}")
        except Exception as e:
            logger.error(f"保存联系方式到数据库失败: {e}")
            # 不抛出异常，避免影响主流程

    def _build_callback_url(self, config_id: str, state: str) -> str:
        """构建启用回调的URL"""
        if not config_id:
            return ""
        base_url = f"https://work.weixin.qq.com/ca/{config_id}"
        if state:
            return f"{base_url}?customer_channel={state}"
        return base_url

    async def get_contact_way_list(self) -> Dict[str, Any]:
        """获取联系方式列表"""
        # 先从数据库获取
        try:
            async with SessionLocal() as session:
                stmt = select(ContactWay).where(ContactWay.is_active == True).order_by(ContactWay.created_at.desc())
                result = await session.execute(stmt)
                contact_ways = result.scalars().all()
                
                return {
                    'total': len(contact_ways),
                    'items': [
                        {
                            'id': cw.id,
                            'config_id': cw.config_id,
                            'type': cw.type,
                            'scene': cw.scene,
                            'skip_verify': cw.skip_verify,
                            'callback_enabled': cw.callback_enabled,
                            'state': cw.state,
                            'qr_code': cw.qr_code,
                            'callback_url': self._build_callback_url(cw.config_id, cw.state) if cw.callback_enabled else None,
                            'created_at': cw.created_at.isoformat() if cw.created_at else None,
                            'is_active': cw.is_active
                        }
                        for cw in contact_ways
                    ]
                }
        except Exception as e:
            logger.error(f"获取联系方式列表失败: {e}")
            return {'total': 0, 'items': []}


# 创建全局实例
wecom_service = WeComService()
