---
name: evidence-io-handler
description: |
  处理借条/欠条图片。输出独立卡格式的 card_features 列表。
  输入：单张借条或欠条图片
  输出：独立卡格式（扁平列表）
---

# 借条/欠条处理技能

## 证据类型

- **card_type**: 借款借条 或 货款欠条
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 子类型区分

### 借款借条
- **关键词**: 借款、借钱、借到、借出
- **事由**: 借款、借钱等

### 货款欠条
- **关键词**: 货款、欠货款、货、货物、商品、买卖
- **事由**: 货物交易等

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（债务人、金额、日期、利息等） |
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
  - url: "https://example.com/iou.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/iou.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "看看有没有约定管辖法院"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "债务人真名",
    "slot_value": "王立飞",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从借条借款人签名栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "债务人身份证号",
    "slot_value": "421127198411060237",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从借条身份证号栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "借款金额（大写）",
    "slot_value": "伍仟元整",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从借条大写金额栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "借款金额（小写）",
    "slot_value": 5000.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从借条小写金额栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "借款日期",
    "slot_value": "2024-01-15",
    "slot_value_type": "date",
    "confidence": 0.95,
    "reasoning": "从借条日期栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "约定还款日期",
    "slot_value": "2024-06-15",
    "slot_value_type": "date",
    "confidence": 0.90,
    "reasoning": "从借条约定还款日期栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "约定利息",
    "slot_value": "月息1分",
    "slot_value_type": "string",
    "confidence": 0.85,
    "reasoning": "从借条利息约定栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "借款借条",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "债务人真名",
      "slot_value": "王立飞",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从借条借款人签名栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "债务人身份证号",
      "slot_value": "421127198411060237",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从借条身份证号栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款金额（大写）",
      "slot_value": "伍仟元整",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从借条大写金额栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款金额（小写）",
      "slot_value": 5000.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从借条小写金额栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款日期",
      "slot_value": "2024-01-15",
      "slot_value_type": "date",
      "confidence": 0.95,
      "reasoning": "从借条日期栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "约定还款日期",
      "slot_value": "2024-06-15",
      "slot_value_type": "date",
      "confidence": 0.90,
      "reasoning": "从借条约定还款日期栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "约定利息",
      "slot_value": "月息1分",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "从借条利息约定栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "管辖法院分析",
      "slot_value": "借条未约定管辖法院，应由债务人住所地或合同履行地法院管辖",
      "slot_value_type": "string",
      "confidence": 0.80,
      "reasoning": "从借条全文查找管辖条款，未发现明确约定",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "诉讼时效分析",
      "slot_value": "约定还款日期为2024-06-15，诉讼时效至2027-06-15",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "根据约定还款日期推算诉讼时效",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### 借款借条 - Decisive 特征
- 借款
- 借钱
- 借到
- 借出
- 借款借条
- 欠借款

### 借款借条 - Important 特征
- 欠条
- 借款
- 借钱
- 借到
- 利息
- 借款人签名
- 身份证号

### 货款欠条 - Decisive 特征
- 货款
- 货款欠条
- 欠货款
- 货
- 货物
- 商品
- 买卖

### 排除规则
- 借款借条排除：货款、货物、商品、买卖、拿货
- 货款欠条排除：借款、借钱、借到、借出、收条

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 债务人真名 | string | 是 | 借款人姓名 |
| 债务人身份证号 | string | 否 | 身份证号码 |
| 借款金额（小写） | number | 是 | 数字金额 |
| 借款金额（大写） | string | 否 | 大写金额 |
| 借款日期 | date | 是 | 借款日期 |
| 约定还款日期 | date | 否 | 约定还款时间 |
| 约定利息 | string | 否 | 利息约定 |
| 欠款合意 | boolean | 是 | 是否有借款合意 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 管辖法院分析 | string | 约定的管辖法院或法定管辖 |
| 诉讼时效分析 | string | 诉讼时效起算和届满时间 |
| 逾期利息约定 | string | 逾期还款的利息约定 |
| 违约金条款 | string | 违约金相关约定 |
| 借款用途 | string | 借款的具体用途 |
| 债权人信息 | string | 借条中可能包含的债权人信息 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份借条制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份借条，顺便看看有没有约定管辖法院

**处理**：预设槽位 + 管辖法院分析

**用户指令**：
> 提取这份借条，分析一下诉讼时效情况

**处理**：预设槽位 + 诉讼时效分析

**用户指令**：
> 提取这份借条，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-bank-transfer-handler - 银行转账记录处理
- evidence-wechat-voucher-handler - 微信支付凭证处理
