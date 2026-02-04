---
name: evidence-household-handler
description: |
  处理户籍档案图片，提取户籍信息。输出符合 EvidenceCard 数据结构的 card_features 列表。
  输入：单张户籍档案图片
  输出：独立卡格式的 card_features（扁平列表）
---

# 户籍档案处理技能

## 证据类型

- **card_type**: 中华人民共和国居民户籍档案
- **card_is_associated**: false（独立卡）
- **处理方式**: OCR提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（姓名、关系、出生日期、户籍地址、身份证号等） |
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
  - url: "https://example.com/household.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/household.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析户籍地址与身份证地址是否一致"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "姓名",
    "slot_value": "王立飞",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从户籍档案'姓名'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "与户主关系",
    "slot_value": "本人",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从户籍档案'与户主关系'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "出生日期",
    "slot_value": "1984-11-06",
    "slot_value_type": "date",
    "confidence": 0.98,
    "reasoning": "从户籍档案'出生日期'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "籍贯",
    "slot_value": "湖北省黄梅县",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从户籍档案'籍贯'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "户籍地址",
    "slot_value": "湖北省黄梅县柳林乡柳林村一组",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从户籍档案'户籍地址'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "公民身份号码",
    "slot_value": "421127198411060237",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从户籍档案'公民身份号码'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "发证机关",
    "slot_value": "黄梅县公安局",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从户籍档案'户籍地所属派出所'栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "中华人民共和国居民户籍档案",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "姓名",
      "slot_value": "王立飞",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从户籍档案'姓名'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "与户主关系",
      "slot_value": "本人",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从户籍档案'与户主关系'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "出生日期",
      "slot_value": "1984-11-06",
      "slot_value_type": "date",
      "confidence": 0.98,
      "reasoning": "从户籍档案'出生日期'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "籍贯",
      "slot_value": "湖北省黄梅县",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从户籍档案'籍贯'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "户籍地址",
      "slot_value": "湖北省黄梅县柳林乡柳林村一组",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从户籍档案'户籍地址'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "公民身份号码",
      "slot_value": "421127198411060237",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从户籍档案'公民身份号码'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "发证机关",
      "slot_value": "黄梅县公安局",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从户籍档案'户籍地所属派出所'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "年龄推算",
      "slot_value": "40岁（截至2024年）",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "根据出生日期1984-11-06推算",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "户籍地分析",
      "slot_value": "户籍地为湖北省黄梅县柳林乡，属于农村地区",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从户籍地址解析地理位置",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 居民户口簿
- 公安机关户口专用章
- 户主页
- 常住人口登记卡

### Important 特征
- 户号
- 姓名
- 与户主关系
- 红色公章
- 特定表格和栏目

### 排除规则
- 户籍证明信
- 单页户籍证明

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 姓名 | string | 是 | 户籍登记姓名 |
| 与户主关系 | string | 是 | 与户主的关系 |
| 出生日期 | date | 是 | 格式 YYYY-MM-DD |
| 籍贯 | string | 否 | 籍贯信息 |
| 户籍地址 | string | 是 | 户籍地址 |
| 公民身份号码 | string | 是 | 18位身份证号 |
| 发证机关 | string | 否 | 派出所名称 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 年龄推算 | string | 根据出生日期推算年龄 |
| 户籍地分析 | string | 户籍地址的地理位置分析 |
| 户主信息 | string | 户主姓名和关系 |
| 行政区划代码 | string | 户籍地址对应的行政区划代码 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份户籍档案制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份户籍档案，顺便分析一下户籍地信息

**处理**：预设槽位 + 户籍地分析

**用户指令**：
> 提取这份户籍档案，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-id-card-handler - 身份证处理
