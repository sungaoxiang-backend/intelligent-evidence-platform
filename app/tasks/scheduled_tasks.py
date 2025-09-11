from app.core.celery_app import celery_app
from loguru import logger
from datetime import datetime

@celery_app.task
def scheduled_hello() -> str:
    """
    定时任务示例：每分钟打印一条消息
    """
    message = f"定时任务执行: {datetime.now()}"
    logger.info(message)
    return message

# 配置定时任务
celery_app.conf.beat_schedule = {
    'say-hello-every-minute': {
        'task': 'app.tasks.scheduled_tasks.scheduled_hello',
        'schedule': 60.0,  # 每60秒执行一次
    },
}