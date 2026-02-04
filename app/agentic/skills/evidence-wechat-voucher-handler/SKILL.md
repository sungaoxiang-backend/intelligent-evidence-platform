---
name: evidence-wechat-voucher-handler
description: |
  处理微信支付转账电子凭证图片（腾讯官方凭证）。输出独立卡格式的 card_features 列表。
  输入：单张微信支付电子凭证截图
  输出：独立卡格式（扁平列表）
---

# 微信支付电子凭证处理技能

## 证据类型

- **card_type**: 微信支付转账电子凭证
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（付款方、收款方、金额、时间、单号、说明） |
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
  - url: "https://example.com/voucher.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/voucher.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析这笔转账是否备注为借款"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "付款方真名",
    "slot_value": "张三",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从电子凭证'付款方'栏识别真实姓名",
    "slot_group_info": null
  },
  {
    "slot_name": "付款方微信号",
    "slot_value": "zhangsan123",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从电子凭证'付款方微信号'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "收款方真名",
    "slot_value": "李四",
    "slot_value_type": "string",
    "confidence": 0.98,
    "reasoning": "从电子凭证'收款方'栏识别真实姓名",
    "slot_group_info": null
  },
  {
    "slot_name": "收款方微信号",
    "slot_value": "lisi456",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从电子凭证'收款方微信号'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "转账金额",
    "slot_value": 5000.0,
    "slot_value_type": "number",
    "confidence": 0.98,
    "reasoning": "从电子凭证'转账金额'栏识别，单位元",
    "slot_group_info": null
  },
  {
    "slot_name": "转账时间",
    "slot_value": "2024-01-15 14:30:00",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从电子凭证'转账时间'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "交易单号",
    "slot_value": "100123456789012345678",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从电子凭证'交易单号'栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "转账说明",
    "slot_value": "借款",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从电子凭证'转账说明'栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "微信支付转账电子凭证",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "付款方真名",
      "slot_value": "张三",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从电子凭证'付款方'栏识别真实姓名",
      "slot_group_info": null
    },
    {
      "slot_name": "付款方微信号",
      "slot_value": "zhangsan123",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从电子凭证'付款方微信号'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "收款方真名",
      "slot_value": "李四",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从电子凭证'收款方'栏识别真实姓名",
      "slot_group_info": null
    },
    {
      "slot_name": "收款方微信号",
      "slot_value": "lisi456",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从电子凭证'收款方微信号'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "转账金额",
      "slot_value": 5000.0,
      "slot_value_type": "number",
      "confidence": 0.98,
      "reasoning": "从电子凭证'转账金额'栏识别，单位元",
      "slot_group_info": null
    },
    {
      "slot_name": "转账时间",
      "slot_value": "2024-01-15 14:30:00",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从电子凭证'转账时间'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "交易单号",
      "slot_value": "100123456789012345678",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从电子凭证'交易单号'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "转账说明",
      "slot_value": "借款",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从电子凭证'转账说明'栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "借款性质分析",
      "slot_value": "转账说明明确标注为'借款'，具有较强证明力",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从转账说明分析借款性质",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "证据效力分析",
      "slot_value": "官方电子凭证，真实姓名+微信号关联，证据效力强",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "根据证据类型分析",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 微信支付转账电子凭证（标题）
- 腾讯支付科技有限公司
- 财付通支付科技有限公司
- 业务凭证专用章（红色圆形印章）

### Important 特征
- 红色圆形印章
- 表格化交易详情布局
- 转账单号
- 申请时间和转账时间
- 付款方收款方微信号和姓名

### 排除规则
- 转账成功页面（非官方法凭证）
- 聊天记录中的转账消息
- 转账操作界面

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 付款方真名 | string | 是 | 付款方真实姓名 |
| 付款方微信号 | string | 是 | 付款方微信号 |
| 收款方真名 | string | 是 | 收款方真实姓名 |
| 收款方微信号 | string | 是 | 收款方微信号 |
| 转账金额 | number | 是 | 金额，单位元 |
| 转账时间 | string | 是 | 交易时间 |
| 交易单号 | string | 否 | 交易流水号 |
| 转账说明 | string | 否 | 转账时的备注 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 借款性质分析 | string | 转账说明是否支持借款主张 |
| 证据效力分析 | string | 证据的证明力分析 |
| 账户关联分析 | string | 双方账户关系分析 |
| 时间线分析 | string | 申请时间与转账时间差异 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份微信支付电子凭证制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份微信支付电子凭证，顺便分析一下这笔转账的借款性质

**处理**：预设槽位 + 借款性质分析

**用户指令**：
> 提取这份微信支付电子凭证，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-transfer-handler - 微信转账记录处理
- evidence-wechat-chat-handler - 微信聊天记录处理
- evidence-bank-transfer-handler - 银行转账记录处理
