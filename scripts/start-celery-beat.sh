#!/bin/bash
# Celery Beat 启动脚本（定时任务调度器）

# 设置工作目录
cd /app

# 启动Celery Beat
celery -A app.core.celery_app.celery_app beat --loglevel=info