# 企微外部联系人数据同步指南

## 概述

本系统实现了企微外部联系人数据的自动同步功能，支持从企微API获取所有已服务的外部联系人数据，并同步到本地数据库。

## 功能特性

- ✅ **分页处理**: 自动处理企微API的分页限制，支持大量数据同步
- ✅ **去重处理**: 智能识别和处理重复数据，避免数据冗余
- ✅ **增量同步**: 支持增量同步，只处理新增或变更的数据
- ✅ **全量同步**: 支持全量同步，确保数据完整性
- ✅ **定时任务**: 集成Celery定时任务，支持自动同步
- ✅ **监控告警**: 提供健康状态监控和错误告警
- ✅ **API接口**: 提供RESTful API接口，支持手动触发同步
- ✅ **命令行工具**: 提供命令行脚本，支持灵活的数据同步操作

## 快速开始

### 1. 环境配置

确保以下环境变量已正确配置：

```bash
# 企微配置
WECOM_CORP_ID=your_corp_id
WECOM_CORP_SECRET=your_corp_secret
WECOM_AGENT_ID=your_agent_id
WECOM_TOKEN=your_token
WECOM_ENCODING_AES_KEY=your_encoding_aes_key
WECOM_CALLBACK_URL=your_callback_url

# 数据库配置
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_database

# Celery配置
CELERY_BROKER_URL=redis://localhost:6380/0
CELERY_RESULT_BACKEND=redis://localhost:6380/0
```

### 2. 启动服务

```bash
# 启动主应用
uv run python -m app.main

# 启动Celery Worker（用于定时任务）
uv run celery -A app.core.celery_app worker --loglevel=info --queue=wecom_sync

# 启动Celery Beat（用于定时调度）
uv run celery -A app.core.celery_app beat --loglevel=info
```

### 3. 执行同步

#### 使用API接口

```bash
# 增量同步
curl -X POST "http://localhost:8000/api/v1/wecom/sync/contacts?mode=incremental"

# 全量同步
curl -X POST "http://localhost:8000/api/v1/wecom/sync/contacts?mode=full&force=true"

# 查看同步状态
curl -X GET "http://localhost:8000/api/v1/wecom/sync/status"

# 测试同步（只获取数据，不写入数据库）
curl -X POST "http://localhost:8000/api/v1/wecom/sync/test"
```

#### 使用命令行脚本

```bash
# 增量同步
uv run python scripts/sync_wecom_contacts.py --mode incremental

# 全量同步
uv run python scripts/sync_wecom_contacts.py --mode full

# 查看同步状态
uv run python scripts/sync_wecom_contacts.py --mode status

# 测试模式（只获取数据，不写入数据库）
uv run python scripts/sync_wecom_contacts.py --mode test

# 详细输出
uv run python scripts/sync_wecom_contacts.py --mode incremental --verbose
```

## API接口文档

### 同步接口

#### 同步外部联系人
- **URL**: `POST /api/v1/wecom/sync/contacts`
- **参数**:
  - `mode`: 同步模式，`full`（全量）或 `incremental`（增量）
  - `force`: 是否强制同步，`true` 或 `false`
- **返回**: 同步结果统计

#### 获取同步状态
- **URL**: `GET /api/v1/wecom/sync/status`
- **返回**: 当前同步状态统计

#### 测试同步
- **URL**: `POST /api/v1/wecom/sync/test`
- **返回**: 测试结果和数据统计

### 监控接口

#### 获取健康状态
- **URL**: `GET /api/v1/wecom/monitor/health`
- **返回**: 同步健康状态和指标

#### 获取同步指标
- **URL**: `GET /api/v1/wecom/monitor/metrics?days=7`
- **参数**: `days`: 统计天数（1-30）
- **返回**: 同步指标和趋势分析

#### 获取告警信息
- **URL**: `GET /api/v1/wecom/monitor/alerts`
- **返回**: 当前告警信息

## 定时任务配置

系统已预配置以下定时任务：

- **增量同步**: 每小时执行一次
- **全量同步**: 每天凌晨2点执行
- **数据清理**: 每周日凌晨3点执行

### 自定义定时任务

可以通过修改 `app/tasks/wecom_sync_tasks.py` 中的配置来自定义定时任务：

```python
celery_app.conf.beat_schedule.update({
    'custom-sync-task': {
        'task': 'wecom.sync_contacts_incremental',
        'schedule': crontab(minute=30, hour=2),  # 每天凌晨2:30执行
        'options': {
            'queue': 'wecom_sync',
            'priority': 5
        }
    }
})
```

## 监控和告警

### 健康状态指标

系统会监控以下指标：

1. **同步成功率**
2. **数据一致性**
3. **错误率**
4. **同步延迟**

### 告警规则

- **健康分数 < 60**: 严重告警
- **错误率 > 5/天**: 警告
- **同步延迟 > 2小时**: 警告

### 查看监控数据

```bash
# 获取健康状态
curl -X GET "http://localhost:8000/api/v1/wecom/monitor/health"

# 获取7天指标
curl -X GET "http://localhost:8000/api/v1/wecom/monitor/metrics?days=7"

# 获取告警信息
curl -X GET "http://localhost:8000/api/v1/wecom/monitor/alerts"
```

## 数据模型

### 外部联系人 (ExternalContact)
- `external_user_id`: 企微外部用户ID
- `name`: 联系人姓名
- `avatar`: 头像URL
- `type`: 联系人类型
- `status`: 状态（正常/删除/拉黑）
- `contact_type`: 联系类型（完整/半联系）

### 客户会话 (CustomerSession)
- `session_id`: 会话ID
- `staff_id`: 员工ID
- `external_contact_id`: 外部联系人ID
- `source`: 来源（事件/同步导入）
- `is_active`: 是否活跃

### 员工 (WeComStaff)
- `user_id`: 企微用户ID
- `name`: 员工姓名
- `status`: 状态（活跃/非活跃）

## 故障排除

### 常见问题

1. **API调用失败**
   - 检查企微配置是否正确
   - 确认access_token是否有效
   - 检查网络连接

2. **数据库连接失败**
   - 检查数据库配置
   - 确认数据库服务是否运行
   - 检查数据库权限

3. **同步数据不完整**
   - 检查API权限配置
   - 确认应用是否在"客户联系 可调用接口的应用"中
   - 查看错误日志

4. **定时任务不执行**
   - 检查Celery Worker是否运行
   - 确认Celery Beat是否启动
   - 检查任务队列配置

### 日志查看

```bash
# 查看应用日志
tail -f logs/app_$(date +%Y-%m-%d).log

# 查看同步日志
tail -f logs/wecom_sync_$(date +%Y%m%d).log

# 查看Celery日志
uv run celery -A app.core.celery_app events
```

### 调试模式

```bash
# 启用详细日志
export LOG_LEVEL=DEBUG

# 测试模式运行
uv run python scripts/sync_wecom_contacts.py --mode test --verbose
```

## 性能优化

### 批量处理
- 系统默认每批处理1000条记录
- 可通过修改 `batch_size` 参数调整

### 数据库优化
- 建议为 `external_user_id` 字段创建索引
- 定期清理过期数据
- 监控数据库性能

### API限制
- 企微API有频率限制，系统已内置延迟处理
- 建议在业务低峰期执行全量同步

## 安全考虑

1. **API密钥安全**: 确保企微配置信息安全存储
2. **数据脱敏**: 日志中已对敏感信息进行脱敏处理
3. **访问控制**: 建议为同步接口添加适当的访问控制
4. **数据备份**: 定期备份同步数据

## 更新日志

- **v1.0.0**: 初始版本，支持基础同步功能
- **v1.1.0**: 添加监控和告警功能
- **v1.2.0**: 优化性能，支持大批量数据处理

## 技术支持

如有问题，请查看：
1. 系统日志文件
2. 监控告警信息
3. 企微官方API文档
4. 项目README文档
