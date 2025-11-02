# 模板扩展指南

本文档说明如何扩展和新增更多的文书模板。

## 目录

1. [概述](#概述)
2. [模板文件结构](#模板文件结构)
3. [添加新模板的步骤](#添加新模板的步骤)
4. [字段类型说明](#字段类型说明)
5. [占位符命名规范](#占位符命名规范)
6. [常见问题](#常见问题)

## 概述

系统支持通过配置YAML文件和DOCX模板来动态生成表单和文档。每个模板包含：

- **YAML配置文件** (`template_schema.yaml`): 定义模板的结构、字段、表单配置
- **DOCX模板文件**: 包含占位符的Word文档，用于生成最终的文书
- **Markdown模板文件** (可选): 用于HTML预览和导出

## 模板文件结构

```
app/documents_template/
├── template_schema.yaml          # 所有模板的配置
├── [模板名称].docx               # DOCX模板文件
└── templates/
    └── [template_id].md          # Markdown模板（可选）
```

## 添加新模板的步骤

### 步骤1: 准备DOCX模板文件

1. 复制一个现有的DOCX模板作为基础（如 `买卖合同纠纷-起诉状模板.docx`）
2. 根据新模板的需求修改内容
3. 在需要动态填充的位置使用占位符，格式：`{{field_id}}`
4. 将文件保存到 `app/documents_template/` 目录

**占位符格式要求：**
- ✅ 正确：`{{field_id}}`（无空格）
- ❌ 错误：`{{ field_id }}`（有空格）
- ❌ 错误：`{{}}`（空占位符）

**注意事项：**
- 称呼可能因模板而异：
  - 起诉状：原告、被告
  - 撤诉申请书：申请人、被申请人
  - 其他模板：根据具体情况调整
- 确保占位符中的字段ID与YAML配置中的 `field_id` 一致

### 步骤2: 在YAML配置中添加模板定义

在 `template_schema.yaml` 文件的 `templates:` 部分添加新模板配置：

```yaml
templates:
  "新模板名称":
    # 基本信息
    template_id: "new_template_id"          # 唯一ID，使用snake_case
    name: "新模板显示名称"                    # 前端显示的模板名称
    type: "complaint"                        # 模板类型（complaint/application等）
    category: "模板分类"                      # 模板分类
    description: "模板描述"                   # 模板说明
    file_path: "app/documents_template/新模板.docx"  # DOCX文件路径
    
    # 模板说明（页面顶部显示）
    instructions:
      title: "说明"
      content: |
        说明内容
      items:
        - "说明项1"
        - "说明项2"
    
    # 特别提示（页面顶部显示）
    special_notice:
      title: "★特别提示★"
      content: |
        特别提示内容
    
    # 模板块列表（一级标题）
    blocks:
      - block_id: "party_info"
        title: "当事人信息"
        description: ""
        rows:
          - row_id: "row_id"
            subtitle: "二级标题"
            subtitle_width: 150
            fields:
              - field_id: "field_id"
                label: "字段标签"
                type: "text"
                required: false
                placeholder: "请输入..."
```

### 步骤3: 定义字段结构

在 `blocks` 中定义表单结构：

**一级标题（block）：**
- `block_id`: 块的唯一ID
- `title`: 一级标题文本（居中显示）

**二级标题（row）：**
- `row_id`: 行的唯一ID
- `subtitle`: 二级标题文本（左对齐，在表格左侧列）
- `subtitle_width`: 二级标题列宽度（px）

**字段（field）：**
- `field_id`: 字段唯一ID（必须与DOCX模板中的占位符一致）
- `label`: 字段标签（显示在表单中）
- `type`: 字段类型（见[字段类型说明](#字段类型说明)）
- `required`: 是否必填
- `placeholder`: 占位符文本
- 其他类型特定属性（如 `options`、`rows` 等）

### 步骤4: 创建Markdown模板（可选）

如果需要HTML预览功能，在 `app/documents_template/templates/` 目录下创建对应的 `.md` 文件：

- 文件名：`[template_id].md`
- 使用Jinja2语法：`{{field_id}}`
- 参考现有模板（如 `sales_contract_complaint.md`）

### 步骤5: 测试模板

1. 启动后端服务
2. 访问前端页面，选择新模板
3. 填写表单并生成文档
4. 检查生成的文档是否正确填充了所有占位符

## 字段类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `text` | 单行文本输入 | 姓名、地址 |
| `textarea` | 多行文本输入 | 事实与理由 |
| `select` | 下拉选择（单选） | 性别（如果选项多） |
| `radio` | 单选按钮组 | 性别（2-3个选项） |
| `checkbox` | 复选框组（多选） | 公司类型（多选） |
| `date` | 日期选择器 | 出生日期 |
| `datetime` | 日期时间选择器 | 事件时间 |
| `number` | 数字输入 | 金额 |

**字段类型示例：**

```yaml
# 文本输入
- field_id: "name"
  label: "姓名"
  type: "text"
  required: true
  placeholder: "请输入姓名"

# 下拉选择
- field_id: "gender"
  label: "性别"
  type: "select"
  required: false
  options:
    - { value: "男", label: "男" }
    - { value: "女", label: "女" }

# 单选按钮（2-3个选项时使用）
- field_id: "gender"
  label: "性别"
  type: "radio"
  required: false
  options:
    - { value: "男", label: "男" }
    - { value: "女", label: "女" }

# 复选框（多选）
- field_id: "company_types"
  label: "公司类型"
  type: "checkbox"
  required: false
  options:
    - { value: "有限责任公司", label: "有限责任公司" }
    - { value: "股份有限公司", label: "股份有限公司" }

# 日期
- field_id: "birthday"
  label: "出生日期"
  type: "date"
  required: false
  format: "YYYY-MM-DD"

# 多行文本
- field_id: "reason"
  label: "撤诉原因"
  type: "textarea"
  required: false
  placeholder: "请输入撤诉原因"
  rows: 3

# 数字
- field_id: "case_amount"
  label: "金额"
  type: "number"
  required: false
  placeholder: "请输入金额（元）"
```

## 占位符命名规范

### 当事人字段命名

根据称呼类型使用不同的前缀：

**起诉状（原告/被告）：**
- 原告：`plaintiff_*`（如 `plaintiff_name`）
- 被告：`defendant_*`（如 `defendant_name`）
- 第三人：`third_party_*`（如 `third_party_name`）

**撤诉申请书（申请人/被申请人）：**
- 申请人：`applicant_*`（如 `applicant_name`）
- 被申请人：`respondent_*`（如 `respondent_name`）
- 第三人：`third_party_*`（如 `third_party_name`）

**其他模板：**
- 根据具体情况选择合适的命名

### 常用字段ID列表

**自然人字段：**
- `{prefix}_name`: 姓名
- `{prefix}_gender`: 性别
- `{prefix}_birthday`: 出生日期
- `{prefix}_nation`: 民族
- `{prefix}_address`: 住所地
- `{prefix}_current_residence`: 经常居住地
- `{prefix}_id_card`: 身份证号
- `{prefix}_contact_phone`: 联系电话

**法人字段：**
- `{prefix}_company_name`: 名称
- `{prefix}_company_address`: 住所地
- `{prefix}_unified_social_credit_code`: 统一社会信用代码
- `{prefix}_legal_representative`: 代表人/负责人名称
- `{prefix}_position`: 代表人/负责人职务
- `{prefix}_legal_rep_*`: 代表人信息（同上自然人字段）

**代理人字段：**
- `{prefix}_agent_*`: 代理人的所有字段（同上自然人字段）

**案件相关字段：**
- `case_amount`: 金额
- `case_cause_type`: 纠纷类型
- `case_number`: 案号
- `reason`: 理由/原因
- `creditor_name`: 债权人姓名
- `debtor_name`: 债务人姓名

## 常见问题

### Q1: 占位符没有填充内容

**检查清单：**
1. DOCX模板中的占位符格式是否正确：`{{field_id}}`（无空格）
2. YAML配置中的 `field_id` 是否与占位符一致
3. 占位符中是否有拼写错误

### Q2: 生成的文档格式不正确

**可能原因：**
1. DOCX模板的表格结构被破坏
2. 占位符位置不合适（不在表格单元格中）

**解决方案：**
- 保持DOCX模板的原始表格结构
- 占位符应放在表格的第二列（右侧列）中

### Q3: 表单字段没有显示

**检查清单：**
1. YAML配置中的 `blocks` 结构是否正确
2. `field_id` 是否唯一
3. 字段类型是否支持

### Q4: 称呼不匹配

**问题：** 模板中使用了"原告/被告"，但实际需要"申请人/被申请人"

**解决方案：**
1. 在DOCX模板中修改称呼文本
2. 在YAML配置中使用对应的字段ID（`applicant_*` / `respondent_*`）
3. 确保占位符使用正确的字段ID

### Q5: 如何复制现有模板？

**步骤：**
1. 复制DOCX模板文件并重命名
2. 在YAML中复制现有模板配置
3. 修改 `template_id`、`name`、`file_path` 等基本信息
4. 根据需要调整字段定义
5. 更新DOCX模板中的占位符（如果有变更）

## 示例：添加"撤诉申请书"模板

参考 `撤诉申请书模板` 的配置，了解如何从"原告/被告"转换为"申请人/被申请人"。

**关键点：**
1. 字段ID使用 `applicant_*` 和 `respondent_*` 前缀
2. DOCX模板中的称呼改为"申请人"、"被申请人"
3. 占位符使用对应的字段ID

## 总结

添加新模板的核心步骤：

1. ✅ 准备DOCX模板（含占位符）
2. ✅ 在YAML中添加模板配置
3. ✅ 定义表单字段结构
4. ✅ （可选）创建Markdown模板
5. ✅ 测试验证

遵循命名规范和格式要求，可以快速扩展新的模板。

