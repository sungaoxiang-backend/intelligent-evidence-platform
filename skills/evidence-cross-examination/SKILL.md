---
name: evidence-cross-examination
skill_type: A
description: 用于庭审中对证据"三性"（真实性、合法性、关联性）进行质证的执行技能。本技能提供标准化的质证意见模板和策略，帮助律师准确、有效地对对方证据发表质证意见。适用于庭审质证阶段。
---

# 证据质证技巧技能

## Overview

本技能提供庭审中对证据"三性"进行质证的标准化方法和模板，帮助律师快速组织质证意见，避免遗漏关键质证点，有效维护当事人权益。

## Background

根据《最高人民法院关于适用<民事诉讼法>的解释》第一百零四条，人民法院应当组织当事人围绕证据的**真实性、合法性、关联性**进行质证。质证环节是诉讼中最关键环节之一，未经质证的证据不得作为认定案件事实的根据。

## Action

### 对证据"三性"发表质证意见

#### 质证意见框架

```
┌─────────────────────────────────────────────────────────────────┐
│                    证据质证"三性"框架                             │
└─────────────────────────────────────────────────────────────────┘

                              输入：对方证据
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
                真实性      合法性      关联性
                （地基）    （准生证）    （桥梁）
                    │           │           │
                    ▼           ▼           ▼
              原件核实    取证方式    待证事实
              内容验证    形式要件    证明力
              载体检查    主体资格    关联强度
```

#### 真实性质证要点

**标准质证意见：**

| 情况 | 质证意见 |
|-----|---------|
| 无原件 | "该证据没有原件，对真实性无法核实，故对真实性不予认可" |
| 复印件不符 | "复印件与原件不符，对真实性不予认可" |
| 单方制作 | "对该证据的真实性不予认可，系对方单方制作，存在篡改可能" |
| 部分真实 | "对该证据中涉及我方陈述部分的真实性认可，但对对方自行添加部分的真实性不予认可" |
| 案外人出具 | "该证据由案外人出具，真实性由法庭依法核对" |

**审查要点：**
- 必须见到原件
- 检查印章凹凸感（防彩印冒充）
- 纸张新旧与声称形成时间是否匹配
- 委托人需提前确认签字/印章真实性

#### 合法性质证要点

**标准质证意见：**

| 情况 | 质证意见 |
|-----|---------|
| 非法取证 | "该证据的取得方式严重侵害他人合法权益/违反法律禁止性规定，属于非法证据，应予排除" |
| 偷录偷拍 | "该录音录像系在他人私密场所偷录，严重侵犯他人隐私，不具有合法性" |
| 境外未公证 | "该证据形成于境外，未履行公证认证手续，不符合法律规定" |
| 证人不合格 | "证人不能正确表达意思/无正当理由未出庭，其证言不得作为定案依据" |

#### 关联性质证要点

**标准质证意见：**

| 情况 | 质证意见 |
|-----|---------|
| 与案无关 | "该证据与本案待证事实无关，不能实现其证明目的" |
| 关联度弱 | "该证据与待证事实关联度较弱，证明力有限" |
| 证明目的错误 | "对证据关联性认可，但证明目的不认可，该证据恰恰证明我方主张" |

**策略提示：**
- 区分"证据关联性"（客观）与"证明目的"（主观）
- 对方证据中有利于我方的内容，应强调再强调
- 证据目的错误：应指向有利于我方的要件事实而非对方

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Evidence Cross-Examination",
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
    "cross_examination_focus": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["authenticity", "legality", "relevance", "all"]
      }
    },
    "has_original": {"type": "boolean"},
    "is_adverse": {"type": "boolean", "description": "是否为不利证据"},
    "party_position": {"type": "string"}
  },
  "required": ["evidence", "has_original"]
}
```

## Output Schema

```json
{
  "cross_examination_opinion": {
    "authenticity": {
      "position": "accept|reject|partial|unknown",
      "opinion": "具体质证意见",
      "legal_basis": "法律依据"
    },
    "legality": {
      "position": "accept|challenge|exclude",
      "opinion": "具体质证意见"
    },
    "relevance": {
      "position": "accept|reject|partial",
      "opinion": "具体质证意见",
      "counter_argument": "反证意见"
    },
    "overall_statement": "综合质证意见（庭审口语版）"
  }
}
```

## Legal Guardrails

**风险提示：**
- 真实性是最重要的，是关联性和合法性的基础
- 若确认证据真实，不要轻易否认，会给法官不诚信印象
- 对己方有利证据，提前核实原件，避免庭上被动
- 庭前书面质证意见需保留性发言

**质证策略：**
- 对不利证据：严格审查三性，发现问题坚决不认
- 对有利证据：提前确认，积极认可
- 对案外人证据：可认形式真实不认内容真实

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《实务技能能让初级律师快速上手的质证技巧》 |
| `evolution_value` | 标准化质证意见模板，避免遗漏关键质证点 |
| `execution_context` | 庭审质证阶段 |

## Test Cases

### 测试用例 1：不利书证（有原件）

**输入：**
```json
{
  "evidence": {"name": "借条", "type": "document", "provided_by": "原告"},
  "cross_examination_focus": ["authenticity", "relevance"],
  "has_original": true,
  "is_adverse": true,
  "party_position": "被告"
}
```

**期望输出：**
```json
{
  "cross_examination_opinion": {
    "authenticity": {
      "position": "partial",
      "opinion": "认可形式真实性（有原件、签字），但对内容真实性不予认可。该借条虽为我方签字，但系在胁迫情形下出具，并非双方真实意思表示",
      "legal_basis": "《民法典》第150条"
    },
    "legality": {"position": "accept"},
    "relevance": {
      "position": "partial",
      "opinion": "对关联性不予认可。该借条所涉款项并未实际交付，借贷关系未生效",
      "counter_argument": "我方已提供银行流水证明款项未实际支付"
    },
    "overall_statement": "审判长，对该证据：认可形式真实性有原件和本人签字，但对内容真实性不予认可，该借条系受胁迫所出具；对关联性和证明目的均不认可，借款未实际交付，借贷关系未成立。"
  }
}
```

### 测试用例 2：电子数据（无原件）

**输入：**
```json
{
  "evidence": {"name": "微信聊天记录截图", "type": "digital", "provided_by": "原告"},
  "cross_examination_focus": ["all"],
  "has_original": false,
  "is_adverse": true,
  "party_position": "被告"
}
```

**期望输出：**
```json
{
  "cross_examination_opinion": {
    "authenticity": {
      "position": "reject",
      "opinion": "该证据没有原件，对真实性无法核实，故对真实性不予认可",
      "legal_basis": "《最高人民法院关于民事诉讼证据的若干规定》第十五条"
    },
    "legality": {"position": "accept"},
    "relevance": {
      "position": "reject",
      "opinion": "因真实性无法确认，关联性亦无法确认"
    },
    "overall_statement": "审判长，对该证据：对真实性、合法性、关联性均不予认可。对方仅提供微信聊天记录截图，未提供原始载体，无法核实其真实性和完整性，不符合电子证据的法定形式要求，请法庭责令对方提供原始载体或经过公证的电子数据。"
  }
}
```

## Related Skills

- `evidence-authenticity-review`: 证据真实性深度审查
- `evidence-admissibility-check`: 证据可采性综合判断
- `evidence-list-compilation`: 证据清单一览表制作
