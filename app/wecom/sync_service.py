# app/wecom/sync_service.py
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.wecom.models import (
    WeComStaff, ExternalContact, CustomerSession, CustomerEventLog,
    WeComStaffStatus, ExternalContactStatus, ContactType
)
from app.wecom.services import wecom_service
from app.users.schemas import UserCreate, UserUpdate
from app.users import services as user_service
from app.users.models import User  # 确保User模型被正确导入

# 确保所有模型都被导入到SQLAlchemy元数据中
from app.db.base_class import Base
from app.cases.models import Case  # 导入Case模型以确保关系正确映射
from app.evidences.models import Evidence  # 导入Evidence模型以确保关系正确映射

logger = logging.getLogger(__name__)


class WeComSyncService:
    """企微外部联系人数据同步服务"""
    
    def __init__(self):
        self.wecom_service = wecom_service
        self.batch_size = 1000  # 每批处理数量
        self.max_retries = 3    # 最大重试次数
        self.retry_delay = 5    # 重试延迟（秒）
        
        # 确保所有模型都被正确导入到SQLAlchemy元数据中
        self._ensure_models_imported()
    
    def _ensure_models_imported(self):
        """确保所有模型都被正确导入"""
        try:
            from app.db.base_class import Base
            from app.users.models import User
            from app.cases.models import Case
            from app.evidences.models import Evidence
            from app.wecom.models import WeComStaff, ExternalContact, CustomerSession, CustomerEventLog
            # 触发SQLAlchemy元数据初始化
            Base.metadata.tables
        except Exception as e:
            logger.warning(f"模型导入警告: {e}")
    
    async def _get_staff_userids(self) -> List[str]:
        """获取所有员工的userid列表"""
        try:
            # 确保模型被正确导入
            self._ensure_models_imported()
            
            async with SessionLocal() as session:
                stmt = select(WeComStaff.user_id).where(WeComStaff.status == WeComStaffStatus.ACTIVE)
                result = await session.execute(stmt)
                userids = [row[0] for row in result.fetchall()]
                logger.info(f"[GET_STAFF_USERIDS] 获取到 {len(userids)} 个员工userid")
                return userids
        except Exception as e:
            logger.error(f"[GET_STAFF_USERIDS] 获取员工userid列表失败: {e}")
            return []
    
    async def _batch_get_detailed_contacts(self, staff_userids: List[str]) -> List[Dict[str, Any]]:
        """批量获取客户详情"""
        all_detailed_contacts = []
        
        # 分批处理员工列表（每批最多100个）
        batch_size = 100
        for i in range(0, len(staff_userids), batch_size):
            batch_userids = staff_userids[i:i + batch_size]
            logger.info(f"[BATCH_GET_DETAILED] 处理第 {i//batch_size + 1} 批员工，共 {len(batch_userids)} 个")
            
            cursor = None
            while True:
                try:
                    result = await self.wecom_service.batch_get_external_contacts(
                        userid_list=batch_userids,
                        cursor=cursor,
                        limit=100
                    )
                    
                    if result.get("errcode") == 0:
                        contact_list = result.get("external_contact_list", [])
                        all_detailed_contacts.extend(contact_list)
                        
                        next_cursor = result.get("next_cursor")
                        if not next_cursor:
                            break
                        cursor = next_cursor
                    else:
                        logger.error(f"[BATCH_GET_DETAILED] 批量获取客户详情失败 - 错误码: {result.get('errcode')}, 错误信息: {result.get('errmsg')}")
                        break
                        
                except Exception as e:
                    logger.error(f"[BATCH_GET_DETAILED] 批量获取客户详情异常: {e}")
                    break
        
        logger.info(f"[BATCH_GET_DETAILED] 批量获取完成，共获取到 {len(all_detailed_contacts)} 条详细客户信息")
        return all_detailed_contacts
    
    def _merge_contact_data(self, basic_contacts: List[Dict[str, Any]], detailed_contacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """合并基础联系人和详细联系人数据"""
        # 创建详细联系人数据的映射表
        detailed_map = {}
        for detailed in detailed_contacts:
            external_contact = detailed.get("external_contact", {})
            external_userid = external_contact.get("external_userid")
            if external_userid:
                detailed_map[external_userid] = detailed
        
        # 合并数据
        enriched_contacts = []
        for basic in basic_contacts:
            external_userid = basic.get("external_userid")
            if external_userid and external_userid in detailed_map:
                # 合并基础信息和详细信息
                detailed = detailed_map[external_userid]
                enriched = {
                    **basic,  # 基础信息
                    "detailed_info": detailed  # 详细信息
                }
                enriched_contacts.append(enriched)
            else:
                # 只有基础信息
                enriched_contacts.append(basic)
        
        logger.info(f"[MERGE_CONTACT_DATA] 合并完成，共 {len(enriched_contacts)} 条联系人数据")
        return enriched_contacts
    
    async def sync_all_contacts(self, force_full_sync: bool = False) -> Dict[str, Any]:
        """
        同步所有已服务的外部联系人
        
        Args:
            force_full_sync: 是否强制全量同步
            
        Returns:
            同步结果统计
        """
        logger.info(f"[SYNC_ALL] 开始同步所有外部联系人 - 强制全量同步: {force_full_sync}")
        
        start_time = datetime.now()
        stats = {
            "total_fetched": 0,
            "total_processed": 0,
            "new_contacts": 0,
            "updated_contacts": 0,
            "skipped_contacts": 0,
            "error_contacts": 0,
            "sync_duration": 0,
            "errors": []
        }
        
        try:
            # 1. 获取所有外部联系人数据
            all_contacts = await self._fetch_all_contacts()
            stats["total_fetched"] = len(all_contacts)
            logger.info(f"[SYNC_ALL] 从企微API获取到 {len(all_contacts)} 个外部联系人")
            
            # 2. 获取员工列表用于批量获取客户详情
            staff_userids = await self._get_staff_userids()
            logger.info(f"[SYNC_ALL] 获取到 {len(staff_userids)} 个员工，准备批量获取客户详情")
            
            # 3. 批量获取客户详情
            detailed_contacts = await self._batch_get_detailed_contacts(staff_userids)
            logger.info(f"[SYNC_ALL] 批量获取到 {len(detailed_contacts)} 条详细客户信息")
            
            # 4. 合并基础信息和详细信息
            enriched_contacts = self._merge_contact_data(all_contacts, detailed_contacts)
            logger.info(f"[SYNC_ALL] 合并后得到 {len(enriched_contacts)} 条完整客户信息")
            
            # 5. 批量处理外部联系人
            batch_results = await self._process_contacts_batch(enriched_contacts, force_full_sync)
            
            # 3. 统计结果
            for batch_result in batch_results:
                stats["total_processed"] += batch_result["processed"]
                stats["new_contacts"] += batch_result["new_contacts"]
                stats["updated_contacts"] += batch_result["updated_contacts"]
                stats["skipped_contacts"] += batch_result["skipped_contacts"]
                stats["error_contacts"] += batch_result["error_contacts"]
                stats["errors"].extend(batch_result["errors"])
            
            # 4. 计算同步耗时
            end_time = datetime.now()
            stats["sync_duration"] = (end_time - start_time).total_seconds()
            
            logger.info(f"[SYNC_ALL] ✅ 同步完成 - 总耗时: {stats['sync_duration']:.2f}s, "
                       f"获取: {stats['total_fetched']}, 处理: {stats['total_processed']}, "
                       f"新增: {stats['new_contacts']}, 更新: {stats['updated_contacts']}, "
                       f"跳过: {stats['skipped_contacts']}, 错误: {stats['error_contacts']}")
            
            return stats
            
        except Exception as e:
            logger.error(f"[SYNC_ALL] ❌ 同步失败: {e}")
            stats["errors"].append(f"同步失败: {str(e)}")
            return stats
    
    async def _fetch_all_contacts(self) -> List[Dict[str, Any]]:
        """获取所有外部联系人数据（分页处理）"""
        all_contacts = []
        cursor = None
        page = 1
        
        logger.info(f"[FETCH_ALL] 开始分页获取外部联系人数据")
        
        while True:
            try:
                logger.info(f"[FETCH_ALL] 获取第 {page} 页数据 - Cursor: {cursor}")
                
                # 调用企微API获取数据
                result = await self.wecom_service.get_contact_list(cursor=cursor, limit=self.batch_size)
                
                if result.get("errcode") != 0:
                    error_msg = f"获取外部联系人列表失败 - 错误码: {result.get('errcode')}, 错误信息: {result.get('errmsg')}"
                    logger.error(f"[FETCH_ALL] {error_msg}")
                    raise Exception(error_msg)
                
                info_list = result.get("info_list", [])
                next_cursor = result.get("next_cursor")
                
                logger.info(f"[FETCH_ALL] 第 {page} 页获取到 {len(info_list)} 条记录")
                
                # 添加到总列表
                all_contacts.extend(info_list)
                
                # 检查是否还有下一页
                if not next_cursor:
                    logger.info(f"[FETCH_ALL] 已获取所有数据，共 {len(all_contacts)} 条记录")
                    break
                
                cursor = next_cursor
                page += 1
                
                # 避免API频率限制
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"[FETCH_ALL] 获取第 {page} 页数据失败: {e}")
                raise
        
        return all_contacts
    
    async def _process_contacts_batch(self, contacts: List[Dict[str, Any]], force_full_sync: bool = False) -> List[Dict[str, Any]]:
        """批量处理外部联系人数据"""
        batch_results = []
        batch_size = 100  # 每批处理100个
        
        for i in range(0, len(contacts), batch_size):
            batch = contacts[i:i + batch_size]
            batch_num = i // batch_size + 1
            
            logger.info(f"[PROCESS_BATCH] 处理第 {batch_num} 批数据，共 {len(batch)} 条记录")
            
            try:
                batch_result = await self._process_single_batch(batch, force_full_sync)
                batch_results.append(batch_result)
                
                logger.info(f"[PROCESS_BATCH] 第 {batch_num} 批处理完成 - "
                           f"处理: {batch_result['processed']}, 新增: {batch_result['new_contacts']}, "
                           f"更新: {batch_result['updated_contacts']}, 跳过: {batch_result['skipped_contacts']}, "
                           f"错误: {batch_result['error_contacts']}")
                
                # 避免数据库压力过大
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"[PROCESS_BATCH] 第 {batch_num} 批处理失败: {e}")
                batch_results.append({
                    "processed": 0,
                    "new_contacts": 0,
                    "updated_contacts": 0,
                    "skipped_contacts": 0,
                    "error_contacts": len(batch),
                    "errors": [f"批次处理失败: {str(e)}"]
                })
        
        return batch_results
    
    async def _process_single_batch(self, contacts: List[Dict[str, Any]], force_full_sync: bool = False) -> Dict[str, Any]:
        """处理单个批次的外部联系人数据"""
        batch_result = {
            "processed": 0,
            "new_contacts": 0,
            "updated_contacts": 0,
            "skipped_contacts": 0,
            "error_contacts": 0,
            "errors": []
        }
        
        # 确保模型被正确导入
        self._ensure_models_imported()
        
        async with SessionLocal() as session:
            for contact_data in contacts:
                try:
                    result = await self._process_single_contact(session, contact_data, force_full_sync)
                    
                    batch_result["processed"] += 1
                    if result["action"] == "created":
                        batch_result["new_contacts"] += 1
                    elif result["action"] == "updated":
                        batch_result["updated_contacts"] += 1
                    elif result["action"] == "skipped":
                        batch_result["skipped_contacts"] += 1
                    
                except Exception as e:
                    logger.error(f"[PROCESS_SINGLE] 处理外部联系人失败: {e}, 数据: {contact_data}")
                    batch_result["error_contacts"] += 1
                    batch_result["errors"].append(f"处理失败: {str(e)}")
            
            # 提交批次事务
            await session.commit()
        
        return batch_result
    
    async def _process_single_contact(self, session: AsyncSession, contact_data: Dict[str, Any], force_full_sync: bool = False) -> Dict[str, Any]:
        """处理单个外部联系人数据"""
        try:
            # 解析联系人数据
            is_customer = contact_data.get("is_customer", False)
            tmp_openid = contact_data.get("tmp_openid")
            external_userid = contact_data.get("external_userid")
            name = contact_data.get("name", "")
            follow_userid = contact_data.get("follow_userid")
            chat_id = contact_data.get("chat_id")
            chat_name = contact_data.get("chat_name")
            add_time = contact_data.get("add_time")
            
            # 验证必要字段
            if not tmp_openid:
                raise Exception("缺少必要字段: tmp_openid")
            
            # 对于客户，必须有external_userid
            if is_customer and not external_userid:
                logger.warning(f"[PROCESS_SINGLE] 客户缺少external_userid，跳过处理 - tmp_openid: {tmp_openid}")
                return {"action": "skipped", "reason": "客户缺少external_userid"}
            
            # 1. 获取或创建员工记录
            staff = await self._get_or_create_staff(session, follow_userid)
            if not staff:
                logger.warning(f"[PROCESS_SINGLE] 无法获取或创建员工记录，跳过处理 - follow_userid: {follow_userid}")
                return {"action": "skipped", "reason": "无法获取员工记录"}
            
            # 2. 处理外部联系人
            if is_customer and external_userid:
                # 处理客户
                result = await self._process_customer_contact(
                    session, contact_data, staff, add_time, force_full_sync
                )
            else:
                # 处理其他外部联系人（非客户）
                result = await self._process_non_customer_contact(
                    session, tmp_openid, name, staff, add_time, chat_id, chat_name, force_full_sync
                )
            
            return result
            
        except Exception as e:
            logger.error(f"[PROCESS_SINGLE] 处理外部联系人异常: {e}")
            raise
    
    async def _get_or_create_staff(self, session: AsyncSession, user_id: str) -> Optional[WeComStaff]:
        """获取或创建员工记录"""
        if not user_id:
            return None
        
        try:
            # 查找现有员工记录
            stmt = select(WeComStaff).where(WeComStaff.user_id == user_id)
            result = await session.execute(stmt)
            staff = result.scalar_one_or_none()
            
            if staff:
                return staff
            
            # 创建新员工记录
            logger.info(f"[GET_OR_CREATE_STAFF] 创建新员工记录 - UserID: {user_id}")
            staff = WeComStaff(
                user_id=user_id,
                name=user_id,  # 临时使用UserID作为名称
                status=WeComStaffStatus.ACTIVE
            )
            session.add(staff)
            await session.flush()
            
            return staff
            
        except Exception as e:
            logger.error(f"[GET_OR_CREATE_STAFF] 获取或创建员工记录失败 - UserID: {user_id}, 错误: {e}")
            return None
    
    async def _process_customer_contact(self, session: AsyncSession, contact_data: Dict[str, Any], 
                                      staff: WeComStaff, add_time: int, force_full_sync: bool = False) -> Dict[str, Any]:
        """处理客户联系人"""
        try:
            external_userid = contact_data.get("external_userid")
            
            # 获取详细信息
            detailed_info = contact_data.get("detailed_info", {})
            external_contact_info = detailed_info.get("external_contact", {})
            follow_info = detailed_info.get("follow_info", {})
            
            # 优先使用详细信息中的名称，如果没有则使用基础数据中的名称
            name = external_contact_info.get("name") or contact_data.get("name", "")
            
            # 查找现有客户记录
            stmt = select(ExternalContact).where(
                ExternalContact.external_user_id == external_userid,
                ExternalContact.status == ExternalContactStatus.NORMAL
            )
            result = await session.execute(stmt)
            existing_contact = result.scalar_one_or_none()
            
            if existing_contact:
                # 更新现有客户信息
                updated = False
                
                # 更新基本信息
                if force_full_sync or not existing_contact.name or existing_contact.name != name:
                    existing_contact.name = name
                    updated = True
                
                # 更新详细信息（如果有）
                if external_contact_info:
                    if force_full_sync or not existing_contact.avatar or existing_contact.avatar != external_contact_info.get("avatar"):
                        existing_contact.avatar = external_contact_info.get("avatar")
                        updated = True
                    
                    if force_full_sync or existing_contact.type != external_contact_info.get("type", 1):
                        existing_contact.type = external_contact_info.get("type", 1)
                        updated = True
                    
                    if force_full_sync or existing_contact.gender != external_contact_info.get("gender"):
                        existing_contact.gender = external_contact_info.get("gender")
                        updated = True
                    
                    if force_full_sync or existing_contact.union_id != external_contact_info.get("unionid"):
                        existing_contact.union_id = external_contact_info.get("unionid")
                        updated = True
                    
                    if force_full_sync or existing_contact.corp_name != external_contact_info.get("corp_name"):
                        existing_contact.corp_name = external_contact_info.get("corp_name")
                        updated = True
                    
                    if force_full_sync or existing_contact.corp_full_name != external_contact_info.get("corp_full_name"):
                        existing_contact.corp_full_name = external_contact_info.get("corp_full_name")
                        updated = True
                
                if updated:
                    existing_contact.updated_at = datetime.now()
                    session.add(existing_contact)
                    await session.flush()
                    
                    # 更新对应的系统用户
                    await self._update_system_user(session, existing_contact, external_contact_info)
                    
                    logger.info(f"[PROCESS_CUSTOMER] 更新客户信息 - ExternalUserID: {external_userid}, Name: {name}")
                    return {"action": "updated", "contact_id": existing_contact.id}
                else:
                    logger.info(f"[PROCESS_CUSTOMER] 客户信息无变化，跳过 - ExternalUserID: {external_userid}")
                    return {"action": "skipped", "reason": "信息无变化"}
            else:
                # 创建新客户记录
                contact = ExternalContact(
                    external_user_id=external_userid,
                    name=name,
                    type=external_contact_info.get("type", 1),  # 微信用户
                    status=ExternalContactStatus.NORMAL,
                    contact_type=ContactType.FULL,
                    avatar=external_contact_info.get("avatar"),
                    gender=external_contact_info.get("gender"),
                    union_id=external_contact_info.get("unionid"),
                    corp_name=external_contact_info.get("corp_name"),
                    corp_full_name=external_contact_info.get("corp_full_name")
                )
                session.add(contact)
                await session.flush()
                
                # 创建客户会话
                session_record = CustomerSession(
                    session_id=f"{staff.user_id}_{external_userid}_{int(datetime.now().timestamp())}",
                    staff_id=staff.id,
                    external_contact_id=contact.id,
                    source="sync_import",
                    is_active=True,
                    started_at=datetime.fromtimestamp(add_time) if add_time else datetime.now()
                )
                session.add(session_record)
                
                # 创建对应的系统用户
                await self._create_system_user(session, contact, external_contact_info)
                
                logger.info(f"[PROCESS_CUSTOMER] 创建新客户 - ExternalUserID: {external_userid}, Name: {name}")
                return {"action": "created", "contact_id": contact.id}
                
        except Exception as e:
            logger.error(f"[PROCESS_CUSTOMER] 处理客户联系人失败 - ExternalUserID: {external_userid}, 错误: {e}")
            raise
    
    async def _process_non_customer_contact(self, session: AsyncSession, tmp_openid: str, name: str,
                                           staff: WeComStaff, add_time: int, chat_id: str = None,
                                           chat_name: str = None, force_full_sync: bool = False) -> Dict[str, Any]:
        """处理非客户外部联系人"""
        try:
            # 对于非客户，我们主要记录会话信息
            # 这里可以根据业务需求决定是否需要创建ExternalContact记录
            
            # 记录事件日志
            event_log = CustomerEventLog(
                event_type="sync_import",
                change_type="import_external_contact",
                staff_user_id=staff.user_id,
                external_user_id=tmp_openid,  # 使用临时ID
                event_data={
                    "tmp_openid": tmp_openid,
                    "name": name,
                    "chat_id": chat_id,
                    "chat_name": chat_name,
                    "add_time": add_time
                },
                status="success"
            )
            session.add(event_log)
            
            logger.info(f"[PROCESS_NON_CUSTOMER] 记录非客户外部联系人 - tmp_openid: {tmp_openid}, Name: {name}")
            return {"action": "created", "contact_id": None}
            
        except Exception as e:
            logger.error(f"[PROCESS_NON_CUSTOMER] 处理非客户外部联系人失败 - tmp_openid: {tmp_openid}, 错误: {e}")
            raise
    
    async def _create_system_user(self, session: AsyncSession, contact: ExternalContact, external_contact_info: Dict[str, Any] = None):
        """创建对应的系统用户"""
        try:
            if not contact.external_user_id:
                return
            
            # 准备用户数据，优先使用详细信息
            user_name = contact.name or contact.external_user_id
            user_avatar = contact.avatar
            
            if external_contact_info:
                # 如果有详细信息，使用详细信息中的名称和头像
                user_name = external_contact_info.get("name") or contact.name or contact.external_user_id
                user_avatar = external_contact_info.get("avatar") or contact.avatar
            
            user_data = UserCreate(
                name=user_name,
                wechat_nickname=contact.name,  # 保持原始昵称
                wechat_number=contact.external_user_id,
                wechat_avatar=user_avatar
            )
            
            # 使用 update-or-create 逻辑
            user, is_created = await user_service.update_or_create_by_wechat_number(
                session, 
                contact.external_user_id, 
                user_data
            )
            
            if is_created:
                logger.info(f"[CREATE_SYSTEM_USER] 系统用户创建成功 - UserID: {user.id}, Name: {user.name}")
            else:
                logger.info(f"[CREATE_SYSTEM_USER] 系统用户更新成功 - UserID: {user.id}, Name: {user.name}")
                
        except Exception as e:
            logger.error(f"[CREATE_SYSTEM_USER] 创建系统用户失败 - ExternalUserID: {contact.external_user_id}, 错误: {e}")
            # 不抛出异常，避免影响主流程
    
    async def _update_system_user(self, session: AsyncSession, contact: ExternalContact, external_contact_info: Dict[str, Any] = None):
        """更新对应的系统用户"""
        try:
            if not contact.external_user_id:
                return
            
            # 查找现有用户
            existing_user = await user_service.get_by_wechat_number(session, contact.external_user_id)
            if not existing_user:
                # 如果用户不存在，创建新用户
                await self._create_system_user(session, contact, external_contact_info)
                return
            
            # 准备更新数据
            user_name = contact.name or contact.external_user_id
            user_avatar = contact.avatar
            
            if external_contact_info:
                # 如果有详细信息，使用详细信息中的名称和头像
                user_name = external_contact_info.get("name") or contact.name or contact.external_user_id
                user_avatar = external_contact_info.get("avatar") or contact.avatar
            
            # 检查是否需要更新
            if (existing_user.name != user_name or 
                existing_user.wechat_nickname != contact.name or 
                existing_user.wechat_avatar != user_avatar):
                
                user_data = UserCreate(
                    name=user_name,
                    wechat_nickname=contact.name,
                    wechat_number=contact.external_user_id,
                    wechat_avatar=user_avatar
                )
                
                # 更新用户
                updated_user = await user_service.update(session, existing_user, UserUpdate(**user_data.model_dump()))
                logger.info(f"[UPDATE_SYSTEM_USER] 系统用户更新成功 - UserID: {updated_user.id}, Name: {updated_user.name}")
            else:
                logger.info(f"[UPDATE_SYSTEM_USER] 系统用户信息无变化，跳过更新 - UserID: {existing_user.id}")
                
        except Exception as e:
            logger.error(f"[UPDATE_SYSTEM_USER] 更新系统用户失败 - ExternalUserID: {contact.external_user_id}, 错误: {e}")
            # 不抛出异常，避免影响主流程
    
    async def get_sync_status(self) -> Dict[str, Any]:
        """获取同步状态统计"""
        try:
            # 确保模型被正确导入
            self._ensure_models_imported()
            
            async with SessionLocal() as session:
                # 统计外部联系人数量
                contact_stmt = select(ExternalContact).where(ExternalContact.status == ExternalContactStatus.NORMAL)
                contact_result = await session.execute(contact_stmt)
                total_contacts = len(contact_result.scalars().all())
                
                # 统计客户会话数量
                session_stmt = select(CustomerSession).where(CustomerSession.is_active == True)
                session_result = await session.execute(session_stmt)
                active_sessions = len(session_result.scalars().all())
                
                # 统计员工数量
                staff_stmt = select(WeComStaff).where(WeComStaff.status == WeComStaffStatus.ACTIVE)
                staff_result = await session.execute(staff_stmt)
                total_staff = len(staff_result.scalars().all())
                
                return {
                    "total_contacts": total_contacts,
                    "active_sessions": active_sessions,
                    "total_staff": total_staff,
                    "last_sync_time": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"[SYNC_STATUS] 获取同步状态失败: {e}")
            return {
                "error": str(e),
                "last_sync_time": None
            }


# 创建全局实例
sync_service = WeComSyncService()


