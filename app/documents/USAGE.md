# 简化文书生成器使用说明

## 快速开始

### 1. 安装依赖

```bash
uv add docxtpl pyyaml
```

### 2. 基本使用

```python
from app.documents.simple_generator import SimpleDocumentGenerator

# 创建生成器
generator = SimpleDocumentGenerator()

# 准备案件数据
case_data = {
    "case_id": 12345,
    "case_type": "借款纠纷",
    "creditor_name": "张三",
    "debtor_name": "李四",
    "loan_amount": 50000.0,
    "description": "个人借款纠纷案件描述"
}

# 生成文书
result = generator.generate_document(
    template_id="complaint_template",
    case_data=case_data,
    custom_variables={
        "loan_date": "2023年1月1日",
        "due_date": "2023年12月31日"
    }
)

if result["success"]:
    print(f"文书生成成功: {result['file_path']}")
else:
    print(f"生成失败: {result['message']}")
```

## API接口

### 获取可用模板

```bash
GET /documents/templates
```

返回所有可用的文书模板列表。

### 生成文书

```bash
POST /documents/generate
```

请求体：
```json
{
    "template_id": "complaint_template",
    "case_data": {
        "case_id": 12345,
        "case_type": "借款纠纷",
        "creditor_name": "张三",
        "debtor_name": "李四",
        "loan_amount": 50000.0,
        "description": "案件描述"
    },
    "custom_variables": {
        "loan_date": "2023年1月1日",
        "due_date": "2023年12月31日"
    }
}
```

### 下载文书

```bash
GET /documents/download/{filename}
```

### 初始化模板

```bash
POST /documents/init-templates
```

创建示例模板文件。

### 健康检查

```bash
GET /documents/health
```

## 模板配置

模板配置在 `templates.yaml` 文件中定义：

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

## 支持的变量

### 自动映射变量

- `creditor_name`: 债权人姓名
- `debtor_name`: 债务人姓名
- `case_type`: 案件类型
- `loan_amount`: 借款金额
- `case_description`: 案件描述
- `case_id`: 案件ID

### 自动生成变量

- `current_date`: 当前日期（格式：YYYY年MM月DD日）
- `case_title`: 案件标题（自动生成）
- `document_number`: 文书编号（自动生成）

### 自定义变量

可以通过 `custom_variables` 参数传递任意自定义变量。

## 模板文件

### 模板语法

使用 `{{变量名}}` 的格式在Word文档中定义变量：

```
{{case_title}}

原告：{{creditor_name}}
被告：{{debtor_name}}
案由：{{case_type}}

诉讼请求：
1. 请求法院判令被告偿还借款本金{{loan_amount}}元及利息
```

### 模板文件位置

- 模板文件：`templates/documents/`
- 输出文件：`static/documents/`

## 测试

运行测试脚本：

```bash
python test_simple_generator.py
```

## 目录结构

```
app/documents/
├── __init__.py
├── simple_generator.py      # 核心生成器
├── simple_routers.py        # API路由
├── templates.yaml           # 模板配置
├── USAGE.md                 # 使用说明
└── README.md                # 详细文档

templates/
└── documents/               # 模板文件目录
    ├── complaint_template.docx
    └── evidence_list_template.docx

static/
└── documents/               # 生成的文书输出目录
```

## 故障排除

### 常见问题

1. **模板文件不存在**
   - 运行 `POST /documents/init-templates` 创建示例模板
   - 检查 `templates.yaml` 中的文件路径配置

2. **变量替换失败**
   - 确认模板中的变量名与配置一致
   - 检查案件数据是否包含必要的字段

3. **权限错误**
   - 确保应用有读写模板和输出目录的权限

### 调试模式

启用详细日志：

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 扩展开发

### 添加新模板

1. 在 `templates.yaml` 中添加模板配置
2. 创建对应的Word模板文件
3. 在模板中使用 `{{变量名}}` 定义变量

### 自定义变量处理

可以扩展 `_prepare_variables` 方法来自定义变量处理逻辑。

## 注意事项

1. **文件格式**: 模板文件必须是有效的 `.docx` 格式
2. **变量命名**: 变量名不能包含特殊字符，建议使用下划线分隔
3. **路径安全**: 确保文件路径安全，避免路径遍历攻击
4. **错误处理**: 生成失败时会记录详细错误信息


