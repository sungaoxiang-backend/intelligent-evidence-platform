---
name: evidence-bank-transfer-handler
description: |
  处理银行转账记录图片（银行App、网上银行或柜台回单）。输出独立卡格式的 card_features 列表。
  输入：单张银行转账记录截图
  输出：独立卡格式（扁平列表）
---

# 银行转账记录处理技能

## 证据类型

- **card_type**: 银行转账记录
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（银行名称、账户名、账号、金额、时间等） |
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
  - url: "https://example.com/bank_transfer.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/bank_transfer.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析这笔转账是否可能是借款"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "银行名称",
    "slot_value": "中国工商银行",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从银行Logo和文识别银行名称",
    "slot_group_info": null
  },
  {
    "slot_name": "付款方账户名",
    "slot_value": "张三",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从交易明细'付款方'栏识别账户名",
    "slot_group_info": null
  },
  {
    "slot_name": "付款方账号",
    "slot_value": "6222***********1234",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从交易明细'付款方账号'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "收款方账户名",
    "slot_value": "李四",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从交易明细'收款方'栏识别账户名",
    "slot_group_info": null
  },
  {
    "slot_name": "收款方账号",
    "slot_value": "6222***********5678",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从交易明细'收款方账号'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "转账金额",
    "slot_value": 10000.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从交易金额栏识别，单位元",
    "slot_group_info": null
  },
  {
    "slot_name": "交易时间",
    "slot_value": "2024-01-15 14:30:00",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从交易时间栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "交易流水号",
    "slot_value": "ED202401150001",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从交易流水号栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "银行转账记录",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "银行名称",
      "slot_value": "中国工商银行",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从银行Logo和文识别银行名称",
      "slot_group_info": null
    },
    {
      "slot_name": "付款方账户名",
      "slot_value": "张三",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从交易明细'付款方'栏识别账户名",
      "slot_group_info": null
    },
    {
      "slot_name": "付款方账号",
      "slot_value": "6222***********1234",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从交易明细'付款方账号'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "收款方账户名",
      "slot_value": "李四",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从交易明细'收款方'栏识别账户名",
      "slot_group_info": null
    },
    {
      "slot_name": "收款方账号",
      "slot_value": "6222***********5678",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从交易明细'收款方账号'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "转账金额",
      "slot_value": 10000.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从交易金额栏识别，单位元",
      "slot_group_info": null
    },
    {
      "slot_name": "交易时间",
      "slot_value": "2024-01-15 14:30:00",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从交易时间栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "交易流水号",
      "slot_value": "ED202401150001",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从交易流水号栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款可能性分析",
      "slot_value": "单笔大额转账，收款方与付款方无明显业务关联，可能是个人间借款",
      "slot_value_type": "string",
      "confidence": 0.75,
      "reasoning": "从转账金额较大、双方无企业关联等特征分析",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 银行Logo
- 交易流水号
- 银行回单格式

### Important 特征
- 付款人账号户名
- 收款人账号户名
- 交易金额
- 交易时间
- 表格化交易详情

### 排除规则
- 微信转账记录
- 支付宝转账记录

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 银行名称 | string | 是 | 银行名称 |
| 付款方账户名 | string | 是 | 付款方账户名称 |
| 付款方账号 | string | 是 | 付款方银行账号 |
| 收款方账户名 | string | 是 | 收款方账户名称 |
| 收款方账号 | string | 是 | 收款方银行账号 |
| 转账金额 | number | 是 | 金额，单位元 |
| 交易时间 | string | 是 | 交易时间 |
| 交易流水号 | string | 否 | 交易流水号 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 借款可能性分析 | string | 转账是否可能是借款 |
| 业务关联分析 | string | 双方是否存在业务关系 |
| 转账特征描述 | string | 对这笔转账的补充描述 |
| 备注信息 | string | 转账附言或备注内容 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份银行转账记录制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份银行转账记录，顺便分析一下这笔转账是否可能是借款

**处理**：预设槽位 + 借款可能性分析

**用户指令**：
> 提取这份银行转账记录，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-transfer-handler - 微信转账记录处理
- evidence-wechat-voucher-handler - 微信支付凭证处理
- evidence-io-handler - 借条欠条处理
