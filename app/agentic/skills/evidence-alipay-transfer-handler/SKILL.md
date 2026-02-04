---
name: evidence-alipay-transfer-handler
description: |
  处理支付宝转账页面图片（操作界面）。输出独立卡格式的 card_features 列表。
  输入：单张支付宝转账页面截图
  输出：独立卡格式（扁平列表）
---

# 支付宝转账页面处理技能

## 证据类型

- **card_type**: 支付宝转账页面
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（备注名、真实姓名、手机号码） |
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
  - url: "https://example.com/alipay_transfer.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/alipay_transfer.jpg"
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
    "slot_name": "债务人支付宝备注名",
    "slot_value": "收款方",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从头像下方备注名识别，括号外为备注名",
    "slot_group_info": null
  },
  {
    "slot_name": "债务人支付宝真实姓名",
    "slot_value": "王**",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从头像下方识别脱敏真实姓名，括号内为脱敏姓名",
    "slot_group_info": null
  },
  {
    "slot_name": "债务人手机号码",
    "slot_value": "138****1234",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从手机号码栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "支付宝转账页面",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "债务人支付宝备注名",
      "slot_value": "收款方",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从头像下方备注名识别，括号外为备注名",
      "slot_group_info": null
    },
    {
      "slot_name": "债务人支付宝真实姓名",
      "slot_value": "王**",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从头像下方识别脱敏真实姓名，括号内为脱敏姓名",
      "slot_group_info": null
    },
    {
      "slot_name": "债务人手机号码",
      "slot_value": "138****1234",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从手机号码栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "身份匹配分析",
      "slot_value": "真实姓名脱敏为'王**'，无法直接确认全名",
      "slot_value_type": "string",
      "confidence": 0.70,
      "reasoning": "从脱敏姓名分析",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "借款可能性分析",
      "slot_value": "转账操作界面显示，可能是个人间转账借款",
      "slot_value_type": "string",
      "confidence": 0.75,
      "reasoning": "从转账场景分析",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 支付宝转账
- 确认付款按钮
- 支付宝Logo

### Important 特征
- 收款方账户
- 金额
- 蓝色主色调
- 支付宝App界面

### 排除规则
- 支付宝账单详情
- 转账记录列表

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 债务人支付宝备注名 | string | 是 | 头像下方备注名，括号外 |
| 债务人支付宝真实姓名 | string | 是 | 头像下方脱敏姓名，括号内 |
| 债务人手机号码 | string | 是 | 头像下方手机号码 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 身份匹配分析 | string | 与其他证据的比对分析 |
| 借款可能性分析 | string | 转账是否可能是借款 |
| 账户安全性 | string | 账户情况分析 |
| 关联分析 | string | 与其他证据的关联性 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份支付宝转账页面制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份支付宝转账页面，顺便分析一下这笔转账是否可能是借款

**处理**：预设槽位 + 借款可能性分析

**用户指令**：
> 提取这份支付宝转账页面，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-bank-transfer-handler - 银行转账记录处理
- evidence-wechat-transfer-handler - 微信转账记录处理
