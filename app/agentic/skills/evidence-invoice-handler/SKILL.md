---
name: evidence-invoice-handler
description: |
  处理增值税发票图片。输出独立卡格式的 card_features 列表。
  输入：单张增值税发票图片
  输出：独立卡格式（扁平列表）
---

# 发票处理技能

## 证据类型

- **card_type**: 增值税发票
- **card_is_associated**: false（独立卡）
- **处理方式**: OCR提取

## 子类型
- 增值税专用发票
- 增值税普通发票

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（发票代码、号码、金额、买卖方信息等） |
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
  - url: "https://example.com/invoice.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/invoice.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析买卖双方是否存在业务关系"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "发票类型",
    "slot_value": "增值税专用发票",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从发票顶部标题识别",
    "slot_group_info": null
  },
  {
    "slot_name": "发票代码",
    "slot_value": "1100232130",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从发票代码栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "发票号码",
    "slot_value": "12345678",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从发票号码栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "购买方名称",
    "slot_value": "XX公司",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从购买方名称栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "购买方纳税人识别号",
    "slot_value": "91110000ABCD123456",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从购买方纳税人识别号栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "销售方名称",
    "slot_value": "YY公司",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从销售方名称栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "销售方纳税人识别号",
    "slot_value": "91310000EFGH987654",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从销售方纳税人识别号栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "货物或应税劳务名称",
    "slot_value": "建材",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从货物或应税劳务名称栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "金额",
    "slot_value": 1000.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从金额栏识别，不含税",
    "slot_group_info": null
  },
  {
    "slot_name": "税额",
    "slot_value": 130.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从税额栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "价税合计",
    "slot_value": 1130.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从价税合计栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "开票日期",
    "slot_value": "2024-01-15",
    "slot_value_type": "date",
    "confidence": 0.95,
    "reasoning": "从开票日期栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "增值税发票",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "发票类型",
      "slot_value": "增值税专用发票",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从发票顶部标题识别",
      "slot_group_info": null
    },
    {
      "slot_name": "发票代码",
      "slot_value": "1100232130",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从发票代码栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "发票号码",
      "slot_value": "12345678",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从发票号码栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "购买方名称",
      "slot_value": "XX公司",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从购买方名称栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "购买方纳税人识别号",
      "slot_value": "91110000ABCD123456",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从购买方纳税人识别号栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "销售方名称",
      "slot_value": "YY公司",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从销售方名称栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "销售方纳税人识别号",
      "slot_value": "91310000EFGH987654",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从销售方纳税人识别号栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "货物或应税劳务名称",
      "slot_value": "建材",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从货物或应税劳务名称栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "金额",
      "slot_value": 1000.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从金额栏识别，不含税",
      "slot_group_info": null
    },
    {
      "slot_name": "税额",
      "slot_value": 130.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从税额栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "价税合计",
      "slot_value": 1130.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从价税合计栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "开票日期",
      "slot_value": "2024-01-15",
      "slot_value_type": "date",
      "confidence": 0.95,
      "reasoning": "从开票日期栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "业务关系分析",
      "slot_value": "购买方与销售方为不同主体，存在建材买卖业务关系",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "从发票显示的买卖方名称和货物类型分析",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "税负分析",
      "slot_value": "销售方应纳税额130元，税率13%",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "根据税额和金额计算税率",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 增值税专用发票 / 增值税普通发票
- 发票监制章
- 发票代码
- 发票号码

### Important 特征
- 购买方信息
- 销售方信息
- 金额合计
- 税额合计
- 二维码
- 标准表格格式

### 排除规则
- 购物小票
- 收据
- 非官方发票

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 发票类型 | string | 是 | 专用发票/普通发票 |
| 发票代码 | string | 是 | 10位发票代码 |
| 发票号码 | string | 是 | 8位发票号码 |
| 购买方名称 | string | 是 | 购买方公司名称 |
| 购买方纳税人识别号 | string | 是 | 购买方税号 |
| 销售方名称 | string | 是 | 销售方公司名称 |
| 销售方纳税人识别号 | string | 是 | 销售方税号 |
| 货物或应税劳务名称 | string | 是 | 货物/服务名称 |
| 金额 | number | 是 | 不含税金额 |
| 税额 | number | 是 | 税额 |
| 价税合计 | number | 是 | 价税合计金额 |
| 开票日期 | date | 是 | 开票日期 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 业务关系分析 | string | 买卖双方业务关系分析 |
| 税负分析 | string | 税率和税负情况 |
| 发票真伪特征 | string | 防伪特征描述 |
| 交易背景 | string | 交易背景分析 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份发票制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份发票，顺便分析一下买卖双方的业务关系

**处理**：预设槽位 + 业务关系分析

**用户指令**：
> 提取这份发票，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-license-handler - 营业执照处理
- evidence-io-handler - 借条欠条处理
