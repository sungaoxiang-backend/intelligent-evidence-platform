---
name: wechat-verify-realname
description: 用于确认特定微信号是否已完成实名认证的执行技能。在民事纠纷中，当需要证明微信聊天记录主体身份时，首先应确认对方微信号是否已实名认证。此技能适用于诉讼准备阶段、证据收集阶段。
---

# WeChat 实名认证验证技能

## Overview

本技能提供一种快速判断微信号是否已完成实名认证的方法，通过微信转账界面观察实名显示特征，为后续身份认证策略提供决策依据。

## Background

在司法实践中，微信聊天记录作为电子证据时，证明聊天主体的真实身份是核心难点。实名认证的微信号相比未实名账号具有更高的证据效力，且可以通过后续程序调取权威的实名认证信息。

## Action

### 检查微信号实名状态

通过微信转账界面判断目标微信号是否已实名认证。

**执行步骤：**

1. 打开目标微信好友的聊天界面
2. 点击右下角 "+" 按钮
3. 点击 "转账" 功能
4. 观察转账界面顶部的昵称显示区域

**判断标准：**

| 显示特征 | 状态判断 | 说明 |
|---------|---------|------|
| `(**龙)` 或 `（***凤）` 或 `（*吉）` | **已实名** | 小括号内显示星号+实名姓名尾字 |
| 无小括号，仅显示昵称 | **未实名** | 该微信号未完成实名认证 |

**实名尾字含义：**
- `(**龙)` = 实名为两个字，姓+名的最后一个字
- `（***凤）` = 实名为三个字
- `（*吉）` = 实行为四个字

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WeChat Realname Verification",
  "type": "object",
  "properties": {
    "target_wechat_id": {
      "type": "string",
      "description": "目标微信号或昵称"
    },
    "contact_alias": {
      "type": "string",
      "description": "通讯录中的备注名称（可选）"
    },
    "observation_result": {
      "type": "string",
      "enum": ["verified", "unverified", "unknown"],
      "description": "观察到的认证状态"
    },
    "name_tail": {
      "type": "string",
      "description": "实名尾字（如已实名）"
    },
    "name_length_hint": {
      "type": "integer",
      "description": "姓名字数提示（2-4字）"
    }
  },
  "required": ["target_wechat_id", "observation_result"]
}
```

## Output Schema

```json
{
  "verification_result": {
    "is_realname_verified": true|false,
    "name_tail_hint": "龙|null",
    "name_length_hint": 2|3|4|null,
    "verification_method": "wechat_transfer_interface",
    "verification_timestamp": "ISO 8601 datetime",
    "recommended_next_action": "query_realname_info|apply_transfer_proof|auxiliary_evidence"
  }
}
```

## Legal Guardrails

**风险提示：**
- 本方法仅能判断实名状态，无法直接获取完整实名信息
- 转账操作请勿输入金额并完成支付，仅作界面观察
- 未实名微信号需采用其他辅助证明方法

**合规要求：**
- 此验证应在合法的诉讼准备或证据收集框架下进行
- 避免频繁操作触发微信风控

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《如何在法庭上证明微信使用者的真实身份》第01节 |
| `evolution_value` | 快速判断实名状态，为后续调取策略提供决策依据，节省无效申请成本 |
| `execution_context` | 诉前证据收集、诉讼准备阶段 |

## Test Cases

### 测试用例 1：已实名账号（三字姓名）

**输入：**
```json
{
  "target_wechat_id": "wxid_xxxx1234",
  "contact_alias": "张三",
  "observation_result": "verified",
  "name_tail": "凤",
  "name_length_hint": 3
}
```

**期望输出：**
```json
{
  "verification_result": {
    "is_realname_verified": true,
    "name_tail_hint": "凤",
    "name_length_hint": 3,
    "verification_method": "wechat_transfer_interface",
    "verification_timestamp": "2025-01-10T10:30:00+08:00",
    "recommended_next_action": "query_realname_info"
  }
}
```

**解读：** 该账号已实名，实名姓名为三字，尾字为"凤"，建议使用 `wechat-query-realname-info` 技能调取完整实名信息。

### 测试用例 2：未实名账号

**输入：**
```json
{
  "target_wechat_id": "wxid_yyyy5678",
  "contact_alias": "李四",
  "observation_result": "unverified"
}
```

**期望输出：**
```json
{
  "verification_result": {
    "is_realname_verified": false,
    "name_tail_hint": null,
    "name_length_hint": null,
    "verification_method": "wechat_transfer_interface",
    "verification_timestamp": "2025-01-10T11:15:00+08:00",
    "recommended_next_action": "auxiliary_evidence"
  }
}
```

**解读：** 该账号未实名，无法通过财付通调取实名信息，建议采用聊天内容、朋友圈、自认等辅助证据方法。

## Related Skills

- `wechat-query-realname-info`: 调取完整实名认证信息（仅限已实名账号）
- `wechat-apply-transfer-proof`: 申请转账电子回单（如存在转账记录）
- `wechat-verify-user-identity`: 综合身份证明流程编排
