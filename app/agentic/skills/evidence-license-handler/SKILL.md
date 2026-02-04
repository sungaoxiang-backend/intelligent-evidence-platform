---
name: evidence-license-handler
description: |
  处理营业执照图片（公司/个体工商户）。输出独立卡格式的 card_features 列表。
  输入：单张营业执照图片
  输出：独立卡格式（扁平列表）
---

# 营业执照处理技能

## 证据类型

- **card_type**: 公司营业执照 或 个体工商户营业执照
- **card_is_associated**: false（独立卡）
- **处理方式**: OCR提取

## 子类型区分

### 公司营业执照
- **标题**: 营业执照
- **关键特征**: 法定代表人、公司类型

### 个体工商户营业执照
- **标题**: 个体工商户营业执照
- **关键特征**: 经营者、经营场所

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（公司名称、信用代码、法定代表人等） |
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
  - url: "https://example.com/license.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/license.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析公司经营状况和诉讼主体资格"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 公司营业执照输出示例

#### 规则模式输出
```json
[
  {
    "slot_name": "公司名称",
    "slot_value": "XX科技有限公司",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从营业执照'名称'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "统一社会信用代码",
    "slot_value": "91110000ABCD123456",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从统一社会信用代码栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "法定代表人",
    "slot_value": "张三",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从法定代表人栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "公司类型",
    "slot_value": "有限责任公司",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从公司类型栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "住所地",
    "slot_value": "北京市朝阳区XX路XX号",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从住所地栏识别",
    "slot_group_info": null
  }
]
```

#### 增强模式输出（包含额外信息）
```json
{
  "card_type": "公司营业执照",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "公司名称",
      "slot_value": "XX科技有限公司",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从营业执照'名称'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "统一社会信用代码",
      "slot_value": "91110000ABCD123456",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从统一社会信用代码栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "法定代表人",
      "slot_value": "张三",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从法定代表人栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "公司类型",
      "slot_value": "有限责任公司",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从公司类型栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "住所地",
      "slot_value": "北京市朝阳区XX路XX号",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从住所地栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "诉讼主体资格",
      "slot_value": "公司为有限责任公司，具有独立诉讼主体资格，可作为被告",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "根据公司类型和统一社会信用代码分析",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "管辖法院分析",
      "slot_value": "公司住所地为北京，可在北京法院起诉",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "根据住所地分析管辖法院",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

### 个体工商户营业执照输出示例

#### 规则模式输出
```json
[
  {
    "slot_name": "公司名称",
    "slot_value": "XX商店",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从个体工商户名称栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "统一社会信用代码",
    "slot_value": "92110000EFGH789012",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从统一社会信用代码栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "经营类型",
    "slot_value": "零售业",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从经营范围栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "经营者姓名",
    "slot_value": "李四",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从经营者栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "住所地",
    "slot_value": "北京市海淀区XX路XX号",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从经营场所栏识别",
    "slot_group_info": null
  }
]
```

## 物理特征识别

### Decisive 特征（必须存在）
- 营业执照
- 国徽图标
- 红色印章
- 市场监督管理局

### Important 特征
- 统一社会信用代码
- 公司名称/经营名称
- 法定代表人/经营者
- 成立日期/注册日期

### 排除规则
- 企业信用信息公示系统截图
- 非官方证件

## 槽位定义

### 预设槽位（规则模式必提）

#### 公司营业执照
| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 公司名称 | string | 是 | 公司全称 |
| 统一社会信用代码 | string | 是 | 18位代码 |
| 法定代表人 | string | 是 | 法定代表人姓名 |
| 公司类型 | string | 是 | 有限责任公司/股份公司等 |
| 住所地 | string | 是 | 公司注册地址 |

#### 个体工商户营业执照
| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 公司名称 | string | 是 | 个体工商户名称 |
| 统一社会信用代码 | string | 是 | 18位代码 |
| 经营类型 | string | 是 | 经营范围类别 |
| 经营者姓名 | string | 是 | 经营者姓名 |
| 住所地 | string | 是 | 经营场所地址 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 诉讼主体资格 | string | 主体诉讼资格分析 |
| 管辖法院分析 | string | 管辖法院建议 |
| 经营状况 | string | 经营情况分析 |
| 信用代码特征 | string | 信用代码信息解析 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份营业执照制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份营业执照，顺便分析一下这家公司作为被告的诉讼资格

**处理**：预设槽位 + 诉讼主体资格分析

**用户指令**：
> 提取这份营业执照，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-id-card-handler - 身份证处理
- evidence-household-handler - 户籍档案处理
