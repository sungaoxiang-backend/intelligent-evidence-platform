---
name: evidence-sms-chat-handler
description: |
  处理短信聊天记录图片（多图）。输出联合卡格式的 card_features。
  输入：多张短信聊天记录截图
  输出：联合卡格式（分组嵌套结构）
---

# 短信聊天记录处理技能

## 证据类型

- **card_type**: 短信聊天记录
- **card_is_associated**: true（联合卡）
- **处理方式**: 关联提取

## 子类型

- 按发送者号码分组
- 按通讯录备注名分组

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（欠款合意、欠款金额、约定还款日期等） |
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
  - url: "https://example.com/sms1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/sms2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/sms1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/sms2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析债务人的还款态度"  # 可选，增强提取的焦点
```

## 输出：联合卡 card_features

### 规则模式输出
```json
[
  {
    "slot_name": "13812345678",
    "slot_value_type": "group",
    "slot_value": null,
    "confidence": 1.0,
    "reasoning": "按债务人手机号码'13812345678'分组，共2张图片",
    "image_sequence_info": [
      {"evidence_id": "uuid-1", "sequence_number": 1},
      {"evidence_id": "uuid-2", "sequence_number": 2}
    ],
    "sub_features": [
      {
        "slot_name": "欠款合意",
        "slot_value": true,
        "slot_value_type": "boolean",
        "confidence": 0.95,
        "reasoning": "从短信内容'确认欠款5094元'识别",
        "reference_evidence_ids": ["uuid-1"]
      },
      {
        "slot_name": "欠款金额",
        "slot_value": 5094.0,
        "slot_value_type": "number",
        "confidence": 0.92,
        "reasoning": "从短信内容金额识别",
        "reference_evidence_ids": ["uuid-1"]
      },
      {
        "slot_name": "约定还款日期",
        "slot_value": "2024-06-15",
        "slot_value_type": "date",
        "confidence": 0.85,
        "reasoning": "从短信内容'6月15日前还款'识别",
        "reference_evidence_ids": ["uuid-2"]
      }
    ]
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "短信聊天记录",
  "card_is_associated": true,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "13812345678",
      "slot_value_type": "group",
      "slot_value": null,
      "confidence": 1.0,
      "reasoning": "按债务人手机号码'13812345678'分组，共2张图片",
      "image_sequence_info": [
        {"evidence_id": "uuid-1", "sequence_number": 1},
        {"evidence_id": "uuid-2", "sequence_number": 2}
      ],
      "sub_features": [
        {
          "slot_name": "欠款合意",
          "slot_value": true,
          "slot_value_type": "boolean",
          "confidence": 0.95,
          "reasoning": "从短信内容'确认欠款5094元'识别",
          "reference_evidence_ids": ["uuid-1"]
        },
        {
          "slot_name": "欠款金额",
          "slot_value": 5094.0,
          "slot_value_type": "number",
          "confidence": 0.92,
          "reasoning": "从短信内容金额识别",
          "reference_evidence_ids": ["uuid-1"]
        },
        {
          "slot_name": "约定还款日期",
          "slot_value": "2024-06-15",
          "slot_value_type": "date",
          "confidence": 0.85,
          "reasoning": "从短信内容'6月15日前还款'识别",
          "reference_evidence_ids": ["uuid-2"]
        },
        {
          "slot_name": "还款态度分析",
          "slot_value": "债务人承诺还款但未明确时间，态度一般",
          "slot_value_type": "string",
          "confidence": 0.80,
          "reasoning": "从短信内容语气分析",
          "reference_evidence_ids": ["uuid-1", "uuid-2"],
          "is_enhanced": true
        },
        {
          "slot_name": "催收情况",
          "slot_value": "债权人已多次催收，债务人承诺尽快处理",
          "slot_value_type": "string",
          "confidence": 0.85,
          "reasoning": "从短信催收内容分析",
          "reference_evidence_ids": ["uuid-2"],
          "is_enhanced": true
        }
      ]
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 手机系统短信
- 短信气泡

### Important 特征
- 短信内容
- 发送接收时间
- 发件人手机号或名称
- 信号电量状态栏图标

### 排除规则
- 微信QQ等第三方应用
- 其他聊天应用

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 债务人通讯录备注名 | string | 是 | 通讯录备注名或电话号码 |
| 欠款合意 | boolean | 是 | 是否有欠款确认 |
| 欠款金额 | number | 是 | 欠款金额 |
| 约定还款日期 | date | 否 | 约定还款时间 |
| 约定还款利息 | number | 否 | 约定利息率 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 还款态度分析 | string | 债务人还款态度分析 |
| 催收情况 | string | 催收情况描述 |
| 诉讼时效中断 | boolean | 催款是否构成时效中断 |
| 特殊约定 | string | 其他特殊条款或约定 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份短信聊天记录制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份短信聊天记录，顺便分析一下债务人的还款态度

**处理**：预设槽位 + 还款态度分析

**用户指令**：
> 提取这份短信聊天记录，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-chat-handler - 微信聊天记录处理
- evidence-bank-transfer-handler - 银行转账记录处理
