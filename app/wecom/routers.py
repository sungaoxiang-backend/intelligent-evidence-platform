# app/wecom/router.py
from typing import Annotated, Optional, Dict, Any
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import PlainTextResponse, Response
from app.wecom.services import wecom_service
from app.core.logging import logger

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
    这是企微官方要求的URL验证接口
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
            
        logger.info("=== 开始处理URL验证请求 ===")
        logger.info(f"请求参数:")
        logger.info(f"  - msg_signature: {msg_signature}")
        logger.info(f"  - timestamp: {timestamp}")
        logger.info(f"  - nonce: {nonce}")
        logger.info(f"  - echostr: {echostr}")

        # 验证签名
        if wecom_service.verify_signature(msg_signature, timestamp, nonce, echostr):
            logger.info("签名验证通过，开始解密消息")
            decrypted_echostr = wecom_service.decrypt_message(echostr)
            logger.info(f"消息解密成功，返回内容: {decrypted_echostr}")

            # 企业微信官方要求：1秒内原样返回明文消息内容（不能加引号，不能带bom头，不能带换行符）
            logger.info(f"=== URL验证请求处理成功，返回明文: {decrypted_echostr} ===")
            return Response(
                content=decrypted_echostr,
                media_type="text/plain",
                headers={"Content-Type": "text/plain; charset=utf-8"}
            )
        else:
            logger.warning("签名验证失败")
            logger.warning("=== URL验证请求处理失败 ===")
            return Response(content="验证失败", media_type="text/plain")

    except Exception as e:
        logger.error(f"URL验证处理异常: {e}")
        logger.error(f"异常类型: {type(e).__name__}")
        logger.error(f"异常详情: {str(e)}")
        logger.error("=== URL验证请求处理异常 ===")
        return Response(content="验证失败", media_type="text/plain")


@router.post("/callback")
async def handle_callback(request: Request):
    """
    处理回调事件 - 实际事件发生时调用
    这是企微官方要求的事件接收接口
    """
    try:
        logger.info("=== 开始处理回调事件 ===")

        body = await request.body()
        logger.info(f"收到回调数据长度: {len(body)}")
        logger.info(f"收到回调数据: {body.decode('utf-8')}")

        # 解析XML数据
        import xml.etree.ElementTree as ET

        root = ET.fromstring(body)
        logger.info(f"XML根节点: {root.tag}")

        # 提取加密消息
        encrypt_element = root.find("Encrypt")
        if encrypt_element is None:
            logger.error("未找到加密消息")
            return PlainTextResponse("success")

        encrypted_msg = encrypt_element.text
        if encrypted_msg is None:
            logger.error("加密消息内容为空")
            return PlainTextResponse("success")
        
        logger.info(f"提取到的加密消息: {encrypted_msg}")

        # 解密消息
        decrypted_msg = wecom_service.decrypt_message(encrypted_msg)
        logger.info(f"解密后消息: {decrypted_msg}")

        # 解析事件数据
        event_data = wecom_service.parse_callback_event(decrypted_msg)
        if event_data:
            await process_callback_event(event_data)

        logger.info("=== 回调事件处理完成 ===")
        return PlainTextResponse("success")

    except Exception as e:
        logger.error(f"处理回调异常: {e}")
        logger.error(f"异常类型: {type(e).__name__}")
        logger.error(f"异常详情: {str(e)}")
        logger.error("=== 回调事件处理异常 ===")
        return PlainTextResponse("error")


# 其他方法保持不变...
@router.post("/contact-way")
async def create_contact_way(contact_data: Dict[str, Any]):
    """创建联系方式"""
    try:
        logger.info(f"创建联系方式请求: {contact_data}")
        result = await wecom_service.create_contact_way(contact_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"创建联系方式失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 业务逻辑方法
async def process_callback_event(event_data: Dict[str, Any]):
    """处理回调事件"""
    try:
        logger.info("=== 开始处理回调事件业务逻辑 ===")
        logger.info(f"事件数据: {event_data}")

        event_type = event_data.get("Event")
        change_type = event_data.get("ChangeType")

        if not event_type:
            logger.warning("未找到事件类型")
            return

        logger.info(f"事件类型: {event_type}, 变更类型: {change_type}")

        # 处理客户添加事件
        if (
            event_type == "change_external_contact"
            and change_type == "add_external_contact"
        ):
            await handle_customer_add_event(event_data)
        else:
            logger.info(f"未处理的事件类型: {event_type}")

        logger.info("=== 回调事件业务逻辑处理完成 ===")

    except Exception as e:
        logger.error(f"处理回调事件失败: {e}")


async def handle_customer_add_event(event_data: Dict[str, Any]):
    """处理客户添加事件"""
    try:
        logger.info("=== 开始处理客户添加事件 ===")
        logger.info(f"事件数据: {event_data}")

        user_id = event_data.get("UserID")
        external_user_id = event_data.get("ExternalUserID")
        welcome_code = event_data.get("WelcomeCode")
        state = event_data.get("State")

        logger.info(
            f"客户添加事件 - 员工: {user_id}, 客户: {external_user_id}, 状态: {state}"
        )

        # 获取客户详情
        if external_user_id:
            contact_info = await wecom_service.get_external_contact(external_user_id)
            logger.info(f"客户详情: {contact_info}")

        # 发送欢迎语
        if welcome_code:
            await send_welcome_message_to_customer(welcome_code)

        # 保存客户信息到数据库
        if user_id and external_user_id:
            await save_customer_info_to_db(user_id, external_user_id, state or "")

        logger.info("=== 客户添加事件处理完成 ===")

    except Exception as e:
        logger.error(f"处理客户添加事件失败: {e}")


async def send_welcome_message_to_customer(welcome_code: str):
    """发送欢迎语给客户"""
    try:
        logger.info(f"发送欢迎语给客户，welcome_code: {welcome_code}")

        welcome_data = {
            "welcome_code": welcome_code,
            "text": {"content": "欢迎添加我们为好友！我们将为您提供专业的法律服务。"},
        }

        result = await wecom_service.send_welcome_msg(welcome_data)
        logger.info(f"发送欢迎语结果: {result}")

    except Exception as e:
        logger.error(f"发送欢迎语失败: {e}")


async def save_customer_info_to_db(user_id: str, external_user_id: str, state: str):
    """保存客户信息到数据库"""
    try:
        logger.info(
            f"保存客户信息 - 员工: {user_id}, 客户: {external_user_id}, 状态: {state}"
        )
        # 这里实现数据库保存逻辑
    except Exception as e:
        logger.error(f"保存客户信息失败: {e}")
