## ADDED Requirements

### Requirement: Docker 构建性能优化
构建系统 SHALL 通过优化 Dockerfile、启用 BuildKit 缓存和配置镜像源来显著减少构建时间。

#### Scenario: 后端构建使用缓存挂载
- **WHEN** 执行 Docker 构建后端服务
- **THEN** apt-get 和 uv 安装过程使用 BuildKit 缓存挂载加速
- **AND** 依赖安装层可以独立缓存，代码变更时不需要重新安装依赖

#### Scenario: 前端构建使用缓存挂载和镜像源
- **WHEN** 执行 Docker 构建前端服务
- **THEN** npm 安装过程使用 BuildKit 缓存挂载加速
- **AND** npm 使用国内镜像源（如淘宝镜像）加速包下载
- **AND** 依赖安装层可以独立缓存，代码变更时不需要重新安装依赖

#### Scenario: 构建脚本启用 BuildKit
- **WHEN** 执行 deploy.sh 进行构建
- **THEN** Docker BuildKit 被自动启用
- **AND** 构建过程可以利用 BuildKit 的高级缓存特性

#### Scenario: 优化层缓存顺序
- **WHEN** Dockerfile 中复制文件和安装依赖
- **THEN** 依赖文件（如 package.json, pyproject.toml）在代码文件之前复制
- **AND** 依赖安装步骤在代码复制之前执行
- **AND** 代码变更时不会导致依赖重新安装

#### Scenario: 构建时间显著减少
- **WHEN** 在依赖未变更的情况下重新构建
- **THEN** 构建时间相比优化前减少至少 50%
- **AND** 构建结果与优化前保持一致

