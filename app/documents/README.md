# 文书生成模块 - 简化版本

## 功能概述

文书生成模块是一个能够根据案件数据自动生成Word文档的工具，支持多种文书类型，如起诉状、证据材料清单等。该模块采用**静态文件管理**的设计理念，无需数据库依赖，通过YAML配置文件和Word模板文件实现灵活配置。

## 🎯 设计理念

### 为什么选择静态文件管理？

1. **简单性**: 无需数据库迁移、表结构设计等复杂操作
2. **灵活性**: 配置文件可以直接修改，无需重新部署
3. **可维护性**: 模板文件可以版本控制，便于团队协作
4. **部署友好**: 减少外部依赖，部署更简单
5. **开发效率**: 快速迭代，无需考虑数据一致性

## 架构设计

### 简化模块结构

```
app/documents/
├── __init__.py          # 模块初始化，导出核心类
├── schemas.py           # API数据结构定义
├── services.py          # 业务逻辑服务层
├── routers.py           # API路由定义
├── templates.yaml       # 模板配置文件
├── README.md            # 模块说明文档
└── USAGE.md             # 使用说明文档
```

### 核心组件

1. **数据模式 (schemas.py)**
   - `DocumentGenerateRequest`: 文书生成请求
   - `DocumentGenerateResponse`: 文书生成响应
   - `DocumentTemplateInfo`: 文书模板信息
   - `CaseDataForDocument`: 案件数据模式

2. **业务服务 (services.py)**
   - `DocumentGenerator`: 文书生成器主类
   - 配置管理、模板处理、变量替换、文档生成

3. **API路由 (routers.py)**
   - RESTful API接口
   - 统一的响应格式
   - 完整的错误处理

## 技术特点

### 1. 静态配置管理
- 使用YAML配置文件管理模板信息
- 支持热重载，修改配置无需重启服务
- 结构化的变量定义和验证

### 2. 智能变量系统
- 自动映射案件数据到模板变量
- 支持自定义变量扩展
- 智能生成案件标题和编号

### 3. 模板引擎
- 使用docxtpl处理Word模板
- 支持`{{变量名}}`语法
- 自动创建默认模板文件

### 4. 文件管理
- 自动创建必要的目录结构
- 智能文件命名和路径管理
- 支持文件下载和访问

## 支持的文书类型

- **起诉状** (`complaint`): 适用于各种纠纷案件
- **证据材料清单** (`evidence_list`): 整理案件证据
- **调解协议** (`settlement_agreement`): 案件调解
- **判决书** (`judgment`): 法院判决
- **通知书** (`notice`): 各种法律通知
- **其他** (`other`): 自定义文书类型

## API接口

### 基础路径
```
/api/v1/documents/*
```

### 主要端点

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/templates` | 获取可用模板列表 |
| POST | `/generate` | 生成文书 |
| GET | `/download/{filename}` | 下载生成的文书 |
| POST | `/init-templates` | 初始化示例模板 |
| GET | `/health` | 健康检查 |

## 使用方法

### 1. 基本使用

```python
from app.documents.services import DocumentGenerator

# 创建生成器
generator = DocumentGenerator()

# 准备案件数据
case_data = {
    "case_id": 12345,
    "case_type": "借款纠纷",
    "creditor_name": "张三",
    "debtor_name": "李四",
    "loan_amount": 50000.0,
    "description": "个人借款纠纷案件"
}

# 生成文书
result = generator.generate_document(
    template_id="complaint_template",
    case_data=case_data,
    custom_variables={"loan_date": "2023年1月1日"}
)
```

### 2. API调用

```bash
# 生成起诉状
curl -X POST "http://localhost:8008/api/v1/documents/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "template_id": "complaint_template",
    "case_id": 12345,
    "variables": {
      "loan_date": "2023年1月1日",
      "due_date": "2023年12月31日"
    }
  }'
```

## 配置管理

### 模板配置 (templates.yaml)

```yaml
templates:
  complaint_template:
    name: "借款纠纷起诉状模板"
    type: "complaint"
    description: "适用于个人借款纠纷案件的起诉状模板"
    file_path: "templates/documents/complaint_template.docx"
    variables:
      - name: "creditor_name"
        description: "债权人姓名"
        required: true
        default: ""
      - name: "debtor_name"
        description: "债务人姓名"
        required: true
        default: ""
```

### 环境配置

- 模板目录: `templates/documents/`
- 输出目录: `static/documents/`
- 配置文件: `app/documents/templates.yaml`

## 扩展开发

### 添加新文书类型

1. **配置模板信息**
   ```yaml
   # 在templates.yaml中添加
   new_type_template:
     name: "新文书模板"
     type: "new_type"
     description: "新类型文书的描述"
     file_path: "templates/documents/new_type_template.docx"
     variables:
       - name: "custom_field"
         description: "自定义字段"
         required: true
   ```

2. **创建模板文件**
   - 在`templates/documents/`目录下创建`.docx`文件
   - 使用`{{变量名}}`语法定义变量占位符

3. **添加业务逻辑**（可选）
   ```python
   # 在DocumentGenerator中扩展变量处理
   def _prepare_variables(self, template, case_data, custom_variables):
       variables = super()._prepare_variables(...)
       
       if template.get("type") == "new_type":
           variables["special_field"] = self._calculate_special_value(case_data)
       
       return variables
   ```

### 自定义变量处理

```python
def _prepare_variables(self, template, case_data, custom_variables):
    variables = {
        "creditor_name": case_data.get("creditor_name", ""),
        "debtor_name": case_data.get("debtor_name", ""),
        "case_type": case_data.get("case_type", "借款纠纷"),
        # ... 其他基础变量
    }
    
    # 合并自定义变量
    if custom_variables:
        variables.update(custom_variables)
    
    return variables
```

## 维护和监控

### 健康检查

```bash
GET /api/v1/documents/health
```

返回系统状态信息：
- 目录存在性检查
- 模板文件完整性
- 服务运行状态

### 日志记录

- 使用项目统一的日志系统
- 记录所有关键操作
- 错误追踪和调试信息

### 性能优化

- 配置文件缓存
- 模板文件预加载
- 异步文件操作

## 最佳实践

### 1. 模板设计
- 使用清晰的变量命名
- 保持模板结构一致
- 添加必要的说明注释
- 使用版本控制管理模板文件

### 2. 配置管理
- 结构化变量定义
- 清晰的描述信息
- 合理的默认值设置
- 配置文件版本控制

### 3. 错误处理
- 完整的异常捕获
- 友好的错误信息
- 优雅的降级处理
- 详细的日志记录

### 4. 安全考虑
- 文件路径验证
- 用户权限检查
- 输入数据验证
- 文件访问控制

## 故障排除

### 常见问题

1. **模板文件不存在**
   - 检查文件路径配置
   - 运行初始化模板接口
   - 验证目录权限

2. **变量替换失败**
   - 确认模板语法正确
   - 检查变量名匹配
   - 验证数据完整性

3. **配置文件错误**
   - 检查YAML语法
   - 验证配置结构
   - 查看错误日志

### 调试方法

1. **启用详细日志**
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

2. **健康检查接口**
   ```bash
   curl http://localhost:8008/api/v1/documents/health
   ```

3. **配置文件验证**
   ```bash
   # 检查YAML语法
   python -c "import yaml; yaml.safe_load(open('app/documents/templates.yaml'))"
   ```

## 更新日志

### v3.0.0 - 简化版本
- 移除数据库依赖，使用静态文件管理
- 简化架构，提高开发效率
- 增强配置灵活性
- 优化部署和维护

### v2.0.0 - 标准版本
- 重构为标准模块架构
- 集成数据库操作
- 完整的CRUD接口
- 统一的错误处理

### v1.0.0 - 基础版本
- 基本的文书生成功能
- 配置文件管理
- 简单的API接口

## 优势总结

### 🚀 开发效率
- 无需数据库设计和迁移
- 配置文件直接修改生效
- 快速迭代和测试

### 🛠️ 维护简单
- 静态文件易于版本控制
- 配置变更无需重启
- 清晰的目录结构

### 🔧 部署友好
- 减少外部依赖
- 配置文件可打包部署
- 支持容器化部署

### 📚 团队协作
- 模板文件可共享
- 配置变更可追踪
- 支持分支开发

## 联系支持

如有问题或建议，请：
1. 查看项目文档
2. 检查日志信息
3. 运行健康检查
4. 联系开发团队
