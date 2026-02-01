---
name: wechat-verify-user-identity
skill_type: O
description: 用于综合证明微信使用者真实身份的编排技能。整合实名验证、信息调取、转账回单申请、辅助证据收集等多种方法，根据案件具体情况制定最优身份证明策略。此技能适用于整个诉讼周期的身份证明需求。
---

# 微信使用者身份综合证明技能

## Overview

本技能是证明微信使用者真实身份的综合性编排流程，根据案件具体情况（是否实名、是否有转账、是否已起诉等）制定最优的身份证明策略，整合多种证明方法形成完整证据链。

## Background

在司法实践中，证明微信使用者的真实身份是使用微信聊天记录作为证据的前提。根据调研文章，证明方法包括：实名认证信息调取、转账电子回单、聊天内容分析、朋友圈内容、自认与证人证言等。本技能提供决策树，帮助选择最优证明路径。

## Workflow

### 身份证明策略决策树

``┌─────────────────────────────────────────────────────────────────────────┐
│                    微信使用者身份证明决策树                                │
└─────────────────────────────────────────────────────────────────────────┘

                              开始
                                │
                    ┌───────────┴───────────┐
                    │  是否已进入诉讼程序？  │
                    └───────────┬───────────┘
                      是 │           │ 否
                         │           │
         ┌───────────────┘           └────────────────┐
         │                                                │
         ▼                                                ▼
┌─────────────────┐                          ┌─────────────────┐
│ 诉讼路径        │                          │ 诉前路径        │
└────────┬────────┘                          └────────┬────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────┐                          ┌─────────────────┐
│ Step 1:         │                          │ Step 1:         │
│ 确认实名状态    │                          │ 确认实名状态    │
└────────┬────────┘                          └────────┬────────┘
         │                                            │
    ┌────┴────┐                                  ┌────┴────┐
    │         │                                  │         │
已实名      未实名                           已实名      未实名
    │         │                                  │         │
    ▼         ▼                                  ▼         ▼
┌─────────┐ ┌─────────┐                    ┌─────────┐ ┌─────────┐
│申请法院│ │辅助证据│                    │保存转账│ │辅助证据│
│调查函  │ │方法    │                    │记录    │ │方法    │
└────┬────┘ └────┬────┘                    └────┬────┘ └────┬────┘
     │           │                              │           │
     ▼           ▼                              ▼           ▼
┌─────────┐ ┌─────────┐                    ┌─────────┐ ┌─────────┐
│获取实名│ │聊天内容│                    │申请电子│ │聊天内容│
│认证复函│ │+朋友圈 │                    │回单    │ │+朋友圈 │
└────┬────┘ └────┬────┘                    └────┬────┘ └────┬────┘
     │           │                              │           │
     └─────┬─────┘                              └─────┬─────┘
           │                                          │
           ▼                                          ▼
     ┌──────────┐                            ┌──────────┐
     │ 庭审展示 │                            │ 起诉准备 │
     │ 证据流程 │                            │ 证据收集 │
     └──────────┘                            └──────────┘
```

## 子技能调用时序

### 场景 A：已实名 + 有转账记录（最优路径）

```
1. wechat-verify-realname
   ↓ 确认已实名
2. wechat-apply-transfer-proof
   ↓ 获取带公章回单
3. wechat-query-realname-info (可选，如需更完整信息)
   ↓ 获取实名复函
4. wechat-present-evidence
   ↓ 庭审展示
```

### 场景 B：已实名 + 无转账记录

```
1. wechat-verify-realname
   ↓ 确认已实名
2. wechat-query-realname-info
   ↓ 获取实名复函
3. 收集辅助证据（聊天内容、朋友圈等）
   ↓ 形成证据链
4. wechat-present-evidence
```

### 场景 C：未实名 + 有转账记录

```
1. wechat-verify-realname
   ↓ 确认未实名
2. wechat-apply-transfer-proof
   ↓ 回单显示真实姓名
3. 收集辅助证据（自认、聊天内容等）
   ↓ 强化证明
4. wechat-present-evidence
```

### 场景 D：未实名 + 无转账记录（最困难）

```
1. wechat-verify-realname
   ↓ 确认未实名
2. 收集辅助证据：
   - 聊天内容中身份提及
   - 朋友圈内容分析
   - 自认或证人证言
   - 手机号绑定验证
   ↓ 形成间接证据链
3. wechat-present-evidence
```

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WeChat User Identity Verification",
  "type": "object",
  "properties": {
    "case_context": {
      "type": "object",
      "properties": {
        "litigation_status": {
          "type": "string",
          "enum": ["pre_litigation", "in_litigation", "preparation"],
          "description": "诉讼阶段"
        },
        "case_type": {
          "type": "string",
          "description": "案件类型"
        },
        "has_transfer_records": {
          "type": "boolean",
          "description": "是否有转账记录"
        },
        "transfer_amount_total": {
          "type": "number",
          "description": "转账总金额"
        }
      },
      "required": ["litigation_status"]
    },
    "target_user": {
      "type": "object",
      "properties": {
        "wechat_id": {"type": "string"},
        "guessed_name": {"type": "string"},
        "relationship": {"type": "string", "description": "与目标用户关系"}
      },
      "required": ["wechat_id"]
    },
    "evidence_strategy": {
      "type": "string",
      "enum": ["aggressive", "standard", "minimal"],
      "description": "证据策略强度"
    }
  },
  "required": ["case_context", "target_user"]
}
```

## Output Schema

```json
{
  "verification_strategy": {
    "scenario": "A|B|C|D",
    "scenario_description": "场景描述",
    "recommended_steps": [
      {
        "step": 1,
        "skill": "wechat-verify-realname",
        "action": "确认实名状态",
        "priority": "high"
      },
      {
        "step": 2,
        "skill": "wechat-apply-transfer-proof|wechat-query-realname-info",
        "action": "获取权威证据",
        "priority": "high"
      },
      {
        "step": 3,
        "skill": "auxiliary_evidence_collection",
        "action": "收集辅助证据",
        "priority": "medium"
      },
      {
        "step": 4,
        "skill": "wechat-present-evidence",
        "action": "庭审展示证据",
        "priority": "high"
      }
    ],
    "evidence_strength_prediction": {
      "identity_proof": "strong|moderate|weak",
      "overall_success_probability": "high|medium|low",
      "risk_factors": ["风险因素列表"]
    },
    "legal_guardrails": {
      "compliance_notes": ["合规提示"],
      "risk_warnings": ["风险警告"]
    }
  }
}
```

## 辅助证据收集方法

当无法获取实名复函或转账回单时，可采用以下辅助方法：

| 方法 | 证据效力 | 适用场景 | 注意事项 |
|-----|---------|---------|---------|
| 聊天内容自认 | 中 | 对方承认身份 | 需完整保存记录 |
| 朋友圈内容 | 低-中 | 包含本人照片/信息 | 需其他证据佐证 |
| 手机号绑定 | 中 | 手机号已实名 | 需证明手机号归属 |
| 视频号关联 | 低 | 包含本人信息 | 需其他证据佐证 |
| 证人证言 | 中 | 有第三方见证 | 证人需出庭作证 |
| 头像比对 | 低 | 头像清晰且一致 | 仅作参考，不单独采信 |

## Legal Guardrails

**风险提示：**
- 未实名账号的证明难度显著高于已实名账号
- 仅有截图而无原始载体，证据可能不被采信
- 辅助证据需形成证据链，单独使用效力有限

**合规要求：**
- 调取实名信息必须通过合法的司法程序
- 证据收集不得侵犯他人隐私权
- 电子证据需保持完整性，不得篡改

**证据效力排序：**
1. 财付通实名复函（最高）
2. 微信转账电子回单（高）
3. 自认/证人证言（中）
4. 辅助电子证据（低-中）

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《如何在法庭上证明微信使用者的真实身份》全文综合 |
| `evolution_value` | 整合多种证明方法，根据案件情况制定最优策略，提高身份证明成功率 |
| `execution_context` | 诉前准备、诉讼全过程 |

## Test Cases

### 测试用例 1：已实名 + 有转账 - 诉讼中

**输入：**
```json
{
  "case_context": {
    "litigation_status": "in_litigation",
    "case_type": "民间借贷纠纷",
    "has_transfer_records": true,
    "transfer_amount_total": 50000
  },
  "target_user": {
    "wechat_id": "wxid_debtor123",
    "guessed_name": "张三",
    "relationship": "借款人"
  },
  "evidence_strategy": "standard"
}
```

**期望输出：**
```json
{
  "verification_strategy": {
    "scenario": "A",
    "scenario_description": "已实名 + 有转账记录（最优路径）",
    "recommended_steps": [
      {
        "step": 1,
        "skill": "wechat-verify-realname",
        "action": "确认微信号是否已实名认证",
        "input": {"target_wechat_id": "wxid_debtor123"},
        "priority": "high"
      },
      {
        "step": 2,
        "skill": "wechat-apply-transfer-proof",
        "action": "申请转账电子回单（5万元）",
        "input": {"transfer_records": [{"amount": 50000}]},
        "priority": "high"
      },
      {
        "step": 3,
        "skill": "wechat-query-realname-info",
        "action": "申请法院调取实名认证复函（可选）",
        "input": {"applicant_type": "court", "target_wechat_id": "wxid_debtor123"},
        "priority": "medium"
      },
      {
        "step": 4,
        "skill": "wechat-present-evidence",
        "action": "庭审展示证据（登录→个人信息→聊天→转账→回单）",
        "priority": "high"
      }
    ],
    "evidence_strength_prediction": {
      "identity_proof": "strong",
      "overall_success_probability": "high",
      "expected_court_acceptance": "高",
      "risk_factors": []
    },
    "legal_guardrails": {
      "compliance_notes": [
        "申请法院调取实名信息需提交协助函申请",
        "电子回单需加盖财付通公章方具有完整效力"
      ],
      "risk_warnings": []
    }
  }
}
```

### 测试用例 2：未实名 + 无转账 - 诉前准备

**输入：**
```json
{
  "case_context": {
    "litigation_status": "pre_litigation",
    "case_type": "名誉权纠纷",
    "has_transfer_records": false
  },
  "target_user": {
    "wechat_id": "wxid_unknown",
    "relationship": "被告"
  },
  "evidence_strategy": "aggressive"
}
```

**期望输出：**
```json
{
  "verification_strategy": {
    "scenario": "D",
    "scenario_description": "未实名 + 无转账记录（最困难路径）",
    "recommended_steps": [
      {
        "step": 1,
        "skill": "wechat-verify-realname",
        "action": "确认微信号实名状态（预期：未实名）",
        "priority": "high"
      },
      {
        "step": 2,
        "skill": "auxiliary_evidence_collection",
        "action": "收集辅助证据",
        "sub_steps": [
          "保存完整聊天记录（包括对方自认身份的内容）",
          "截取朋友圈内容（如包含本人照片/信息）",
          "尝试获取对方手机号并验证绑定关系",
          "寻找可出庭的证人",
          "分析视频号等关联账号内容"
        ],
        "priority": "high"
      },
      {
        "step": 3,
        "skill": "wechat-present-evidence",
        "action": "庭审展示证据（侧重辅助证据链）",
        "priority": "high"
      }
    ],
    "evidence_strength_prediction": {
      "identity_proof": "weak",
      "overall_success_probability": "medium",
      "expected_court_acceptance": "中低",
      "risk_factors": [
        "未实名账号无法调取权威认证信息",
        "无转账记录无法获取电子回单",
        "辅助证据单独效力有限，需形成完整证据链"
      ]
    },
    "legal_guardrails": {
      "compliance_notes": [
        "辅助证据需形成证据链，相互印证",
        "建议考虑公证关键聊天记录"
      ],
      "risk_warnings": [
        "证明难度较高，胜诉存在不确定性",
        "建议评估诉讼成本与预期收益",
        "可考虑先尝试其他纠纷解决方式"
      ]
    }
  }
}
```

### 测试用例 3：已实名 + 有转账 - 诉前准备

**输入：**
```json
{
  "case_context": {
    "litigation_status": "preparation",
    "case_type": "买卖合同纠纷",
    "has_transfer_records": true,
    "transfer_amount_total": 25000
  },
  "target_user": {
    "wechat_id": "wxid_seller456",
    "guessed_name": "王五",
    "relationship": "卖家"
  },
  "evidence_strategy": "standard"
}
```

**期望输出：**
```json
{
  "verification_strategy": {
    "scenario": "A_pre_litigation",
    "scenario_description": "已实名 + 有转账记录 - 诉前准备",
    "recommended_steps": [
      {
        "step": 1,
        "skill": "wechat-verify-realname",
        "action": "确认实名状态",
        "priority": "high"
      },
      {
        "step": 2,
        "skill": "wechat-apply-transfer-proof",
        "action": "立即申请所有转账记录的电子回单",
        "input": {"transfer_records": "全部转账记录"},
        "priority": "high",
        "note": "诉前及时申请，避免记录过期或账号异常"
      },
      {
        "step": 3,
        "skill": "evidence_preservation",
        "action": "证据固定",
        "sub_steps": [
          "保存完整聊天记录截图",
          "备份聊天记录数据库",
          "考虑对关键记录进行公证"
        ],
        "priority": "high"
      },
      {
        "step": 4,
        "skill": "litigation_preparation",
        "action": "起诉准备",
        "note": "准备好电子回单后可提起诉讼"
      }
    ],
    "evidence_strength_prediction": {
      "identity_proof": "strong",
      "overall_success_probability": "high",
      "expected_court_acceptance": "高"
    },
    "legal_guardrails": {
      "compliance_notes": [
        "诉前及时申请电子回单，避免诉讼时记录缺失",
        "转账时建议备注'货款'等明确用途"
      ]
    }
  }
}
```

## Related Skills

- `wechat-verify-realname`: 步骤1 - 确认实名状态
- `wechat-query-realname-info`: 步骤2 - 调取实名认证信息（诉讼中）
- `wechat-apply-transfer-proof`: 步骤2 - 申请转账电子回单
- `wechat-present-evidence`: 步骤4 - 庭审展示证据流程
