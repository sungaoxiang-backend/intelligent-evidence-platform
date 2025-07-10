# 智能证据平台 (Intelligent Evidence Platform)

## 项目简介

智能证据平台是一个在法律债务纠纷领域中，对用户的案件和证据等进行智能管理的平台。该平台旨在提供高效、便捷的智能化证据管理服务，帮助企业内部相关人员更好地管理用户的案件和证据，提高案件处理效率和准确性。

## 技术栈

- **后端框架**: FastAPI (异步API服务)
- **ORM**: SQLAlchemy 2.0
- **数据库**: PostgreSQL + pgvector (支持传统数据和向量数据存储)
- **数据库迁移**: Alembic
- **数据库驱动**: asyncpg (异步支持)
- **认证**: JWT
- **存储**: 腾讯COS云存储
- **依赖管理**: uv

## 项目结构

```
.
├── app/                    # 应用主目录
│   ├── api/                # API路由聚合
│   │   └── v1.py           # v1版本API路由
│   ├── cases/              # 案件领域模块
│   ├── core/               # 核心配置
│   ├── db/                 # 数据库相关
│   ├── evidences/          # 证据领域模块
│   ├── integrations/       # 第三方服务集成
│   ├── staffs/             # 员工领域模块
│   ├── users/              # 用户领域模块
│   ├── main.py             # 应用入口
│   └── tests/              # 测试
├── alembic/                # 数据库迁移
├── .gitignore              # Git忽略文件
├── .python-version         # Python版本
├── pyproject.toml          # 项目配置
├── README.md               # 项目说明
└── uv.lock                 # 依赖锁定文件
```

## 核心模块

1. **staff模块**: 管理平台内部人员账户和权限
2. **user模块**: 管理用户信息
3. **case模块**: 管理用户案件信息
4. **evidence模块**: 管理用户证据信息

## 安装与运行

### 环境要求

- Python 3.12+
- PostgreSQL 14+ (支持pgvector扩展)
- uv (Python包管理工具)
- Docker & Docker Compose (可选，用于容器化部署)

### 安装步骤

1. 克隆仓库

```bash
git clone <repository-url>
cd intelligent-evidence-platform
```

2. 安装依赖

```bash
uv venv
source .venv/bin/activate  # Linux/macOS
# 或 .venv\Scripts\activate  # Windows
uv sync
```

3. 配置环境变量

项目使用不同的环境变量文件来区分本地开发环境和Docker环境：

- **本地开发环境**：使用`.env`文件
- **Docker环境**：使用`.env.docker`文件

#### 本地开发环境配置

创建`.env`文件并配置必要的环境变量：

```
# JWT配置
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS配置
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:8080"]

# 数据库配置
POSTGRES_SERVER=localhost  # 本地开发环境使用localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=evidence_platform

# 腾讯云COS配置
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_REGION=ap-guangzhou
COS_BUCKET=your_bucket_name

# 超级管理员配置
FIRST_SUPERUSER_USERNAME=admin
FIRST_SUPERUSER_EMAIL=admin@example.com
FIRST_SUPERUSER_PASSWORD=admin123
```

> 注意：Docker环境的配置在`.env.docker`文件中，主要区别是数据库主机设置为`db`而不是`localhost`。

4. 初始化数据库和创建超级管理员

```bash
# 应用数据库迁移
alembic upgrade head

# 创建超级管理员
python -m app.initial_data
```

### 数据库迁移

项目使用 Alembic 管理数据库迁移。以下是常用的数据库迁移命令：

#### 创建新的迁移

当你修改了模型（比如添加了新的表或字段）后，使用以下命令创建新的迁移：

```bash
alembic revision --autogenerate -m "描述你的改动"
```

#### 应用迁移

要将所有未应用的迁移应用到数据库，使用：

```bash
alembic upgrade head
```

如果要应用特定版本的迁移，可以使用版本号代替 `head`：

```bash
alembic upgrade <revision_id>
```

#### 回滚迁移

要回滚到上一个版本：

```bash
alembic downgrade -1
```

要回滚到特定版本：

```bash
alembic downgrade <revision_id>
```

#### 查看迁移历史

要查看当前的迁移历史：

```bash
alembic history
```

#### 查看当前版本

要查看当前数据库的迁移版本：

```bash
alembic current
```

5. 运行应用

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

或者使用提供的启动脚本：

```bash
chmod +x start.sh
./start.sh
```

访问 http://localhost:8000/docs 查看API文档

### Docker部署

项目支持使用Docker和Docker Compose进行容器化部署。

#### Docker环境配置

项目使用`.env.docker`文件为Docker环境提供配置。这个文件包含了适用于Docker环境的配置参数，特别是将数据库主机设置为`db`（容器服务名）而不是`localhost`。

您可以根据需要修改`.env.docker`文件中的配置：

```
# 数据库配置
POSTGRES_SERVER=db  # 注意这里使用容器服务名而不是localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=evidence_platform
```

#### 启动Docker服务

```bash
# 构建并启动容器
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

Docker部署会自动：
1. 创建一个带有pgvector扩展的PostgreSQL数据库
2. 构建并启动应用服务
3. 初始化数据库并创建超级管理员账户

访问 http://localhost:8000/docs 查看API文档

## API路由

- `/api/v1/login/access-token`: 登录接口
- `/api/v1/staffs`: 员工管理接口
- `/api/v1/users`: 用户管理接口
- `/api/v1/cases`: 案件管理接口
- `/api/v1/evidences`: 证据管理接口

## 初始超级管理员

系统启动时会自动创建一个超级管理员账户：

- 用户名：admin（可在.env文件中配置）
- 邮箱：admin@example.com（可在.env文件中配置）
- 密码：admin123（可在.env文件中配置）

## 开发指南

### 代码风格

项目使用Black、isort和Ruff进行代码格式化和检查：

```bash
# 格式化代码
black .
isort .

# 检查代码
ruff check .
mypy .
```

### 测试

```bash
pytest
```

## 许可证

[MIT](LICENSE)