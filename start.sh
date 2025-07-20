#!/bin/bash

# 创建虚拟环境（如果不存在）
if [ ! -d ".venv" ]; then
    echo "创建虚拟环境..."
    uv venv
fi

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
echo "安装依赖..."
uv sync
# 或者使用 uv lock 锁定依赖版本
# uv lock

# 初始化数据库和创建超级管理员
echo "初始化数据库和创建超级管理员..."
python -m app.initial_data

# 启动应用
echo "启动应用..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8008