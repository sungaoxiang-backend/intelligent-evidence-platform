FROM python:3.12-slim

WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/root/.local/bin:$PATH

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY pyproject.toml uv.lock* ./
COPY app/ ./app/
COPY .env.docker ./.env
COPY alembic.ini ./
COPY alembic/ ./alembic/

# 安装uv，创建虚拟环境并安装依赖
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple uv \
    && uv --version \
    && uv venv /app/.venv \
    && . /app/.venv/bin/activate \
    && UV_HTTP_TIMEOUT=120 UV_SYSTEM_PYTHON=1 uv pip install -i https://pypi.tuna.tsinghua.edu.cn/simple numpy==2.0.0 \
    && UV_HTTP_TIMEOUT=120 uv sync

# 设置PATH以使用虚拟环境
ENV PATH="/app/.venv/bin:$PATH"

# 安装PostgreSQL客户端工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 复制入口点脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 设置入口点
ENTRYPOINT ["/docker-entrypoint.sh"]