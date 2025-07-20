#!/bin/sh
set -e

# 等待PostgreSQL数据库准备就绪
echo "等待PostgreSQL数据库准备就绪..."

until PGPASSWORD=$POSTGRES_PASSWORD psql -h "$POSTGRES_SERVER" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q'; do
  >&2 echo "PostgreSQL数据库尚未准备就绪 - 等待中..."
  sleep 1
done

>&2 echo "PostgreSQL数据库已准备就绪！"

# 运行数据库迁移
echo "运行数据库迁移..."
cd /app && alembic upgrade head

# 创建超级管理员
echo "创建超级管理员..."
python -m app.initial_data

# 启动应用
echo "启动应用..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8008