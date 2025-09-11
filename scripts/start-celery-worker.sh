#!/bin/bash
# Celery Worker 启动脚本

# 设置工作目录
cd /app

# 启动Celery Worker
celery -A app.core.celery_app.celery_app worker --loglevel=info --hostname=worker1@%h