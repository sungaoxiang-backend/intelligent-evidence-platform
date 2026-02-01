---
name: evidence-collection-guide
skill_type: O
description: 用于指导证据收集策略的编排技能。本技能提供清单式引导、发散性挖掘等方法，帮助律师"按图索骥"收集证据，而非被动接受当事人提供的材料。适用于诉前证据收集阶段。
---

# 证据收集策略指引技能

## Overview

本技能提供系统化的证据收集方法，包括清单式引导、发散性挖掘、电子证据固定、证人准备等，帮助律师主动指导当事人收集完整证据链。

## Background

证据收集不是"当事人给什么，我要什么"，而是"我需要什么，指导当事人找什么"。从接待当事人开始，证据工作就贯穿始终：发现线索→指导收集→审查筛选→组织编排。

## Workflow

### 证据收集策略流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    证据收集策略流程                                │
└─────────────────────────────────────────────────────────────────┘

                              开始
                                │
                    ┌───────────┴───────────┐
                    │  确定证明目的         │
                    │  (需要证明什么?)      │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │  制作收集清单         │
                    │  按图索骥             │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │  发散性挖掘           │
                    │  深度访谈追细节       │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │  固定电子证据         │
                    │  公证/时间戳          │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │  证人准备             │
                    │  辅导/出庭安排        │
                    └───────────────────────┘
```

## 收集方法详解

### 1. 清单式引导

**原则：** 根据法律关系和法律要件，制作《初步证据收集清单》

**示例：**
- ❌ 模糊："付款凭证"
- ✅ 具体："2019年1月-2020年12月的全部银行转账记录"

### 2. 发散性挖掘

**原则：** 像侦探一样追问细节，挖掘关联证据

**示例：** 一份合同背后可能衍生：
- 邮件磋商记录
- 微信沟通记录
- 付款凭证
- 验收确认单
- 问题反馈记录

### 3. 及时固定电子证据

**方法：**
- 网页、聊天记录、邮件等进行公证
- 使用可信时间戳固定
- 防止灭失或对方否认

### 4. 证人证据准备

**要点：**
- 提前辅导（非诱导）
- 告知如实作证义务
- 梳理核心证明事实
- 确保陈述清晰稳定

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Evidence Collection Guide",
  "type": "object",
  "properties": {
    "case_type": {"type": "string"},
    "legal_elements": {
      "type": "array",
      "items": {"type": "string"},
      "description": "需证明的法律要件"
    },
    "available_evidence": {
      "type": "array",
      "items": {"type": "string"},
      "description": "已知的现有证据"
    },
    "collection_strategy": {
      "type": "string",
      "enum": ["checklist", "exploratory", "comprehensive"],
      "description": "收集策略"
    }
  },
  "required": ["case_type", "legal_elements"]
}
```

## Output Schema

```json
{
  "collection_plan": {
    "evidence_checklist": [
      {
        "category": "证据类别",
        "items": ["具体证据清单"],
        "priority": "high|medium|low"
      }
    ],
    "collection_steps": [
      "收集步骤"
    ],
    "digital_evidence_fixation": ["需固定的电子证据"],
    "witness_preparation": ["证人准备事项"]
  }
}
```

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《诉讼律师证据工作实战指引（新手篇）》 |
| `evolution_value` | 主动指导证据收集，避免遗漏关键证据 |
| `execution_context` | 诉前证据收集阶段 |

## Test Cases

### 测试用例 1：民间借贷纠纷

**输入：**
```json
{
  "case_type": "民间借贷纠纷",
  "legal_elements": ["借贷关系成立", "款项已交付", "被告违约"],
  "available_evidence": ["借条"],
  "collection_strategy": "comprehensive"
}
```

**期望输出：**
```json
{
  "collection_plan": {
    "evidence_checklist": [
      {
        "category": "借贷关系证据",
        "items": ["借条（原件）", "借款合同（如有）", "微信/短信磋商记录"],
        "priority": "high"
      },
      {
        "category": "款项交付证据",
        "items": ["银行转账记录", "微信/支付宝转账凭证", "收条/收据"],
        "priority": "high"
      },
      {
        "category": "违约催收证据",
        "items": ["催款微信记录", "律师函", "快递底单", "通话录音"],
        "priority": "medium"
      }
    ],
    "collection_steps": [
      "1. 收集借条、转账记录等核心证据",
      "2. 导出2019年至今全部银行流水",
      "3. 保存完整微信聊天记录并公证",
      "4. 整理催款记录及通话录音"
    ],
    "digital_evidence_fixation": [
      "微信聊天记录需及时公证或使用时间戳",
      "通话录音需保存原始载体"
    ],
    "witness_preparation": [
      "如有在场证人，提前沟通出庭作证事项",
      "告知如实作证义务和法律责任"
    ]
  }
}
```

## Related Skills

- `evidence-list-compilation`: 证据清单一览表制作
- `evidence-authenticity-review`: 证据真实性审查
