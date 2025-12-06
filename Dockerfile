# 构建阶段
FROM python:3.12 AS builder

WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

# 复制依赖文件
COPY pyproject.toml uv.lock* ./

# 安装uv并创建虚拟环境（使用缓存挂载加速）
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=cache,target=/root/.cache/uv \
    pip install uv && \
    uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    UV_HTTP_TIMEOUT=120 UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple uv sync

# 最终阶段 - 使用完整版Python镜像
FROM python:3.12

WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/app/.venv/bin:$PATH

# 安装PostgreSQL客户端（使用缓存挂载加速）
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制虚拟环境
COPY --from=builder /app/.venv /app/.venv

# 复制项目文件
COPY app/ ./app/
COPY .env.docker ./.env
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY templates/ ./templates/
COPY static/ ./static/

# 复制入口点脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 设置入口点
ENTRYPOINT ["/docker-entrypoint.sh"]