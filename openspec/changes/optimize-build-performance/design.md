# Design: Docker 构建性能优化

## Context

当前项目使用 Docker 进行容器化部署，构建过程包括：
- 后端：Python 3.12 + uv 依赖管理 + PostgreSQL 客户端
- 前端：Node.js 20 + Next.js 15 + npm
- 多个服务：app, celery-worker, celery-beat, frontend

构建时间过长影响开发效率，特别是在频繁修改代码需要重新构建时。

## Goals / Non-Goals

### Goals
- 减少 Docker 构建时间 50-70%
- 充分利用 Docker 层缓存，避免不必要的重复构建
- 配置国内镜像源加速依赖下载
- 使用 BuildKit 缓存挂载优化构建性能
- 保持构建结果的正确性和一致性

### Non-Goals
- 不改变应用的功能行为
- 不改变部署流程的用户接口（deploy.sh 的命令行参数保持不变）
- 不改变容器运行时的行为

## Decisions

### 1. 启用 Docker BuildKit
**Decision:** 在 deploy.sh 中设置 `DOCKER_BUILDKIT=1` 和 `COMPOSE_DOCKER_CLI_BUILD=1`

**Rationale:**
- BuildKit 提供更好的缓存机制和并行构建能力
- 支持缓存挂载（cache mounts），可以显著加速依赖安装
- 向后兼容，不影响现有构建流程

**Alternatives considered:**
- 不启用 BuildKit：无法使用缓存挂载等高级特性
- 全局配置：可能影响其他项目，选择在脚本中局部启用

### 2. 后端 Dockerfile 优化策略
**Decision:** 
- 使用多阶段构建（已存在，保持）
- 优化层顺序：先复制依赖文件，安装依赖，再复制代码
- 使用 BuildKit 缓存挂载加速 apt-get 和 uv 安装
- 合并 apt-get 命令减少层数

**Rationale:**
- 依赖文件（pyproject.toml, uv.lock）变更频率低于代码
- 先安装依赖可以最大化缓存命中率
- 缓存挂载可以避免每次重新下载包

**Implementation:**
```dockerfile
# 使用缓存挂载加速 apt-get
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 使用缓存挂载加速 uv 安装
RUN --mount=type=cache,target=/root/.cache/uv \
    pip install uv && \
    uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    UV_HTTP_TIMEOUT=120 UV_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple uv sync
```

### 3. 前端 Dockerfile 优化策略
**Decision:**
- 配置 npm 镜像源（使用淘宝镜像或腾讯云镜像）
- 优化层顺序：先复制 package.json 和 package-lock.json，安装依赖，再复制代码
- 使用 BuildKit 缓存挂载加速 npm install
- 保持多阶段构建（已存在）

**Rationale:**
- package.json 变更频率低于代码
- 国内镜像源可以显著加速 npm 包下载
- 缓存挂载可以避免每次重新下载 node_modules

**Implementation:**
```dockerfile
# 配置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 使用缓存挂载加速 npm install
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --frozen-lockfile
```

### 4. npm 镜像源配置方式
**Decision:** 在 Dockerfile 中通过 RUN 命令配置，同时创建 .npmrc 文件作为备选

**Rationale:**
- Dockerfile 中配置确保构建时使用镜像源
- .npmrc 文件可以在本地开发时也使用镜像源
- 两者结合提供最佳体验

**Alternatives considered:**
- 仅 .npmrc：需要确保文件被复制到镜像中
- 仅 Dockerfile：本地开发时无法享受镜像源加速

### 5. .dockerignore 优化
**Decision:** 确保 .dockerignore 正确排除不必要的文件，特别是 node_modules 和 .next

**Rationale:**
- 减少构建上下文大小可以加速构建
- 避免复制不必要的文件到镜像中

## Risks / Trade-offs

### Risks
1. **缓存失效问题：** 如果缓存挂载配置不当，可能导致依赖更新不及时
   - **Mitigation:** 使用 `--no-cache` 选项可以强制重新构建

2. **镜像源可用性：** 国内镜像源可能偶尔不可用
   - **Mitigation:** 可以回退到官方源，或配置多个镜像源

3. **BuildKit 兼容性：** 旧版本 Docker 可能不支持 BuildKit
   - **Mitigation:** 检查 Docker 版本，提供降级方案

### Trade-offs
- **构建时间 vs 缓存空间：** 使用缓存挂载会增加磁盘使用，但显著减少构建时间
- **镜像大小 vs 构建速度：** 优化后的镜像大小可能略有增加，但构建速度显著提升

## Migration Plan

1. **阶段 1：后端优化**
   - 更新 Dockerfile 使用缓存挂载
   - 测试构建时间和正确性

2. **阶段 2：前端优化**
   - 创建 .npmrc 配置镜像源
   - 更新 frontend/Dockerfile 使用缓存挂载和优化层顺序
   - 测试构建时间和正确性

3. **阶段 3：构建脚本优化**
   - 更新 deploy.sh 启用 BuildKit
   - 测试所有部署模式（-r, -b, -f, -c）

4. **验证：**
   - 对比优化前后的构建时间
   - 验证应用功能正常
   - 验证缓存命中率

## Open Questions

- 是否需要支持 Docker 版本检查，对于不支持 BuildKit 的版本提供降级方案？
  - **Decision:** 暂时不添加，因为 BuildKit 在 Docker 19.03+ 中可用，且可以通过环境变量禁用

- 是否需要在 CI/CD 中也应用这些优化？
  - **Note:** 本设计主要针对本地开发环境，CI/CD 环境可能需要额外配置

