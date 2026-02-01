---
name: evidence-admissibility-check
description: 用于综合判断证据可采性的编排技能。根据《最高人民法院关于民事诉讼证据的若干规定》第八十七条，从5个方面综合审核认定证据的可采性。适用于证据审查、质证准备阶段。
---

# 证据可采性综合判断技能

## Overview

本技能整合法院审核证据的5个法定方面，提供系统化的证据可采性判断框架，帮助律师全面评估证据是否会被法院采纳。

## Background

根据《最高人民法院关于民事诉讼证据的若干规定(2019修正)》第八十七条，审判人员对单一证据应从5个方面进行审核认定：(一)证据是否为原件、原物；(二)证据与本案事实是否相关；(三)证据的形式、来源是否符合法律规定；(四)证据的内容是否真实；(五)证人或提供证据的人与当事人有无利害关系。

## Workflow

### 证据可采性5方面检查

```
┌─────────────────────────────────────────────────────────────────┐
│                    证据可采性5方面检查                             │
└─────────────────────────────────────────────────────────────────┘

                              输入：证据
                                │
                    ┌───────────┼───────────┬───────────┬───────────┐
                    │           │           │           │           │
                    ▼           ▼           ▼           ▼           ▼
                (一)       (二)       (三)       (四)       (五)
            原件/原物    与案相关    形式合法    内容真实    无利害关系
                    │           │           │           │           │
                    └───────────┴───────────┴───────────┴───────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │ 可采性判断     │
                              │ 1. 全部通过    │
                              │ 2. 部分通过    │
                              │ 3. 不予采纳    │
                              └───────────────┘
```

## 五个审核方面详解

### (一) 证据是否为原件、原物

| 情况 | 可采性 | 说明 |
|-----|-------|------|
| 有原件/原物 | 可采纳 | 原则上必须提供原件 |
| 无原件但可核实 | 可能采纳 | 法院通过其他途径核实真实性 |
| 无原件且无法核实 | 不采纳 | 复印件可能被伪造篡改 |

### (二) 证据与本案事实是否相关

| 情况 | 可采性 | 说明 |
|-----|-------|------|
| 直接关联待证事实 | 可采纳 | 证明关键要件事实 |
| 间接关联 | 可能采纳 | 证明力较弱 |
| 与案无关 | 不采纳 | 不能实现证明目的 |

### (三) 证据的形式、来源是否符合法律规定

| 情况 | 可采性 | 说明 |
|-----|-------|------|
| 合法取得 | 可采纳 | 主体适格、程序合法 |
| 非法取证 | 不采纳 | 侵害合法权益或违反禁止性规定 |
| 境外未公证 | 不采纳 | 未履行公证认证手续 |

### (四) 证据的内容是否真实

| 情况 | 可采性 | 说明 |
|-----|-------|------|
| 内容真实 | 可采纳 | 与客观事实相符 |
| 内容虚假 | 不采纳 | 签名真实但内容虚假 |
| 内容存疑 | 需补强 | 需其他证据佐证 |

### (五) 证人与当事人有无利害关系

| 情况 | 可采性 | 说明 |
|-----|-------|------|
| 无利害关系 | 可采纳 | 证明力正常 |
| 有利害关系 | 需补强 | 证明力减弱，需其他证据佐证 |
| 证人资格不合格 | 不采纳 | 不能正确表达意思、无正当理由未出庭 |

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Evidence Admissibility Check",
  "type": "object",
  "properties": {
    "evidence": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "type": {"type": "string"},
        "provided_by": {"type": "string"}
      }
    },
    "check_aspects": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["original", "relevance", "legality", "content", "witness_interest", "all"]
      }
    },
    "case_context": {
      "type": "object",
      "properties": {
        "case_type": {"type": "string"},
        "key_facts": {"type": "array", "items": {"type": "string"}}
      }
    }
  },
  "required": ["evidence", "check_aspects"]
}
```

## Output Schema

```json
{
  "admissibility_assessment": {
    "overall_result": "admissible|partially_admissible|inadmissible",
    "aspect_checks": {
      "original": {"pass": true, "finding": "发现"},
      "relevance": {"pass": true, "finding": "发现"},
      "legality": {"pass": true, "finding": "发现"},
      "content": {"pass": true, "finding": "发现"},
      "witness_interest": {"pass": true, "finding": "发现"}
    },
    "recommendations": ["建议"],
    "legal_basis": ["法律依据"]
  }
}
```

## Legal Guardrails

**风险提示：**
- 5个方面缺一不可，任何一方面不合规都可能影响可采性
- 原件原则是首要要求，无原件需有正当理由
- 非法证据直接排除，不具有证据资格

**质证策略：**
- 对对方证据逐一从5个方面进行检查
- 发现任一方面问题，可作为质证切入点
- 综合评估后决定质证策略

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《法院采纳证据应当从这5方面进行审核认定》《最高人民法院关于民事诉讼证据的若干规定》第八十七条 |
| `evolution_value` | 系统化可采性判断框架，全面评估证据效力 |
| `execution_context` | 诉前证据审查、质证准备阶段 |

## Test Cases

### 测试用例 1：证人证言（有利害关系）

**输入：**
```json
{
  "evidence": {"name": "证人王某证言", "type": "testimony", "provided_by": "原告申请"},
  "check_aspects": ["all"],
  "case_context": {"case_type": "民间借贷纠纷"}
}
```

**期望输出：**
```json
{
  "admissibility_assessment": {
    "overall_result": "partially_admissible",
    "aspect_checks": {
      "original": {"pass": true, "finding": "证人出庭作证，视为原件"},
      "relevance": {"pass": true, "finding": "证言与借款事实相关"},
      "legality": {"pass": true, "finding": "证人出庭程序合法"},
      "content": {"pass": true, "finding": "证言内容清晰"},
      "witness_interest": {"pass": false, "finding": "证人与原告系多年好友关系，存在利害关系"}
    },
    "recommendations": [
      "该证人证言因有利害关系，证明力减弱",
      "建议要求原告提供其他证据予以佐证",
      "可重点质证其证明力不足"
    ],
    "legal_basis": ["《最高人民法院关于民事诉讼证据的若干规定》第八十七条第（五）项"]
  }
}
```

## Related Skills

- `evidence-authenticity-review`: 证据真实性深度审查
- `evidence-cross-examination`: 证据质证技巧
- `evidence-list-compilation`: 证据清单一览表制作
