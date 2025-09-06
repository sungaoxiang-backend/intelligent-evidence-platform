# app/wecom/router.py
from typing import Annotated, Optional, Dict, Any
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import PlainTextResponse, Response
from app.wecom.services import wecom_service
from app.core.logging import logger
import hashlib
import urllib.parse

router = APIRouter()


@router.get("/callback")
async def verify_callback(
    request: Request,
    msg_signature: Annotated[Optional[str], Query(description="签名")] = None,
    timestamp: Annotated[Optional[str], Query(description="时间戳")] = None,
    nonce: Annotated[Optional[str], Query(description="随机数")] = None,
    echostr: Annotated[Optional[str], Query(description="加密字符串")] = None,
):
    """
    验证回调URL - 企业微信配置时调用
    这是企微官方要求的URL验证接口 - 修正版本
    
    关键要求：
    1. 只返回解密后的明文（纯文本）
    2. Content-Type必须是text/plain
    3. 不能有任何XML/JSON包装
    4. 不需要重新加密
    """
    try:
        # 检查必需参数
        if not msg_signature or not timestamp or not nonce or not echostr:
            logger.error("缺少必需的验证参数")
            logger.error(f"msg_signature: {msg_signature}")
            logger.error(f"timestamp: {timestamp}")
            logger.error(f"nonce: {nonce}")
            logger.error(f"echostr: {echostr}")
            return "参数错误"
            
        # URL解码 echostr
        echostr_decoded = urllib.parse.unquote(echostr)

        # 验证签名 - URL验证阶段使用四个参数（包含echostr）
        if wecom_service.verify_signature(msg_signature, timestamp, nonce, echostr=echostr_decoded):
            decrypted_echostr = wecom_service.decrypt_message(echostr_decoded)

            # 企业微信URL验证阶段的正确要求：
            # 1. 必须只返回解密后的明文（纯文本）
            # 2. Content-Type必须是text/plain
            # 3. 不能有任何额外字符，包括XML、JSON、引号、换行符
            # 4. 不需要重新加密，直接返回解密后的明文
            
            # 关键合规性检查：
            # 1. 确保没有BOM头
            # 2. 确保没有前后空白字符
            # 3. 确保没有换行符
            # 4. 使用bytes确保没有隐式的字符串转换问题
            decrypted_echostr = decrypted_echostr.strip()
            if '\n' in decrypted_echostr or '\r' in decrypted_echostr:
                logger.warning("解密后的明文包含换行符，可能导致验证失败")
            
            response_bytes = decrypted_echostr.encode('utf-8')
            
            return Response(
                content=response_bytes,
                media_type="text/plain",
                headers={"Content-Type": "text/plain; charset=utf-8"}
            )
        else:
            return Response(content="验证失败", media_type="text/plain")

    except Exception as e:
        return Response(content="验证失败", media_type="text/plain")


@router.post("/callback")
async def handle_callback(
    request: Request,
    msg_signature: Annotated[Optional[str], Query(description="签名")] = None,
    timestamp: Annotated[Optional[str], Query(description="时间戳")] = None,
    nonce: Annotated[Optional[str], Query(description="随机数")] = None,
):
    """
    处理回调事件 - 实际事件发生时调用
    这是企微官方要求的事件接收接口 - 消息接收阶段
    
    消息接收阶段要求：
    1. 需要解密并重新加密消息
    2. 返回XML格式响应
    3. Content-Type应该是application/xml
    4. 需要包含新的签名
    """
    try:
        body = await request.body()

        # 解析XML数据
        import xml.etree.ElementTree as ET
        root = ET.fromstring(body)

        # 提取加密消息
        encrypt_element = root.find("Encrypt")
        if encrypt_element is None:
            return PlainTextResponse("success")

        encrypted_msg = encrypt_element.text
        if encrypted_msg is None:
            return PlainTextResponse("success")

        # 验证签名 - 消息接收阶段使用四个参数
        if not wecom_service.verify_signature(msg_signature, timestamp, nonce, msg_encrypt=encrypted_msg):
            return PlainTextResponse("error")

        # 解密消息
        decrypted_msg = wecom_service.decrypt_message(encrypted_msg)

        # 解析事件数据
        event_data = wecom_service.parse_callback_event(decrypted_msg)
        if event_data:
            await process_callback_event(event_data)
        # 消息接收阶段：根据企业微信要求，处理完成后返回success
        # 注意：这里不需要返回XML，只需要返回纯文本的"success"
        return PlainTextResponse("success", headers={"Content-Type": "text/plain"})

    except Exception as e:
        logger.error(f"处理回调异常: {e}")
        return PlainTextResponse("error")


# 其他方法保持不变...
@router.post("/contact-way")
async def create_contact_way(contact_data: Dict[str, Any]):
    """创建联系方式"""
    try:
        result = await wecom_service.create_contact_way(contact_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"创建联系方式失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 业务逻辑方法
async def process_callback_event(event_data: Dict[str, Any]):
    """处理回调事件"""
    try:
        event_type = event_data.get("Event")
        change_type = event_data.get("ChangeType")

        if not event_type:
            return

        # 处理客户添加事件
        if (
            event_type == "change_external_contact"
            and change_type == "add_external_contact"
        ):
            await handle_customer_add_event(event_data)

    except Exception as e:
        logger.error(f"处理回调事件失败: {e}")


async def handle_customer_add_event(event_data: Dict[str, Any]):
    """处理客户添加事件"""
    try:
        user_id = event_data.get("UserID")
        external_user_id = event_data.get("ExternalUserID")
        welcome_code = event_data.get("WelcomeCode")
        state = event_data.get("State")

        # 获取客户详情
        if external_user_id:
            contact_info = await wecom_service.get_external_contact(external_user_id)

        # 发送欢迎语
        if welcome_code:
            await send_welcome_message_to_customer(welcome_code)

        # 保存客户信息到数据库
        if user_id and external_user_id:
            await save_customer_info_to_db(user_id, external_user_id, state or "")

    except Exception as e:
        logger.error(f"处理客户添加事件失败: {e}")


async def send_welcome_message_to_customer(welcome_code: str):
    """发送欢迎语给客户"""
    try:
        welcome_data = {
            "welcome_code": welcome_code,
            "text": {"content": "欢迎添加我们为好友！我们将为您提供专业的法律服务。"},
        }

        result = await wecom_service.send_welcome_msg(welcome_data)

    except Exception as e:
        logger.error(f"发送欢迎语失败: {e}")


async def save_customer_info_to_db(user_id: str, external_user_id: str, state: str):
    """保存客户信息到数据库"""
    try:
        # 这里实现数据库保存逻辑
        pass
    except Exception as e:
        logger.error(f"保存客户信息失败: {e}")
