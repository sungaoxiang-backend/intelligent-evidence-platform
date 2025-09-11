from celery import Celery
from app.core.config import settings

# 创建Celery实例
celery_app = Celery(
    "intelligent_evidence_platform",
    backend=settings.CELERY_RESULT_BACKEND,
    broker=settings.CELERY_BROKER_URL,
)

# 配置Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    # 任务路由
    task_routes={
        "app.tasks.example_tasks.*": {"queue": "example"},
        "app.tasks.document_tasks.*": {"queue": "document"},
        "app.tasks.evidence_tasks.*": {"queue": "evidence"},
    },
    # 任务结果过期时间（秒）
    result_expires=3600,
    # 任务预取数量
    worker_prefetch_multiplier=1,
    # 任务确认
    task_acks_late=True,
)

# 自动发现任务
celery_app.autodiscover_tasks([
    "app.tasks",
    "app.tasks.example_tasks",
    "app.tasks.document_tasks",
    "app.tasks.evidence_tasks",
    "app.tasks.scheduled_tasks",
])