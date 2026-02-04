---
name: evidence-id-card-handler
description: |
  处理身份证图片，提取身份信息。输出符合 EvidenceCard 数据结构的 card_features 列表。
  输入：单张身份证图片（证据ID可选）
  输出：独立卡格式的 card_features（扁平列表）
---

# 身份证处理技能

## 证据类型

- **card_type**: 身份证
- **card_is_associated**: false（独立卡）
- **处理方式**: OCR提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（姓名、性别、民族、出生日期、住址、身份证号） |
| **增强模式** | 预设槽位 + 额外开放信息（根据证据内容提取有价值信息） |

### 模式识别关键词

| 模式 | 触发关键词 |
|------|------------|
| 规则模式 | "提取制作证据卡片"、"提取证据信息" |
| 增强模式 | "开放式提取"、"顺便"、"分析"、"看看还有" |

## 输入

### 规则模式（默认）
```yaml
evidence_materials:
  - url: "https://example.com/id_card.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/id_card.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析身份证地址信息是否与户籍地址一致"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "姓名",
    "slot_value": "张三",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从身份证正面人像面'姓名'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "性别",
    "slot_value": "男",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从身份证正面人像面'性别'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "民族",
    "slot_value": "汉族",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从身份证正面人像面'民族'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "出生日期",
    "slot_value": "1990-01-01",
    "slot_value_type": "date",
    "confidence": 0.98,
    "reasoning": "从身份证正面人像面'出生'栏识别，格式化为YYYY-MM-DD",
    "slot_group_info": null
  },
  {
    "slot_name": "住址",
    "slot_value": "北京市朝阳区XX路XX号",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从身份证正面人像面'住址'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "公民身份号码",
    "slot_value": "110101199001011234",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从身份证正面人像面'公民身份号码'栏识别，18位号码",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "身份证",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "姓名",
      "slot_value": "张三",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面'姓名'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "性别",
      "slot_value": "男",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面'性别'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "民族",
      "slot_value": "汉族",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面'民族'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "出生日期",
      "slot_value": "1990-01-01",
      "slot_value_type": "date",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面'出生'栏识别，格式化为YYYY-MM-DD",
      "slot_group_info": null
    },
    {
      "slot_name": "住址",
      "slot_value": "北京市朝阳区XX路XX号",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从身份证正面人像面'住址'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "公民身份号码",
      "slot_value": "110101199001011234",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面'公民身份号码'栏识别，18位号码",
      "slot_group_info": null
    },
    {
      "slot_name": "年龄推算",
      "slot_value": "34岁（截至2024年）",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "根据出生日期1990-01-01推算",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "身份证地区代码",
      "slot_value": "110101",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证号码前6位识别，代表北京市朝阳区",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 中华人民共和国居民身份证
- 国徽
- 长城图案
- 签发机关

### Important 特征
- 姓名
- 性别
- 民族
- 出生
- 住址
- 公民身份号码
- 个人头像照片

### 排除规则
- 临时身份证
- 户口簿
- 驾驶证

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 姓名 | string | 是 | 持证人姓名 |
| 性别 | string | 是 | 男/女 |
| 民族 | string | 是 | 民族 |
| 出生日期 | date | 是 | 格式 YYYY-MM-DD |
| 住址 | string | 是 | 户籍地址 |
| 公民身份号码 | string | 是 | 18位身份证号 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 年龄推算 | string | 根据出生日期推算年龄 |
| 身份证地区代码 | string | 身份证号码前6位地区代码 |
| 出生年份特征 | string | 出生年份的补充信息 |
| 地址详细信息 | string | 对住址的详细解析 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份身份证制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份身份证，顺便分析一下年龄和地区信息

**处理**：预设槽位 + 年龄推算 + 地区代码分析

**用户指令**：
> 提取这份身份证，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-household-handler - 户籍档案处理
