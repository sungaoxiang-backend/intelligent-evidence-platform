# 文档模板使用说明

## 模板文件结构

### 1. YAML配置文件 (template_schema.yaml)

YAML配置文件定义了模板的结构，包括：
- 模板基本信息（名称、类型、描述）
- 模板说明和特别提示
- 表单结构（块、行、字段）

### 2. DOCX模板文件

DOCX模板文件是实际的Word文档模板，需要包含占位符来替换用户填写的数据。

## 占位符使用说明

在DOCX模板文件中，使用 `{{field_id}}` 格式的占位符来引用表单字段的值。

### 示例

假设YAML中定义了以下字段：
```yaml
- field_id: "plaintiff_name"
  label: "名称"
  type: "text"
```

那么在DOCX模板中，可以使用：
```
原告名称：{{plaintiff_name}}
```

### 支持的占位符格式

1. **基本字段占位符**：`{{field_id}}`
   - 直接使用字段ID作为占位符

2. **嵌套选项占位符**：`{{field_id_option_value}}`
   - 例如：`{{plaintiff_entity_type_国有}}` 用于获取"国有"选项下的嵌套值

3. **通用变量**：
   - `{{current_date}}` - 当前日期（格式：YYYY年MM月DD日）
   - `{{generated_at}}` - 生成时间（ISO格式）

## 模板文件示例

### 买卖合同纠纷起诉状模板示例

在DOCX文件中，可以这样使用占位符：

```
民事起诉状（买卖合同纠纷）

原告（自然人）：
姓名：{{plaintiff_name}}
性别：{{plaintiff_gender}}
出生日期：{{plaintiff_birthday}}
民族：{{plaintiff_nation}}
公民身份号码：{{plaintiff_id_card}}
住址：{{plaintiff_address}}

原告（法人、非法人组织）：
名称：{{plaintiff_company_name}}
住所地：{{plaintiff_company_address}}
注册地/登记地：{{plaintiff_registered_address}}
法定代表人/主要负责人：{{plaintiff_legal_representative}}
职务：{{plaintiff_position}}
联系电话：{{plaintiff_contact_phone}}
统一社会信用代码：{{plaintiff_unified_social_credit_code}}
类型：{{plaintiff_entity_type}}

诉讼请求：
{{claim_content}}

法律依据：
{{legal_basis}}

生成日期：{{current_date}}
```

## 注意事项

1. **占位符大小写敏感**：占位符中的字段ID必须与YAML中定义的完全一致
2. **空值处理**：如果字段值为空，占位符会被替换为空字符串
3. **列表字段**：对于checkbox类型的多选字段，多个值会用中文逗号连接
4. **日期格式**：日期字段会自动转换为字符串格式

## 创建新模板的步骤

1. 在 `template_schema.yaml` 中添加模板配置
2. 创建对应的DOCX模板文件
3. 在DOCX文件中使用 `{{field_id}}` 占位符
4. 确保 `file_path` 路径正确指向DOCX文件

