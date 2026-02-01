---
name: evidence-review-methodology
description: 用于检索证据审查方法论的检索技能。本技能提供"四法则"（印证法则、逻辑法则、自然法则、经验法则）的理论基础和适用场景，帮助律师正确运用证据审查方法。适用于证据审查、事实认定阶段。
---

# 证据审查四法则检索技能

## Overview

本技能提供证据审查的四大方法论：印证法则、逻辑法则、自然法则、经验法则。这些法则是证据审查与分析必须遵循的认知规律，帮助律师科学地判断证据真伪。

## Background

证据审查必须遵循科学的方法论。《证据审查必须遵循四项法则》指出：证据审查本质上是一种思维活动，依据认识论、逻辑学等领域的知识，需要遵循印证法则、逻辑法则、自然法则、经验法则。

## 四法则详解

### 1. 印证法则

**核心思想：** 证据之间相互加强对方对待证事实的证明作用

| 要点 | 说明 |
|-----|------|
| 融贯论 | 证据联合起来从整体上获得结论的确定性 |
| 符合论 | 用实物证据检验言词证据的真实性 |
| 概率论 | 多个相互印证的证据比单一证据更可靠 |

**常见错误：** 单向印证（只看实物验证言词，忽视言词解释实物）

### 2. 逻辑法则

**核心思想：** 逻辑合理是证据真实的必要条件

| 法则 | 内容 | 违反表现 |
|-----|------|---------|
| 同一律 | 思想保持自身统一 | 前后自相矛盾 |
| 矛盾律 | 互否判断必有一假 | 证据一比一无法判断 |
| 排中律 | 互否判断必有一真 | 猜测性证言、模糊辨认 |

**质证应用：** 出现证据一对一时，根据证明力大小采信一方

### 3. 自然法则

**核心思想：** 人的行为必须符合自然法则

| 示例 | 违背自然法则 |
|-----|-------------|
| 月光辨认 | 当时月亮未升起 |
| 物质交换 | 葱兰花花粉未检出 |
| 同一认定 | 特征选取不当导致错误认定 |

**适用注意：** 注意适用条件，避免错误运用

### 4. 经验法则

**核心思想：** 运用日常生活经验和社会常识

| 分类 | 内容 |
|-----|------|
| 生活经验 | 人正常书写速度、指纹保留时间等 |
| 习惯 | 行业惯例、交易习惯等 |

**适用要求：** 从普遍接受、亲身感受、反复践行三方面把握

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Evidence Review Methodology",
  "type": "object",
  "properties": {
    "review_purpose": {
      "type": "string",
      "description": "审查目的"
    },
    "evidence_situation": {
      "type": "string",
      "enum": ["conflicting", "corroborating", "isolated", "multiple"],
      "description": "证据状态"
    },
    "selected_method": {
      "type": "string",
      "enum": ["verification", "logic", "natural", "experience", "combined"],
      "description": "选择的方法"
    }
  },
  "required": ["review_purpose"]
}
```

## Output Schema

```json
{
  "methodology_guidance": {
    "recommended_method": "方法名称",
    "method_description": "方法描述",
    "application_steps": ["应用步骤"],
    "common_pitfalls": ["常见错误"],
    "legal_basis": ["法理依据"]
  }
}
```

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《证据审查必须遵循四项法则》 |
| `evolution_value` | 科学化证据审查方法，避免主观臆断 |
| `execution_context` | 证据审查、事实认定阶段 |

## Test Cases

### 测试用例 1：证据矛盾时选择逻辑法则

**输入：**
```json
{
  "review_purpose": "判断相互矛盾的两份证据的真伪",
  "evidence_situation": "conflicting",
  "selected_method": "logic"
}
```

**期望输出：**
```json
{
  "methodology_guidance": {
    "recommended_method": "逻辑法则（矛盾律）",
    "method_description": "矛盾律指出，相互否定的判断不可能都是真的，其中必有一个是假的",
    "application_steps": [
      "1. 分析两份证据的证明力大小",
      "2. 判断哪一份证据更可靠（如原件vs复印件、中立第三方vs当事人）",
      "3. 采信证明力大的一方，认定另一方为假"
    ],
    "common_pitfalls": [
      "错误地认为'证据一比一无法判断'",
      "忽视证明力的差异而简单对等"
    ],
    "legal_basis": ["逻辑法则是证据审查的基本认知规律"]
  }
}
```

## Related Skills

- `evidence-authenticity-review`: 证据真实性审查
- `evidence-admissibility-check`: 证据可采性综合判断
