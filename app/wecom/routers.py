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
            logger.info("URL验证签名通过")
            
            try:
                decrypted_echostr = wecom_service.decrypt_message(echostr_decoded)
                logger.info(f"URL验证解密成功 - 明文长度: {len(decrypted_echostr)}字符")
            except Exception as e:
                logger.error(f"URL验证解密失败: {e}")
                return Response(content="验证失败", media_type="text/plain")

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
            logger.info(f"URL验证响应成功 - 返回字节长度: {len(response_bytes)}")
            
            return Response(
                content=response_bytes,
                media_type="text/plain",
                headers={"Content-Type": "text/plain; charset=utf-8"}
            )
        else:
            logger.error("URL验证签名失败")
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
        # 记录请求基本信息
        logger.info(f"POST回调请求 - msg_signature: {msg_signature}, timestamp: {timestamp}, nonce: {nonce}")
        
        body = await request.body()
        logger.info(f"POST回调数据长度: {len(body)}字节")

        # 解析XML数据
        import xml.etree.ElementTree as ET
        
        try:
            root = ET.fromstring(body)
        except ET.ParseError as e:
            logger.error(f"XML解析失败: {e}")
            logger.error(f"原始数据: {body[:200]}...")
            return PlainTextResponse("success")  # 即使解析失败也要返回success

        # 提取加密消息
        encrypt_element = root.find("Encrypt")
        if encrypt_element is None:
            logger.warning("未找到Encrypt节点，可能不是加密消息")
            return PlainTextResponse("success")

        encrypted_msg = encrypt_element.text
        if encrypted_msg is None:
            logger.warning("Encrypt节点内容为空")
            return PlainTextResponse("success")

        logger.info(f"提取到加密消息: {encrypted_msg[:50]}...")

        # 验证签名
        if not wecom_service.verify_signature(msg_signature, timestamp, nonce, msg_encrypt=encrypted_msg):
            logger.error("消息签名验证失败")
            return PlainTextResponse("error")

        logger.info("消息签名验证通过")

        # 解密消息
        try:
            decrypted_msg = wecom_service.decrypt_message(encrypted_msg)
            logger.info(f"消息解密成功 - 长度: {len(decrypted_msg)}字符")
        except Exception as e:
            logger.error(f"消息解密失败: {e}")
            return PlainTextResponse("error")

        # 解析事件数据
        event_data = wecom_service.parse_callback_event(decrypted_msg)
        if event_data:
            logger.info(f"事件解析成功 - 将开始处理事件")
            await process_callback_event(event_data)
        else:
            logger.warning("事件解析失败或返回空数据")

        logger.info("POST回调处理完成")
        return PlainTextResponse("success", headers={"Content-Type": "text/plain"})

    except Exception as e:
        logger.error(f"POST回调处理异常: {e}")
        logger.error(f"异常类型: {type(e).__name__}")
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
    """处理回调事件 - 增强版本，支持所有事件类型"""
    try:
        msg_type = event_data.get('MsgType', '')
        event = event_data.get('Event', '')
        
        # 记录事件基本信息用于调试
        logger.info(f"开始处理回调事件 - MsgType: {msg_type}, Event: {event}, User: {event_data.get('FromUserName', '')}")
        
        if not event:
            logger.warning(f"事件缺少Event字段 - 数据: {list(event_data.keys())}")
            return
        
        # 根据事件类型分发处理
        if msg_type == 'event':
            await handle_event_message(event_data)
        elif msg_type in ['text', 'image', 'voice', 'video', 'file', 'location']:
            await handle_user_message(event_data)
        else:
            logger.info(f"未处理的消息类型 - MsgType: {msg_type}")
            
    except Exception as e:
        logger.error(f"处理回调事件失败: {e}")
        logger.error(f"事件数据: {event_data.get('Event', 'unknown')}")


async def handle_event_message(event_data: Dict[str, Any]):
    """处理事件消息 - 仅处理企业客户相关事件"""
    event = event_data.get('Event', '')
    
    logger.info(f"处理事件消息 - Event: {event}")
    
    # 只处理外部联系人相关事件
    if event == 'change_external_contact':
        await handle_external_contact_event(event_data)
    elif event == 'change_external_chat':
        logger.info("收到客户群事件，暂不处理")
    elif event == 'change_external_tag':
        logger.info("收到客户标签事件，暂不处理")
    else:
        logger.info(f"非客户联系事件，跳过处理 - Event: {event}")


async def handle_user_message(event_data: Dict[str, Any]):
    """处理用户消息 - 暂不处理"""
    msg_type = event_data.get('MsgType', '')
    logger.info(f"收到用户消息，暂不处理 - MsgType: {msg_type}")
    pass


async def handle_external_contact_event(event_data: Dict[str, Any]):
    """处理客户联系事件 - 仅处理4个指定的客户事件类型"""
    change_type = event_data.get('ChangeType', '')
    user_id = event_data.get('UserID', '')
    external_user_id = event_data.get('ExternalUserID', '')
    
    logger.info(f"处理客户联系事件 - ChangeType: {change_type}, User: {user_id}, ExternalUser: {external_user_id}")
    
    # 根据变更类型处理 - 仅处理指定的4个事件
    if change_type == 'add_external_contact':
        # 添加企业客户事件
        success = await wecom_service.handle_customer_add_event(event_data)
        if success:
            logger.info(f"添加企业客户事件处理成功 - User: {user_id}, External: {external_user_id}")
        else:
            logger.error(f"添加企业客户事件处理失败 - User: {user_id}, External: {external_user_id}")
            
    elif change_type == 'del_external_contact':
        # 删除企业客户事件
        success = await wecom_service.handle_customer_delete_event(event_data)
        if success:
            logger.info(f"删除企业客户事件处理成功 - User: {user_id}, External: {external_user_id}")
        else:
            logger.error(f"删除企业客户事件处理失败 - User: {user_id}, External: {external_user_id}")
            
    elif change_type == 'edit_external_contact':
        # 编辑企业客户事件
        success = await wecom_service.handle_customer_edit_event(event_data)
        if success:
            logger.info(f"编辑企业客户事件处理成功 - User: {user_id}, External: {external_user_id}")
        else:
            logger.error(f"编辑企业客户事件处理失败 - User: {user_id}, External: {external_user_id}")
            
    elif change_type == 'add_half_external_contact':
        # 外部联系人免验证添加成员事件
        success = await wecom_service.handle_half_customer_add_event(event_data)
        if success:
            logger.info(f"免验证添加成员事件处理成功 - User: {user_id}, External: {external_user_id}")
        else:
            logger.error(f"免验证添加成员事件处理失败 - User: {user_id}, External: {external_user_id}")
            
    else:
        logger.info(f"未处理的客户联系变更类型 - ChangeType: {change_type}")


async def handle_external_chat_event(event_data: Dict[str, Any]):
    """处理客户群事件 - 暂不处理"""
    change_type = event_data.get('ChangeType', '')
    logger.info(f"收到客户群事件，暂不处理 - ChangeType: {change_type}")


async def handle_external_tag_event(event_data: Dict[str, Any]):
    """处理客户标签事件 - 暂不处理"""
    change_type = event_data.get('ChangeType', '')
    logger.info(f"收到客户标签事件，暂不处理 - ChangeType: {change_type}")


async def send_welcome_message_to_customer(welcome_code: str):
    """发送欢迎语给客户"""
    try:
        logger.info(f"开始发送欢迎语 - welcome_code: {welcome_code[:10]}...")
        
        welcome_data = {
            "welcome_code": welcome_code,
            "text": {"content": "欢迎添加我们为好友！我们将为您提供专业的法律服务。"},
        }

        result = await wecom_service.send_welcome_msg(welcome_data)
        
        if result.get("errcode") == 0:
            logger.info(f"欢迎语发送成功 - welcome_code: {welcome_code[:10]}...")
        else:
            logger.error(f"欢迎语发送失败 - errcode: {result.get('errcode')}, errmsg: {result.get('errmsg')}")

    except Exception as e:
        logger.error(f"发送欢迎语失败: {e}")


async def save_customer_info_to_db(user_id: str, external_user_id: str, state: str):
    """保存客户信息到数据库"""
    try:
        logger.info(f"保存客户信息 - User: {user_id}, ExternalUser: {external_user_id}, State: {state}")
        
        # TODO: 实现数据库保存逻辑
        # 这里可以保存到数据库，或者发送到消息队列等
        # 示例：保存客户关系到数据库
        # await db.save_customer_relationship(user_id, external_user_id, state)
        
        logger.info(f"客户信息保存完成 - User: {user_id}, ExternalUser: {external_user_id}")
        
    except Exception as e:
        logger.error(f"保存客户信息失败: {e}")


def extract_qr_scene(event_key: str) -> str:
    """提取二维码场景值"""
    if event_key.startswith('qrscene_'):
        return event_key[8:]  # 移除 'qrscene_' 前缀
    return event_key


def format_location(lat: str, lng: str, precision: str) -> str:
    """格式化地理位置信息"""
    try:
        lat_float = float(lat) if lat else 0.0
        lng_float = float(lng) if lng else 0.0
        prec_float = float(precision) if precision else 0.0
        return f"({lat_float:.6f}, {lng_float:.6f}) ±{prec_float}m"
    except (ValueError, TypeError):
        return f"({lat}, {lng}) ±{precision}"
