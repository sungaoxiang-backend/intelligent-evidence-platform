#!/bin/sh
set -e

# 安装 Playwright 浏览器（如果尚未安装）
# 这允许在容器启动时利用网络连接，避免构建时的网络问题
# 注意：即使安装失败也不阻止容器启动
install_playwright() {
    # 检查 Playwright 浏览器是否已安装
    # 使用 Python 脚本检查（更可靠）
    if . /app/.venv/bin/activate && python -c "
import sys
from pathlib import Path
cache_dir = Path('/root/.cache/ms-playwright/chromium')
if cache_dir.exists():
    # 查找 chrome 可执行文件
    chrome_files = list(cache_dir.rglob('chrome'))
    if chrome_files and any(f.is_file() and f.stat().st_size > 0 for f in chrome_files):
        sys.exit(0)
sys.exit(1)
" 2>/dev/null; then
        echo "✓ Playwright 浏览器已安装，跳过安装步骤"
        return 0
    fi
    
    # 如果 Python 检查失败，使用简单的文件检查作为备用
    if [ -d "/root/.cache/ms-playwright/chromium" ]; then
        # 查找 chrome 可执行文件（可能在不同路径）
        if find /root/.cache/ms-playwright/chromium -name "chrome" -type f -executable 2>/dev/null | head -1 | grep -q .; then
            echo "✓ Playwright 浏览器已安装（通过文件检查），跳过安装步骤"
            return 0
        fi
    fi
    
    echo "=========================================="
    echo "开始安装 Playwright 浏览器..."
    echo "=========================================="
    echo "提示：首次安装需要下载约 300MB，请确保网络连接正常"
    echo "预计耗时：2-5 分钟（取决于网络速度）"
    echo ""
    
    # 设置 Playwright 下载超时（默认 30 分钟）
    export PLAYWRIGHT_DOWNLOAD_TIMEOUT=${PLAYWRIGHT_DOWNLOAD_TIMEOUT:-1800000}
    
    # 如果设置了下载源，使用它
    if [ -n "$PLAYWRIGHT_DOWNLOAD_HOST" ]; then
        echo "使用自定义下载源: $PLAYWRIGHT_DOWNLOAD_HOST"
        export PLAYWRIGHT_DOWNLOAD_HOST
    else
        echo "使用默认下载源（可通过 PLAYWRIGHT_DOWNLOAD_HOST 环境变量配置国内镜像）"
    fi
    
    # 尝试安装，最多重试 3 次
    MAX_RETRIES=3
    RETRY_COUNT=0
    INSTALL_SUCCESS=false
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "[尝试 $RETRY_COUNT/$MAX_RETRIES] 正在安装 Playwright Chromium 浏览器..."
        
        if . /app/.venv/bin/activate && playwright install chromium 2>&1; then
            INSTALL_SUCCESS=true
            echo ""
            echo "✓ Playwright 浏览器安装成功！"
            echo "=========================================="
            break
        else
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                echo ""
                echo "✗ 安装失败，将在 10 秒后重试..."
                echo ""
                sleep 10
            fi
        fi
    done
    
    if [ "$INSTALL_SUCCESS" = false ]; then
        echo ""
        echo "=========================================="
        echo "⚠ 警告: Playwright 浏览器安装失败"
        echo "=========================================="
        echo "PDF 导出功能将不可用"
        echo ""
        echo "解决方案："
        echo "1. 检查容器网络连接"
        echo "2. 手动安装：docker exec <container> /app/.venv/bin/playwright install chromium"
        echo "3. 检查环境变量 PLAYWRIGHT_DOWNLOAD_HOST 是否正确配置"
        echo "=========================================="
        echo ""
        return 1
    fi
    
    return 0
}

# 执行安装（即使失败也不阻止容器启动）
# 添加调试信息
echo "检查 Playwright 浏览器安装状态..."
install_playwright || {
    echo "⚠ Playwright 安装检查或安装过程出现问题，但继续启动应用..."
}

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

# 根据SERVICE_TYPE环境变量决定启动什么服务
if [ "$SERVICE_TYPE" = "celery-worker" ]; then
  echo "启动Celery Worker..."
  exec celery -A app.core.celery_app.celery_app worker --loglevel=info --hostname=worker1@%h -Q celery,example,document,evidence,wecom_sync
elif [ "$SERVICE_TYPE" = "celery-beat" ]; then
  echo "启动Celery Beat..."
  exec celery -A app.core.celery_app.celery_app beat --loglevel=info
else
  # 启动应用
  echo "启动应用..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8008 --proxy-headers --forwarded-allow-ips=*
fi