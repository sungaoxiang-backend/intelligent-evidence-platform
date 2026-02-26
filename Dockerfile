# 构建阶段
FROM python:3.12-slim AS builder

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

# 最终阶段 - 使用轻量级Python镜像
FROM python:3.12-slim

WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/app/.venv/bin:$PATH

# 配置 Debian apt 镜像源（使用清华镜像加速，适用于 Debian 12/13）
RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i 's|http://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|https://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
    sed -i 's|http://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list && \
    sed -i 's|https://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list; \
    fi && \
    echo "已配置 Debian apt 镜像源为清华镜像"

# 安装PostgreSQL客户端和Node.js（使用缓存挂载加速）
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && echo "Node.js $(node --version) installed successfully"

# 安装 Playwright npm 包（全局安装，供 fetch.js 脚本使用）
# 使用 npmmirror 加速下载
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g playwright \
    && echo "Playwright npm package installed successfully"

# 从构建阶段复制虚拟环境
COPY --from=builder /app/.venv /app/.venv

# 安装 Playwright 系统依赖（浏览器将在运行时安装，避免构建时网络问题）
RUN . /app/.venv/bin/activate && \
    playwright install-deps chromium 2>/dev/null || true

# 复制本地预下载的 NLTK 数据 (生产级优化：完全避免构建时网络依赖)
# 请确保在构建前运行 scripts/download_nltk_local.py
COPY nltk_data/ /app/nltk_data/

# 验证数据完整性 (确保复制成功)
RUN . /app/.venv/bin/activate && \
    python -c "import nltk; nltk.data.path.append('/app/nltk_data'); nltk.data.find('tokenizers/punkt'); nltk.data.find('taggers/averaged_perceptron_tagger')" || \
    echo "WARNING: NLTK data validation failed. Ensure you ran scripts/download_nltk_local.py"

# 设置 NLTK 数据目录环境变量
ENV NLTK_DATA=/app/nltk_data

# 复制项目文件
COPY app/ ./app/
COPY .env.docker ./.env
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY templates/ ./templates/
COPY static/ ./static/
COPY reload_kb.py ./

# 复制入口点脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 设置入口点
ENTRYPOINT ["/docker-entrypoint.sh"]