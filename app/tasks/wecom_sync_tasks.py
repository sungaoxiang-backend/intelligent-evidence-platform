# app/tasks/wecom_sync_tasks.py
"""
企微外部联系人数据同步定时任务
"""

import logging
from datetime import datetime, timedelta
from celery import Celery
from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.wecom.sync_service import sync_service

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name="wecom.sync_contacts_incremental")
def sync_contacts_incremental(self):
    """
    增量同步企微外部联系人数据
    建议每小时执行一次
    """
    try:
        logger.info("[CELERY_TASK] 开始执行企微外部联系人增量同步任务")
        
        # 使用 asyncio 运行异步任务
        import asyncio
        
        async def run_sync():
            return await sync_service.sync_all_contacts(force_full_sync=False)
        
        # 在新的事件循环中运行
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_sync())
        finally:
            loop.close()
        
        logger.info(f"[CELERY_TASK] 增量同步完成 - 处理: {result['total_processed']}, "
                   f"新增: {result['new_contacts']}, 更新: {result['updated_contacts']}, "
                   f"错误: {result['error_contacts']}")
        
        return {
            "status": "success",
            "message": "增量同步完成",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"[CELERY_TASK] 增量同步任务失败: {e}")
        return {
            "status": "error",
            "message": f"增量同步失败: {str(e)}"
        }


@celery_app.task(bind=True, name="wecom.sync_contacts_full")
def sync_contacts_full(self):
    """
    全量同步企微外部联系人数据
    建议每天凌晨执行一次
    """
    try:
        logger.info("[CELERY_TASK] 开始执行企微外部联系人全量同步任务")
        
        # 使用 asyncio 运行异步任务
        import asyncio
        
        async def run_sync():
            return await sync_service.sync_all_contacts(force_full_sync=True)
        
        # 在新的事件循环中运行
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(run_sync())
        finally:
            loop.close()
        
        logger.info(f"[CELERY_TASK] 全量同步完成 - 处理: {result['total_processed']}, "
                   f"新增: {result['new_contacts']}, 更新: {result['updated_contacts']}, "
                   f"错误: {result['error_contacts']}")
        
        return {
            "status": "success",
            "message": "全量同步完成",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"[CELERY_TASK] 全量同步任务失败: {e}")
        return {
            "status": "error",
            "message": f"全量同步失败: {str(e)}"
        }


@celery_app.task(bind=True, name="wecom.sync_contacts_cleanup")
def sync_contacts_cleanup(self):
    """
    清理过期的同步数据
    建议每周执行一次
    """
    try:
        logger.info("[CELERY_TASK] 开始执行企微同步数据清理任务")
        
        # 这里可以添加清理逻辑，比如：
        # 1. 清理过期的临时数据
        # 2. 清理重复的会话记录
        # 3. 清理无效的外部联系人记录
        
        logger.info("[CELERY_TASK] 同步数据清理完成")
        
        return {
            "status": "success",
            "message": "数据清理完成"
        }
        
    except Exception as e:
        logger.error(f"[CELERY_TASK] 同步数据清理任务失败: {e}")
        return {
            "status": "error",
            "message": f"数据清理失败: {str(e)}"
        }


# 配置定时任务
celery_app.conf.beat_schedule.update({
    # 每小时执行增量同步
    'wecom-sync-incremental-hourly': {
        'task': 'wecom.sync_contacts_incremental',
        'schedule': crontab(minute=0),  # 每小时的第0分钟执行
        'options': {
            'queue': 'wecom_sync',
            'priority': 5
        }
    },
    
    # 每天凌晨2点执行全量同步
    'wecom-sync-full-daily': {
        'task': 'wecom.sync_contacts_full',
        'schedule': crontab(hour=2, minute=0),  # 每天凌晨2点执行
        'options': {
            'queue': 'wecom_sync',
            'priority': 3
        }
    },
    
    # 每周日凌晨3点执行数据清理
    'wecom-sync-cleanup-weekly': {
        'task': 'wecom.sync_contacts_cleanup',
        'schedule': crontab(hour=3, minute=0, day_of_week=0),  # 每周日凌晨3点执行
        'options': {
            'queue': 'wecom_sync',
            'priority': 1
        }
    }
})

# 配置任务路由
celery_app.conf.task_routes.update({
    'wecom.sync_contacts_incremental': {'queue': 'wecom_sync'},
    'wecom.sync_contacts_full': {'queue': 'wecom_sync'},
    'wecom.sync_contacts_cleanup': {'queue': 'wecom_sync'},
})


