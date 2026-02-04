---
name: evidence-card-caster
description: |
  当需要将多模态证据材料铸造为证据卡片时，使用此技能执行：
  1. 接收证据材料列表（图片/PDF等）
  2. 调用专门的证据类型处理技能
  3. 汇总结果输出符合 EvidenceCard 数据结构的卡片
  4. 支持联合卡（多图分组）和独立卡（单图）

  子技能（按证据类型自动调用）：
  - evidence-id-card-handler: 身份证处理
  - evidence-household-handler: 户籍档案处理
  - evidence-wechat-chat-handler: 微信聊天记录处理
  - evidence-wechat-transfer-handler: 微信转账记录处理
  - evidence-wechat-voucher-handler: 微信支付电子凭证处理
  - evidence-wechat-profile-handler: 微信个人主页处理
  - evidence-bank-transfer-handler: 银行转账记录处理
  - evidence-alipay-transfer-handler: 支付宝转账页面处理
  - evidence-sms-chat-handler: 短信聊天记录处理
  - evidence-io-handler: 借条/欠条处理
  - evidence-invoice-handler: 发票处理
  - evidence-license-handler: 营业执照处理
---

# 证据卡片铸造（主技能）

## 核心职责

本技能是证据铸造的**入口技能**，负责：
1. 接收证据材料输入
2. 识别证据类型
3. 调用对应的专门处理技能
4. 汇总输出标准 EvidenceCard 格式

## 提取模式

本技能支持两种提取模式：

| 模式 | 参数值 | 说明 |
|------|--------|------|
| **规则模式** | `standard`（默认） | 只提取预设槽位，标准化输出 |
| **增强模式** | `enhanced` | 预设槽位 + 额外开放信息 |

## 输入格式

### 规则模式（默认）
```yaml
evidence_materials:
  - url: "https://example.com/image1.jpg"
    evidence_id: "uuid-1"           # 证据ID
    file_type: "image"              # image/pdf/doc
  - url: "https://example.com/image2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/image1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/image2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"

extraction_mode: enhanced  # 开启增强模式
extraction_prompt: "分析债务人的还款态度和还款能力"  # 可选，增强提取的焦点
```

## 输出：EvidenceCard 数据结构

### 联合卡（多证据关联）

```json
{
  "card_type": "微信聊天记录",
  "card_is_associated": true,
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
          "reasoning": "...",
          "reference_evidence_ids": ["uuid-2"]
        }
      ]
    }
  ]
}
```

### 独立卡（单证据）

```json
{
  "card_type": "身份证",
  "card_is_associated": false,
  "card_features": [
    {
      "slot_name": "姓名",
      "slot_value": "王立飞",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "...",
      "slot_group_info": null
    }
  ]
}
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
          "reasoning": "...",
          "reference_evidence_ids": ["uuid-2"]
        },
        {
          "slot_name": "还款态度分析",
          "slot_value": "债务人多次承诺还款但未兑现，态度消极",
          "slot_value_type": "string",
          "confidence": 0.85,
          "reasoning": "从聊天记录中债务人多次推迟还款的行为分析",
          "reference_evidence_ids": ["uuid-1", "uuid-2"],
          "is_enhanced": true
        }
      ]
    }
  ]
}
```

## 处理流程

```
输入证据材料列表
        ↓
    Step 1: 证据分类
        ↓
    Step 2: 模式识别（standard / enhanced）
        ↓
    Step 3: 按类型分发（传递模式信息）
        ↓
    ┌─────┴─────┬──────┬──────┬──────┐
    ↓           ↓      ↓      ↓      ↓
  OCR类型    Agent类型  关联类型  ...   (调用专门技能)
    ↓           ↓      ↓
    └─────┬─────┴──────┴──────┘
          ↓
    Step 4: 汇总结果
          ↓
    输出 EvidenceCard
```

## 证据类型与处理技能映射

| 证据类型 | 处理技能 | 处理模式 |
|----------|----------|----------|
| 身份证 | evidence-id-card-handler | OCR提取 |
| 户籍档案 | evidence-household-handler | OCR提取 |
| 增值税发票 | evidence-invoice-handler | OCR提取 |
| 公司营业执照 | evidence-license-handler | OCR提取 |
| 个体工商户营业执照 | evidence-license-handler | OCR提取 |
| 微信个人主页 | evidence-wechat-profile-handler | Agent提取 |
| 支付宝转账页面 | evidence-alipay-transfer-handler | Agent提取 |
| 微信支付转账电子凭证 | evidence-wechat-voucher-handler | Agent提取 |
| 微信转账记录 | evidence-wechat-transfer-handler | Agent提取 |
| 银行转账记录 | evidence-bank-transfer-handler | Agent提取 |
| 借款借条 | evidence-io-handler | Agent提取 |
| 货款欠条 | evidence-io-handler | Agent提取 |
| 微信聊天记录 | evidence-wechat-chat-handler | 关联提取 |
| 短信聊天记录 | evidence-sms-chat-handler | 关联提取 |

## 使用示例

### 示例1：规则模式（默认）

**用户指令**：
> 提取这份微信聊天记录制作证据卡片

**输入**：
```yaml
evidence_materials:
  - url: "https://example.com/chat1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/chat2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"
```

**预期输出**：只输出预设槽位（欠款金额、欠款合意、催款记录等）

### 示例2：增强模式

**用户指令**：
> 提取这份微信聊天记录，顺便分析一下债务人的还款态度

**输入**：
```yaml
evidence_materials:
  - url: "https://example.com/chat1.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
  - url: "https://example.com/chat2.jpg"
    evidence_id: "uuid-2"
    file_type: "image"

extraction_mode: enhanced
```

**预期输出**：预设槽位 + 还款态度分析

### 示例3：增强模式 + 自定义焦点

**用户指令**：
> 从这份借条中提取信息，顺便看看有没有约定管辖法院

**输入**：
```yaml
evidence_materials:
  - url: "https://example.com/iou.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "重点关注是否有约定管辖法院、诉讼管辖地等条款"
```

**预期输出**：预设槽位 + 管辖法院相关信息

## 子技能调用

当需要处理特定类型证据时，应调用对应的专门技能，并传递模式信息：

### evidence-id-card-handler
处理身份证，输出姓名、性别、民族、出生日期、户籍地址、公民身份号码

### evidence-wechat-chat-handler
处理微信聊天记录（多图），按备注名分组，输出欠款金额、欠款合意、催款记录等

### evidence-wechat-voucher-handler
处理微信支付转账电子凭证，输出付款方、收款方、转账金额等信息

### evidence-license-handler
处理营业执照，输出公司名称、统一社会信用代码、法定代表人等

### evidence-io-handler
处理借条/欠条，输出债务人姓名、欠款金额、欠款合意等

### evidence-invoice-handler
处理增值税发票，输出购买方、销售方、价税合计等

### evidence-bank-transfer-handler
处理银行转账记录，输出转账账户、转账金额、交易时间等

## 相关技能

- evidence-id-card-handler - 身份证处理
- evidence-household-handler - 户籍档案处理
- evidence-wechat-chat-handler - 微信聊天记录处理
- evidence-wechat-voucher-handler - 微信支付凭证处理
- evidence-wechat-transfer-handler - 微信转账记录处理
- evidence-bank-transfer-handler - 银行转账记录处理
- evidence-io-handler - 借条欠条处理
- evidence-invoice-handler - 发票处理
- evidence-license-handler - 营业执照处理
- evidence-wechat-profile-handler - 微信个人主页处理
- evidence-alipay-transfer-handler - 支付宝转账处理
- evidence-sms-chat-handler - 短信聊天记录处理
