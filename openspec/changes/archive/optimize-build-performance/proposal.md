# Change: 优化 Docker 构建性能

## Why

当前项目的 Docker 构建过程非常缓慢，从终端输出可以看到构建时间超过 280 秒。主要问题包括：

1. **后端构建慢：** Python 依赖安装、apt-get 更新等操作没有充分利用缓存
2. **前端构建慢：** npm 安装和构建过程没有配置镜像源，且没有优化缓存策略
3. **构建流程未优化：** 没有启用 BuildKit，没有使用缓存挂载，没有并行构建优化

这些问题导致开发迭代效率低下，特别是在频繁修改代码需要重新构建时。

## What Changes

- **后端 Dockerfile 优化：**
  - 优化层缓存顺序，将依赖文件复制和安装放在代码复制之前
  - 使用 BuildKit 缓存挂载加速 apt-get 和 pip/uv 安装
  - 优化 apt-get 缓存策略
  - 确保依赖安装层可以独立缓存

- **前端 Dockerfile 优化：**
  - 配置 npm 镜像源（使用国内镜像加速）
  - 优化层缓存顺序，先复制 package.json 和 package-lock.json
  - 使用 BuildKit 缓存挂载加速 npm install
  - 分离依赖安装和代码构建阶段

- **构建流程优化：**
  - 在 deploy.sh 中启用 Docker BuildKit
  - 配置构建缓存策略
  - 优化 docker-compose 构建配置

- **配置文件优化：**
  - 创建/更新 .npmrc 配置 npm 镜像源
  - 优化 .dockerignore 确保不必要的文件不被复制

## Impact

- **Affected specs:** 无（这是基础设施优化，不改变功能行为）
- **Affected code:**
  - `Dockerfile` - 后端构建优化
  - `frontend/Dockerfile` - 前端构建优化
  - `deploy.sh` - 构建脚本优化
  - `docker-compose.yaml` - 构建配置优化（如需要）
  - `.npmrc` - 新增 npm 配置
  - `.dockerignore` - 优化忽略规则

- **Performance improvement:** 预期构建时间减少 50-70%，特别是在依赖未变更的情况下
- **Developer experience:** 显著提升开发迭代速度

