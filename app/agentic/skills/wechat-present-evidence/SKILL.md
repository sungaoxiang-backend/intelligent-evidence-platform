---
name: wechat-present-evidence
description: 用于在法庭上规范展示微信证据的编排技能。当庭审需要出示微信聊天记录作为证据时，按照法定流程逐步展示登录过程、个人信息界面、聊天记录、转账记录等，确保证据的合法性、真实性和关联性。此技能适用于庭审质证阶段。
---

# 法庭微信证据展示流程技能

## Overview

本技能编排了在法庭上规范展示微信证据的完整流程，确保微信聊天记录作为电子数据证据符合《民事诉讼法》及司法解释对电子证据的要求，避免因举证不规范导致证据不被采信。

## Background

根据调研文章，在法庭上展示微信证据时应当遵循规范步骤。达拉特旗人民法院曾因当事人仅提交截图且无法提供原始载体、无法证明聊天对象身份，最终驳回诉讼请求。规范举证对确保证据被采信至关重要。

## Workflow

### 法庭展示微信证据标准流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    微信证据展示流程                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  准备原始载体    │
                    │  (手机/电脑)     │
                    └────────┬────────┘
                             │
                              ▼
                    ┌─────────────────┐
                    │   步骤1：登录展示  │
                    │   展示登录过程    │
                    └────────┬────────┘
                             │
                              ▼
                    ┌─────────────────┐
                    │  步骤2：个人信息  │
                    │  双方微信号/手机号 │
                    └────────┬────────┘
                             │
                              ▼
                    ┌─────────────────┐
                    │  步骤3：聊天记录  │
                    │  完整对话内容    │
                    └────────┬────────┘
                             │
                              ▼
                    ┌─────────────────┐
                    │  步骤4：转账记录  │
                    │  (如有资金往来)  │
                    └────────┬────────┘
                             │
                              ▼
                    ┌─────────────────┐
                    │  步骤5：关联证据  │
                    │  电子回单/复函等  │
                    └─────────────────┘
```

## 步骤详解

### 步骤 1：展示登录过程

**目的：** 证明电子数据来源于当事人控制的设备，确保证据的真实性。

**操作要点：**
- 使用原始载体设备（手机/电脑）现场操作
- 展示从解锁设备到登录微信的完整过程
- 确认登录账号与当事人身份一致

**注意事项：**
- 必须使用原始载体，不得使用录屏替代（除非经法庭允许）
- 如手机故障，需提前说明原因并申请司法鉴定

### 步骤 2：展示个人信息界面

**目的：** 证明聊天双方的身份，确保证据的关联性。

**操作要点：**
- 点击对方头像进入个人信息页
- 展示微信号（不可更改的特性用于排除冒名）
- 展示绑定的手机号（如有）
- 展示实名认证状态（如有）
- 对群聊记录，需标注各涉案当事人的身份

**注意事项：**
- 微信号具有唯一性和不可更改性，是身份认定的关键
- 手机号可辅助验证，但需证明手机号归属

### 步骤 3：展示聊天记录

**目的：** 展示完整对话内容，证明案件事实。

**操作要点：**
- 展示全部对话过程，不得选择性截取
- 滚动展示聊天时间线，证明记录的连续性
- 重点展示关键对话内容，让法官/对方核对
- 如有图片、音频、视频，需当场播放查看

**注意事项：**
- 必须保持聊天记录完整性，不得删除不利信息
- 语音需转化为文字并附原始音频
- 截图需包含头像、昵称、微信号、时间等完整信息

### 步骤 4：展示转账记录

**目的：** 如涉及金钱往来，证明交易事实。

**操作要点：**
- 进入聊天记录中的转账详情页
- 展示转账金额、时间、交易单号
- 如已申请电子回单，同时出示回单原件
- 展示回单上的财付通电子公章

**注意事项：**
- 转账时应备注"借款""货款"等明确用途
- 大额交易建议优先申请盖章的电子回单

### 步骤 5：展示关联证据

**目的：** 强化证据效力，形成证据链。

**可展示的关联证据：**
- 微信转账电子回单（加盖公章）
- 财付通实名认证复函
- 公证处出具的公证书（如有）
- 司法鉴定报告（如有争议）

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WeChat Evidence Presentation",
  "type": "object",
  "properties": {
    "evidence_type": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["chat_records", "transfer_records", "realname_proof", "electronic_receipt"]
      },
      "description": "证据类型列表"
    },
    "has_original_device": {
      "type": "boolean",
      "description": "是否有原始载体设备"
    },
    "has_notarization": {
      "type": "boolean",
      "description": "是否经过公证"
    },
    "chat_parties": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "party_name": {"type": "string"},
          "wechat_id": {"type": "string"},
          "role": {"type": "string", "enum": ["plaintiff", "defendant", "witness"]}
        }
      },
      "description": "聊天各方信息"
    },
    "key_messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": {"type": "string"},
          "summary": {"type": "string"},
          "relevance": {"type": "string"}
        }
      },
      "description": "关键消息摘要"
    }
  },
  "required": ["evidence_type", "has_original_device"]
}
```

## Output Schema

```json
{
  "presentation_plan": {
    "steps": [
      {
        "step_number": 1,
        "action": "show_login",
        "description": "展示登录过程",
        "device_required": true,
        "expected_duration": "1-2分钟"
      },
      {
        "step_number": 2,
        "action": "show_profile",
        "description": "展示个人信息界面",
        "key_points": ["微信号", "手机号", "实名状态"]
      },
      {
        "step_number": 3,
        "action": "show_chat_records",
        "description": "展示完整聊天记录",
        "completeness_check": true
      },
      {
        "step_number": 4,
        "action": "show_transfer_records",
        "description": "展示转账记录（如有）",
        "condition": "transfer_records in evidence_type"
      },
      {
        "step_number": 5,
        "action": "show_supporting_evidence",
        "description": "展示关联证据",
        "items": ["电子回单", "实名复函", "公证书"]
      }
    ],
    "evidence_validity_assessment": {
      "authenticity": "verified|partial|unverified",
      "integrity": "complete|selective|incomplete",
      "relevance": "direct|circumstantial|weak",
      "overall_validity": "high|medium|low"
    }
  }
}
```

## Legal Guardrails

**风险提示：**
- 仅提供截图而无法出示原始载体，证据可能不被采信
- 选择性截取聊天记录可能被认定为虚假举证
- 无法证明聊天对象身份会导致关联性缺失
- 原始载体如已更换，需提前说明并准备替代方案

**合规要求：**
- 按照《最高人民法院关于民事诉讼证据的若干规定》第15条，电子数据应提供原件
- 按照《最高人民法院关于民事诉讼证据的若干规定》第93条，法院会综合判断电子数据的真实性
- 完整保存记录，避免只选择性保存对自己有利的部分

**证据强化建议：**
- 对关键微信聊天记录进行公证，法院通常直接确认其真实性
- 如证据存在被篡改风险，可申请专业机构进行司法鉴定

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《如何在法庭上证明微信使用者的真实身份》"在法庭上展示微信证据时" + "微信聊天记录难获采信！法官五招教你规范举证不'踩坑'" |
| `evolution_value` | 规范举证流程，避免因展示不当导致证据不被采信，提高诉讼胜诉率 |
| `execution_context` | 庭审质证阶段 |

## Test Cases

### 测试用例 1：借贷纠纷 - 完整举证流程

**输入：**
```json
{
  "evidence_type": ["chat_records", "transfer_records", "electronic_receipt"],
  "has_original_device": true,
  "has_notarization": false,
  "chat_parties": [
    {
      "party_name": "李四（出借人）",
      "wechat_id": "wxid_lender456",
      "role": "plaintiff"
    },
    {
      "party_name": "张三（借款人）",
      "wechat_id": "wxid_debtor123",
      "role": "defendant"
    }
  ],
  "key_messages": [
    {
      "date": "2024-06-14",
      "summary": "张三承认借款5万元，承诺年底归还",
      "relevance": "核心证据"
    },
    {
      "date": "2024-06-15",
      "summary": "李四通过微信转账5万元给张三",
      "relevance": "交付证据"
    }
  ]
}
```

**期望输出：**
```json
{
  "presentation_plan": {
    "steps": [
      {
        "step_number": 1,
        "action": "show_login",
        "description": "展示李四登录微信的过程",
        "device_required": true,
        "expected_duration": "1-2分钟"
      },
      {
        "step_number": 2,
        "action": "show_profile",
        "description": "展示张三的个人资料页",
        "key_points": ["微信号：wxid_debtor123", "实名状态：已实名（***三）"]
      },
      {
        "step_number": 3,
        "action": "show_chat_records",
        "description": "滚动展示2024年6月的完整对话",
        "key_messages": ["2024-06-14 借款承认", "2024-06-15 转账确认"],
        "completeness_check": true
      },
      {
        "step_number": 4,
        "action": "show_transfer_records",
        "description": "展示5万元转账详情",
        "transfer_details": {
          "amount": "50000.00元",
          "time": "2024-06-15 14:30",
          "transaction_id": "10000500012024061500987654321"
        }
      },
      {
        "step_number": 5,
        "action": "show_supporting_evidence",
        "description": "出示转账电子回单",
        "items": [
          {
            "type": "electronic_receipt",
            "receipt_number": "FT20250110001",
            "has_seal": true,
            "key_info": "付款人：李四，收款人：张三"
          }
        ]
      }
    ],
    "evidence_validity_assessment": {
      "authenticity": "verified",
      "integrity": "complete",
      "relevance": "direct",
      "overall_validity": "high",
      "risk_assessment": "证据充分，可被采信"
    }
  }
}
```

### 测试用例 2：无原始载体 - 风险提示

**输入：**
```json
{
  "evidence_type": ["chat_records"],
  "has_original_device": false,
  "has_notarization": false,
  "chat_parties": [
    {"party_name": "王五", "wechat_id": "wxid_wang", "role": "plaintiff"}
  ]
}
```

**期望输出：**
```json
{
  "presentation_plan": {
    "steps": [],
    "error": {
      "code": "NO_ORIGINAL_DEVICE",
      "severity": "critical",
      "message": "无法提供原始载体设备，证据可能不被采信",
      "reference_case": "达拉特旗人民法院案例：原告仅提交截图且无法出示原始载体，最终驳回诉讼请求"
    },
    "alternative_actions": [
      "提供设备故障证明并申请司法鉴定",
      "提供证据复制件与原件一致的证明",
      "说明无法提供原始载体的客观原因"
    ],
    "evidence_validity_assessment": {
      "authenticity": "unverified",
      "integrity": "unknown",
      "relevance": "unknown",
      "overall_validity": "low",
      "risk_assessment": "高风险，建议补充其他证据"
    }
  }
}
```

## Related Skills

- `wechat-verify-realname`: 展示个人信息时辅助判断实名状态
- `wechat-query-realname-info`: 获取实名复函作为关联证据
- `wechat-apply-transfer-proof`: 获取电子回单作为关联证据
- `wechat-verify-user-identity`: 综合身份证明完整流程
