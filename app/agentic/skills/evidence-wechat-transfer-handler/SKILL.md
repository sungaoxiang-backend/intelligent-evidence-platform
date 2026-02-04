---
name: evidence-wechat-transfer-handler
description: |
  处理微信转账记录图片（订单界面）。输出独立卡格式的 card_features 列表。
  输入：单张微信转账订单截图
  输出：独立卡格式（扁平列表）
---

# 微信转账记录处理技能

## 证据类型

- **card_type**: 微信转账记录
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（转账账户、金额、时间、单号、状态） |
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
  - url: "https://example.com/transfer.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/transfer.jpg"
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
    "slot_name": "转账账户备注名",
    "slot_value": "收款方名称",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从转账记录显示的'扫二维码付款-给XXX'格式识别",
    "slot_group_info": null
  },
  {
    "slot_name": "转账金额",
    "slot_value": 1000.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从转账记录中的金额识别，注意为正数",
    "slot_group_info": null
  },
  {
    "slot_name": "转账时间",
    "slot_value": "2024-01-15 14:30:00",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从转账记录中的时间戳识别",
    "slot_group_info": null
  },
  {
    "slot_name": "转账单号",
    "slot_value": "wx1234567890",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从转账记录中的交易单号识别",
    "slot_group_info": null
  },
  {
    "slot_name": "交易状态",
    "slot_value": "支付成功",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从转账记录状态栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "微信转账记录",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "转账账户备注名",
      "slot_value": "收款方名称",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从转账记录显示的'扫二维码付款-给XXX'格式识别",
      "slot_group_info": null
    },
    {
      "slot_name": "转账金额",
      "slot_value": 1000.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从转账记录中的金额识别，注意为正数",
      "slot_group_info": null
    },
    {
      "slot_name": "转账时间",
      "slot_value": "2024-01-15 14:30:00",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从转账记录中的时间戳识别",
      "slot_group_info": null
    },
    {
      "slot_name": "转账单号",
      "slot_value": "wx1234567890",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从转账记录中的交易单号识别",
      "slot_group_info": null
    },
    {
      "slot_name": "交易状态",
      "slot_value": "支付成功",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从转账记录状态栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款可能性分析",
      "slot_value": "单笔转账，无明确业务背景，可能是个人间借款",
      "slot_value_type": "string",
      "confidence": 0.75,
      "reasoning": "从转账金额和场景分析",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "转账特征描述",
      "slot_value": "通过扫二维码方式付款，收款方为个人账户",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "从转账方式分析",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 黄色钱袋子icon
- 转账时间
- 转账单号

### Important 特征
- 支付成功
- 零钱通
- 金额

### 排除规则
- 银行转账记录
- 支付宝转账记录
- 微信支付转账电子凭证（官方法凭证）
- 微信转账页面（操作界面，非订单记录）

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 转账账户备注名 | string | 是 | 收款方备注名 |
| 转账金额 | number | 是 | 正数金额 |
| 转账时间 | string | 是 | 交易时间 |
| 转账单号 | string | 否 | 交易单号 |
| 交易状态 | string | 是 | 支付成功/失败 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 借款可能性分析 | string | 转账是否可能是借款 |
| 转账方式 | string | 转账的具体方式 |
| 账户类型 | string | 个人/企业账户分析 |
| 备注分析 | string | 转账说明的分析 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份微信转账记录制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份微信转账记录，顺便分析一下这笔转账是否可能是借款

**处理**：预设槽位 + 借款可能性分析

**用户指令**：
> 提取这份微信转账记录，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-chat-handler - 微信聊天记录处理
- evidence-wechat-voucher-handler - 微信支付凭证处理
- evidence-bank-transfer-handler - 银行转账记录处理
