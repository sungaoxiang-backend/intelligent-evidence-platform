# app/wecom/router.py
from typing import Annotated, Optional, Dict, Any
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import PlainTextResponse
from app.wecom.services import wecom_service
from app.core.logging import logger

router = APIRouter()


@router.get("/callback")
async def verify_callback(
    msg_signature: Annotated[str, Query(description="签名")],
    timestamp: Annotated[str, Query(description="时间戳")],
    nonce: Annotated[str, Query(description="随机数")],
    echostr: Annotated[str, Query(description="加密字符串")],
):
    """
    验证回调URL - 企业微信配置时调用
    这是企微官方要求的URL验证接口
    """
    try:
        logger.info(
            f"收到URL验证请求 - signature: {msg_signature}, timestamp: {timestamp}, nonce: {nonce}"
        )

        if wecom_service.verify_signature(msg_signature, timestamp, nonce, echostr):
            decrypted_echostr = wecom_service.decrypt_message(echostr)
            logger.info(f"URL验证成功，返回: {decrypted_echostr}")
            return PlainTextResponse(decrypted_echostr)
        else:
            logger.warning("签名验证失败")
            return PlainTextResponse("验证失败", status_code=401)
    except Exception as e:
        logger.error(f"URL验证失败: {e}")
        return PlainTextResponse("验证失败", status_code=500)


@router.post("/callback")
async def handle_callback(request: Request):
    """
    处理回调事件 - 实际事件发生时调用
    这是企微官方要求的事件接收接口
    """
    try:
        body = await request.body()
        logger.info(f"收到回调数据: {body.decode('utf-8')}")

        # 解析XML数据
        import xml.etree.ElementTree as ET

        root = ET.fromstring(body)

        # 提取加密消息
        encrypt_element = root.find("Encrypt")
        if encrypt_element is None or encrypt_element.text is None:
            logger.error("未找到加密消息")
            return PlainTextResponse("success")

        encrypted_msg = encrypt_element.text

        # 解密消息
        decrypted_msg = wecom_service.decrypt_message(encrypted_msg)
        logger.info(f"解密后消息: {decrypted_msg}")

        # 解析事件数据
        event_data = wecom_service.parse_callback_event(decrypted_msg)
        if event_data:
            await process_callback_event(event_data)

        return PlainTextResponse("success")

    except Exception as e:
        logger.error(f"处理回调失败: {e}")
        return PlainTextResponse("error")


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


@router.post("/welcome-msg")
async def send_welcome_message(welcome_data: Dict[str, Any]):
    """发送欢迎语"""
    try:
        logger.info(f"发送欢迎语请求: {welcome_data}")
        result = await wecom_service.send_welcome_msg(welcome_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"发送欢迎语失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contact/{external_userid}")
async def get_contact_info(external_userid: str):
    """获取客户详情"""
    try:
        logger.info(f"获取客户详情请求: {external_userid}")
        result = await wecom_service.get_external_contact(external_userid)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"获取客户详情失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/contact-way")
async def update_contact_way(contact_data: Dict[str, Any]):
    """更新联系方式"""
    try:
        logger.info(f"更新联系方式请求: {contact_data}")
        result = await wecom_service.update_contact_way(contact_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"更新联系方式失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/contact-way/{config_id}")
async def delete_contact_way(config_id: str):
    """删除联系方式"""
    try:
        logger.info(f"删除联系方式请求: {config_id}")
        result = await wecom_service.del_contact_way(config_id)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"删除联系方式失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 业务逻辑方法
async def process_callback_event(event_data: Dict[str, Any]):
    """处理回调事件"""
    try:
        event_type = event_data.get("Event")
        change_type = event_data.get("ChangeType")

        if not event_type:
            logger.warning("未找到事件类型")
            return

        logger.info(f"处理回调事件 - 事件类型: {event_type}, 变更类型: {change_type}")

        # 处理客户添加事件
        if (
            event_type == "change_external_contact"
            and change_type == "add_external_contact"
        ):
            await handle_customer_add_event(event_data)
        elif (
            event_type == "change_external_contact"
            and change_type == "del_external_contact"
        ):
            await handle_customer_delete_event(event_data)
        elif event_type == "change_external_chat":
            await handle_chat_change_event(event_data)
        else:
            logger.info(f"未处理的事件类型: {event_type}, 变更类型: {change_type}")

    except Exception as e:
        logger.error(f"处理回调事件失败: {e}")


async def handle_customer_add_event(event_data: Dict[str, Any]):
    """处理客户添加事件"""
    try:
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

    except Exception as e:
        logger.error(f"处理客户添加事件失败: {e}")


async def handle_customer_delete_event(event_data: Dict[str, Any]):
    """处理客户删除事件"""
    try:
        user_id = event_data.get("UserID")
        external_user_id = event_data.get("ExternalUserID")
        source = event_data.get("Source")

        logger.info(
            f"客户删除事件 - 员工: {user_id}, 客户: {external_user_id}, 来源: {source}"
        )

        # 处理客户删除逻辑
        if user_id and external_user_id:
            await handle_customer_deletion_in_db(user_id, external_user_id, source or "")

    except Exception as e:
        logger.error(f"处理客户删除事件失败: {e}")


async def handle_chat_change_event(event_data: Dict[str, Any]):
    """处理群组变更事件"""
    try:
        chat_id = event_data.get("ChatId")
        change_type = event_data.get("ChangeType")
        update_detail = event_data.get("UpdateDetail")

        logger.info(
            f"群组变更事件 - 群ID: {chat_id}, 变更类型: {change_type}, 详情: {update_detail}"
        )

        # 处理群组变更逻辑
        if chat_id and change_type:
            await handle_chat_change_in_db(chat_id, change_type, update_detail or "")

    except Exception as e:
        logger.error(f"处理群组变更事件失败: {e}")


async def send_welcome_message_to_customer(welcome_code: str):
    """发送欢迎语给客户"""
    try:
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
        # 例如：
        # async with DBSession() as db:
        #     # 保存客户信息
        #     pass
    except Exception as e:
        logger.error(f"保存客户信息失败: {e}")


async def handle_customer_deletion_in_db(
    user_id: str, external_user_id: str, source: str
):
    """处理客户删除逻辑"""
    try:
        logger.info(
            f"处理客户删除 - 员工: {user_id}, 客户: {external_user_id}, 来源: {source}"
        )
        # 这里实现客户删除逻辑
    except Exception as e:
        logger.error(f"处理客户删除失败: {e}")


async def handle_chat_change_in_db(chat_id: str, change_type: str, update_detail: str):
    """处理群组变更逻辑"""
    try:
        logger.info(
            f"处理群组变更 - 群ID: {chat_id}, 变更类型: {change_type}, 详情: {update_detail}"
        )
        # 这里实现群组变更逻辑
    except Exception as e:
        logger.error(f"处理群组变更失败: {e}")
