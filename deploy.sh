#!/bin/bash

# 启用 Docker BuildKit 以加速构建
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# 显示帮助信息
show_help() {
    echo "用法: ./deploy.sh [-r|-b|-f|-c] [-h]"
    echo ""
    echo "选项:"
    echo "  -r    重启服务（默认选项）"
    echo "        适用场景：仅修改了环境变量或配置文件"
    echo "        执行操作：docker-compose restart"
    echo ""
    echo "  -b    构建并重启"
    echo "        适用场景：修改了Python代码或依赖"
    echo "        执行操作：docker-compose down && docker-compose build && docker-compose up -d"
    echo ""
    echo "  -f    强制重新构建并重启（无缓存）"
    echo "        适用场景：依赖或基础镜像有重大更新，或遇到奇怪的构建问题"
    echo "        执行操作：docker-compose down && docker-compose build --no-cache && docker-compose up -d"
    echo ""
    echo "  -c    清理并重新构建"
    echo "        适用场景：需要清理所有数据（包括数据库）从头开始"
    echo "        执行操作：docker-compose down -v && docker-compose build --no-cache && docker-compose up -d"
    echo ""
    echo "  -h    显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh        # 等同于 ./deploy.sh -r"
    echo "  ./deploy.sh -b     # 构建并重启"
    echo "  ./deploy.sh -f     # 强制重新构建并重启"
    echo "  ./deploy.sh -c     # 清理所有数据并重新构建"
}

# 默认使用重启模式
MODE="restart"

# 解析命令行参数
while getopts "rbfch" opt; do
    case "$opt" in
        r)
            MODE="restart"
            ;;
        b)
            MODE="build"
            ;;
        f)
            MODE="force"
            ;;
        c)
            MODE="clean"
            ;;
        h)
            show_help
            exit 0
            ;;
        \?)
            echo "错误: 无效的选项"
            show_help
            exit 1
            ;;
    esac
done

# 执行对应的操作
case "$MODE" in
    restart)
        echo "重启服务..."
        docker-compose restart
        ;;
    build)
        echo "构建并重启服务..."
        docker-compose down
        docker-compose build
        docker-compose up -d
        ;;
    force)
        echo "强制重新构建并重启服务..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    clean)
        echo "警告: 此操作将清理所有数据（包括数据库）并重新构建服务！"
        echo "请输入 'YES' 确认继续操作，或任意其他键取消："
        read -r confirmation
        if [ "$confirmation" = "YES" ]; then
            echo "确认清理所有数据并重新构建服务..."
            docker-compose down -v
            docker-compose build --no-cache
            docker-compose up -d
        else
            echo "操作已取消"
            exit 0
        fi
        ;;
esac