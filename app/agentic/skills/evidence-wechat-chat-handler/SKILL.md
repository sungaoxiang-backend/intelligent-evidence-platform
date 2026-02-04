---
name: evidence-wechat-chat-handler
description: |
  处理微信聊天记录图片（多图），按微信备注名分组。输出联合卡格式的 card_features。
  输入：多张微信聊天截图
  输出：联合卡格式（分组嵌套结构）
---

# 微信聊天记录处理技能

## 证据类型

- **card_type**: 微信聊天记录
- **card_is_associated**: true（联合卡）
- **处理方式**: 关联提取（多图分组）

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（欠款金额、欠款合意、催款记录等） |
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
  - url: "https://example.com/chat1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/chat2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/chat1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/chat2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析债务人的还款态度"  # 可选，增强提取的焦点
```

## 输出：card_features 列表（分组嵌套结构）

### 规则模式输出
```json
[
  {
    "slot_name": "王立飞",
    "slot_value_type": "group",
    "slot_value": null,
    "confidence": 1.0,
    "reasoning": "按微信备注名'王立飞'分组，共2张图片",
    "image_sequence_info": [
      {"evidence_id": "uuid-1", "sequence_number": 1},
      {"evidence_id": "uuid-2", "sequence_number": 2}
    ],
    "sub_features": [
      {
        "slot_name": "欠款金额",
        "slot_value": 5094.0,
        "slot_value_type": "number",
        "confidence": 0.92,
        "reasoning": "从第2张聊天记录识别2024年欠款4084元，第1张记录含2023年送货单1010元",
        "reference_evidence_ids": ["uuid-2", "uuid-1"]
      },
      {
        "slot_name": "欠款合意",
        "slot_value": true,
        "slot_value_type": "boolean",
        "confidence": 0.90,
        "reasoning": "第2张聊天记录显示被告回复'好，知道'确认欠款事实",
        "reference_evidence_ids": ["uuid-2"]
      },
      {
        "slot_name": "催款记录",
        "slot_value": true,
        "slot_value_type": "boolean",
        "confidence": 0.95,
        "reasoning": "第1张记录显示8月23日催款，第2张记录显示12月28日催款",
        "reference_evidence_ids": ["uuid-1", "uuid-2"]
      }
    ]
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "微信聊天记录",
  "card_is_associated": true,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "王立飞",
      "slot_value_type": "group",
      "slot_value": null,
      "confidence": 1.0,
      "reasoning": "按微信备注名'王立飞'分组，共2张图片",
      "image_sequence_info": [
        {"evidence_id": "uuid-1", "sequence_number": 1},
        {"evidence_id": "uuid-2", "sequence_number": 2}
      ],
      "sub_features": [
        {
          "slot_name": "欠款金额",
          "slot_value": 5094.0,
          "slot_value_type": "number",
          "confidence": 0.92,
          "reasoning": "从第2张聊天记录识别2024年欠款4084元，第1张记录含2023年送货单1010元",
          "reference_evidence_ids": ["uuid-2", "uuid-1"]
        },
        {
          "slot_name": "欠款合意",
          "slot_value": true,
          "slot_value_type": "boolean",
          "confidence": 0.90,
          "reasoning": "第2张聊天记录显示被告回复'好，知道'确认欠款事实",
          "reference_evidence_ids": ["uuid-2"]
        },
        {
          "slot_name": "催款记录",
          "slot_value": true,
          "slot_value_type": "boolean",
          "confidence": 0.95,
          "reasoning": "第1张记录显示8月23日催款，第2张记录显示12月28日催款",
          "reference_evidence_ids": ["uuid-1", "uuid-2"]
        },
        {
          "slot_name": "还款态度分析",
          "slot_value": "债务人多次承诺还款但未兑现，态度消极，存在拖延行为",
          "slot_value_type": "string",
          "confidence": 0.85,
          "reasoning": "从聊天记录中债务人多次推迟还款的行为分析",
          "reference_evidence_ids": ["uuid-1", "uuid-2"],
          "is_enhanced": true
        },
        {
          "slot_name": "建材种类明细",
          "slot_value": "中沙100包、水泥20包",
          "slot_value_type": "string",
          "confidence": 0.88,
          "reasoning": "从第1张聊天记录中送货单照片识别",
          "reference_evidence_ids": ["uuid-1"],
          "is_enhanced": true
        }
      ]
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 微信聊天界面
- 聊天气泡布局

### Important 特征
- 对话内容
- 转账收款信息
- 语音图片标识
- 语音转文本内容
- 用户头像
- 时间戳

### 排除规则
- 如果只包含单条转账记录 → 应归类为微信转账记录
- 如果是个人主页 → 应归类为微信个人主页

## 分组逻辑

1. 分析所有图片，识别微信备注名
2. 按备注名分组（同一人多张图归为一组）
3. 为组内图片分配 `sequence_number`（时间顺序）
4. 每个分组生成一个 card_feature

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 欠款金额 | number | 明确的欠款数额 |
| 欠款明细 | string | 欠款的具体构成 |
| 欠款合意 | boolean | 债务人是否确认欠款 |
| 催款记录 | boolean | 是否有催款行为 |
| 诉讼时效中断 | boolean | 催款是否构成时效中断 |
| 约定还款日期 | date | 约定的还款时间 |
| 约定还款利息 | number | 约定的利息率 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 还款态度分析 | string | 债务人还款态度的主观评价 |
| 建材/货物明细 | string | 货物种类和数量 |
| 交易时间线 | string | 关键事件时间顺序 |
| 特殊约定 | string | 其他特殊条款或约定 |
| 争议点 | string | 双方存在争议的内容 |

## 欠款合意判断

### 可以认定
- 债务人明确承认："我确实欠你钱"、"我会还的"
- 债务人确认具体金额："是的，就是5000元"
- 债务人承诺还款

### 不能认定
- 音频气泡没有转文字内容
- 债务人发送的无关截图
- 债权人单方面的要求或陈述
- 模糊不清的表述

## 使用示例

### 规则模式
**用户指令**：
> 提取这份微信聊天记录制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份微信聊天记录，顺便分析一下债务人的还款态度

**处理**：预设槽位 + 还款态度分析

**用户指令**：
> 提取这份微信聊天记录，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-transfer-handler - 微信转账记录处理
- evidence-wechat-voucher-handler - 微信支付凭证处理
- evidence-sms-chat-handler - 短信聊天记录处理
