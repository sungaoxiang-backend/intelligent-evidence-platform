# app/wecom/monitoring.py
"""
企微数据同步监控和错误处理机制
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.wecom.models import CustomerEventLog, ExternalContact, CustomerSession, WeComStaff
from app.wecom.sync_service import sync_service

logger = logging.getLogger(__name__)


class WeComSyncMonitor:
    """企微数据同步监控器"""
    
    def __init__(self):
        self.sync_service = sync_service
    
    async def get_sync_health_status(self) -> Dict[str, Any]:
        """获取同步健康状态"""
        try:
            async with SessionLocal() as session:
                # 1. 检查最近同步活动
                recent_syncs = await self._get_recent_sync_activities(session)
                
                # 2. 检查数据一致性
                data_consistency = await self._check_data_consistency(session)
                
                # 3. 检查错误率
                error_rate = await self._calculate_error_rate(session)
                
                # 4. 检查同步延迟
                sync_delay = await self._check_sync_delay(session)
                
                # 5. 计算健康分数
                health_score = self._calculate_health_score(
                    recent_syncs, data_consistency, error_rate, sync_delay
                )
                
                return {
                    "health_score": health_score,
                    "status": self._get_health_status(health_score),
                    "recent_syncs": recent_syncs,
                    "data_consistency": data_consistency,
                    "error_rate": error_rate,
                    "sync_delay": sync_delay,
                    "timestamp": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"获取同步健康状态失败: {e}")
            return {
                "health_score": 0,
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def _get_recent_sync_activities(self, session: AsyncSession) -> Dict[str, Any]:
        """获取最近同步活动统计"""
        try:
            # 最近24小时的同步活动
            since_time = datetime.now() - timedelta(hours=24)
            
            stmt = select(CustomerEventLog).where(
                and_(
                    CustomerEventLog.event_type == "sync_import",
                    CustomerEventLog.created_at >= since_time
                )
            )
            result = await session.execute(stmt)
            recent_logs = result.scalars().all()
            
            # 统计成功和失败数量
            success_count = len([log for log in recent_logs if log.status == "success"])
            failed_count = len([log for log in recent_logs if log.status == "failed"])
            
            return {
                "total_activities": len(recent_logs),
                "success_count": success_count,
                "failed_count": failed_count,
                "success_rate": success_count / len(recent_logs) if recent_logs else 0
            }
            
        except Exception as e:
            logger.error(f"获取最近同步活动失败: {e}")
            return {"error": str(e)}
    
    async def _check_data_consistency(self, session: AsyncSession) -> Dict[str, Any]:
        """检查数据一致性"""
        try:
            # 检查外部联系人和会话的一致性
            contact_stmt = select(ExternalContact).where(
                ExternalContact.status == "NORMAL"
            )
            contact_result = await session.execute(contact_stmt)
            total_contacts = len(contact_result.scalars().all())
            
            # 检查有活跃会话的联系人数量
            session_stmt = select(CustomerSession).where(
                CustomerSession.is_active == True
            )
            session_result = await session.execute(session_stmt)
            active_sessions = len(session_result.scalars().all())
            
            # 检查孤立的外部联系人（没有对应会话的）
            orphan_contacts = await self._find_orphan_contacts(session)
            
            return {
                "total_contacts": total_contacts,
                "active_sessions": active_sessions,
                "orphan_contacts": len(orphan_contacts),
                "consistency_score": self._calculate_consistency_score(
                    total_contacts, active_sessions, len(orphan_contacts)
                )
            }
            
        except Exception as e:
            logger.error(f"检查数据一致性失败: {e}")
            return {"error": str(e)}
    
    async def _calculate_error_rate(self, session: AsyncSession) -> Dict[str, Any]:
        """计算错误率"""
        try:
            # 最近7天的错误日志
            since_time = datetime.now() - timedelta(days=7)
            
            stmt = select(CustomerEventLog).where(
                and_(
                    CustomerEventLog.created_at >= since_time,
                    CustomerEventLog.status == "failed"
                )
            )
            result = await session.execute(stmt)
            error_logs = result.scalars().all()
            
            # 按错误类型分组
            error_types = {}
            for log in error_logs:
                error_type = log.change_type or "unknown"
                error_types[error_type] = error_types.get(error_type, 0) + 1
            
            return {
                "total_errors": len(error_logs),
                "error_types": error_types,
                "error_rate": len(error_logs) / 7  # 每天平均错误数
            }
            
        except Exception as e:
            logger.error(f"计算错误率失败: {e}")
            return {"error": str(e)}
    
    async def _check_sync_delay(self, session: AsyncSession) -> Dict[str, Any]:
        """检查同步延迟"""
        try:
            # 获取最近的同步时间
            stmt = select(CustomerEventLog).where(
                CustomerEventLog.event_type == "sync_import"
            ).order_by(CustomerEventLog.created_at.desc()).limit(1)
            
            result = await session.execute(stmt)
            latest_sync = result.scalar_one_or_none()
            
            if latest_sync:
                delay_hours = (datetime.now() - latest_sync.created_at).total_seconds() / 3600
                return {
                    "latest_sync_time": latest_sync.created_at.isoformat(),
                    "delay_hours": delay_hours,
                    "is_delayed": delay_hours > 2  # 超过2小时认为延迟
                }
            else:
                return {
                    "latest_sync_time": None,
                    "delay_hours": None,
                    "is_delayed": True
                }
                
        except Exception as e:
            logger.error(f"检查同步延迟失败: {e}")
            return {"error": str(e)}
    
    async def _find_orphan_contacts(self, session: AsyncSession) -> List[Dict[str, Any]]:
        """查找孤立的外部联系人"""
        try:
            # 查找没有活跃会话的外部联系人
            stmt = select(ExternalContact).where(
                and_(
                    ExternalContact.status == "NORMAL",
                    ~ExternalContact.customer_sessions.any(CustomerSession.is_active == True)
                )
            )
            result = await session.execute(stmt)
            orphan_contacts = result.scalars().all()
            
            return [
                {
                    "id": contact.id,
                    "external_user_id": contact.external_user_id,
                    "name": contact.name,
                    "created_at": contact.created_at.isoformat()
                }
                for contact in orphan_contacts
            ]
            
        except Exception as e:
            logger.error(f"查找孤立联系人失败: {e}")
            return []
    
    def _calculate_consistency_score(self, total_contacts: int, active_sessions: int, orphan_contacts: int) -> float:
        """计算数据一致性分数"""
        if total_contacts == 0:
            return 1.0
        
        # 基础分数：有会话的联系人比例
        base_score = active_sessions / total_contacts if total_contacts > 0 else 0
        
        # 孤立联系人惩罚
        orphan_penalty = orphan_contacts / total_contacts if total_contacts > 0 else 0
        
        # 最终分数
        final_score = max(0, base_score - orphan_penalty)
        return round(final_score, 2)
    
    def _calculate_health_score(self, recent_syncs: Dict, data_consistency: Dict, 
                              error_rate: Dict, sync_delay: Dict) -> float:
        """计算健康分数"""
        try:
            score = 100.0
            
            # 同步成功率权重 30%
            if "success_rate" in recent_syncs:
                sync_score = recent_syncs["success_rate"] * 30
                score -= (30 - sync_score)
            
            # 数据一致性权重 25%
            if "consistency_score" in data_consistency:
                consistency_score = data_consistency["consistency_score"] * 25
                score -= (25 - consistency_score)
            
            # 错误率权重 25%
            if "error_rate" in error_rate:
                error_penalty = min(25, error_rate["error_rate"] * 5)  # 每个错误扣5分，最多扣25分
                score -= error_penalty
            
            # 同步延迟权重 20%
            if "is_delayed" in sync_delay and sync_delay["is_delayed"]:
                score -= 20
            
            return max(0, round(score, 1))
            
        except Exception as e:
            logger.error(f"计算健康分数失败: {e}")
            return 0.0
    
    def _get_health_status(self, health_score: float) -> str:
        """根据健康分数获取状态"""
        if health_score >= 90:
            return "excellent"
        elif health_score >= 80:
            return "good"
        elif health_score >= 60:
            return "warning"
        else:
            return "critical"
    
    async def get_sync_metrics(self, days: int = 7) -> Dict[str, Any]:
        """获取同步指标"""
        try:
            async with SessionLocal() as session:
                since_time = datetime.now() - timedelta(days=days)
                
                # 同步活动统计
                sync_activities = await self._get_sync_activities_stats(session, since_time)
                
                # 数据增长趋势
                growth_trend = await self._get_growth_trend(session, since_time)
                
                # 错误分析
                error_analysis = await self._get_error_analysis(session, since_time)
                
                return {
                    "period_days": days,
                    "sync_activities": sync_activities,
                    "growth_trend": growth_trend,
                    "error_analysis": error_analysis,
                    "generated_at": datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"获取同步指标失败: {e}")
            return {"error": str(e)}
    
    async def _get_sync_activities_stats(self, session: AsyncSession, since_time: datetime) -> Dict[str, Any]:
        """获取同步活动统计"""
        try:
            stmt = select(CustomerEventLog).where(
                and_(
                    CustomerEventLog.event_type == "sync_import",
                    CustomerEventLog.created_at >= since_time
                )
            )
            result = await session.execute(stmt)
            logs = result.scalars().all()
            
            # 按日期分组统计
            daily_stats = {}
            for log in logs:
                date_key = log.created_at.date().isoformat()
                if date_key not in daily_stats:
                    daily_stats[date_key] = {"success": 0, "failed": 0}
                
                if log.status == "success":
                    daily_stats[date_key]["success"] += 1
                else:
                    daily_stats[date_key]["failed"] += 1
            
            return {
                "total_activities": len(logs),
                "daily_stats": daily_stats
            }
            
        except Exception as e:
            logger.error(f"获取同步活动统计失败: {e}")
            return {"error": str(e)}
    
    async def _get_growth_trend(self, session: AsyncSession, since_time: datetime) -> Dict[str, Any]:
        """获取数据增长趋势"""
        try:
            # 外部联系人增长趋势
            contact_stmt = select(ExternalContact).where(
                ExternalContact.created_at >= since_time
            )
            contact_result = await session.execute(contact_stmt)
            new_contacts = contact_result.scalars().all()
            
            # 按日期分组
            daily_contacts = {}
            for contact in new_contacts:
                date_key = contact.created_at.date().isoformat()
                daily_contacts[date_key] = daily_contacts.get(date_key, 0) + 1
            
            return {
                "total_new_contacts": len(new_contacts),
                "daily_growth": daily_contacts
            }
            
        except Exception as e:
            logger.error(f"获取增长趋势失败: {e}")
            return {"error": str(e)}
    
    async def _get_error_analysis(self, session: AsyncSession, since_time: datetime) -> Dict[str, Any]:
        """获取错误分析"""
        try:
            stmt = select(CustomerEventLog).where(
                and_(
                    CustomerEventLog.created_at >= since_time,
                    CustomerEventLog.status == "failed"
                )
            )
            result = await session.execute(stmt)
            error_logs = result.scalars().all()
            
            # 错误类型分析
            error_types = {}
            error_messages = []
            
            for log in error_logs:
                error_type = log.change_type or "unknown"
                error_types[error_type] = error_types.get(error_type, 0) + 1
                
                if log.error_message:
                    error_messages.append({
                        "type": error_type,
                        "message": log.error_message,
                        "timestamp": log.created_at.isoformat()
                    })
            
            return {
                "total_errors": len(error_logs),
                "error_types": error_types,
                "recent_errors": error_messages[-10:]  # 最近10个错误
            }
            
        except Exception as e:
            logger.error(f"获取错误分析失败: {e}")
            return {"error": str(e)}


# 创建全局实例
sync_monitor = WeComSyncMonitor()


