---
name: wechat-apply-transfer-proof
skill_type: A
description: 用于申请微信转账电子回单的执行技能。当双方存在微信转账交易时，可通过微信官方渠道申请带有财付通电子公章的转账电子回单，固定对方的真实姓名作为身份证明。此技能适用于有资金往来的案件类型。
---

# 微信转账电子回单申请技能

## Overview

本技能指导当事人通过微信官方渠道申请转账电子回单，获取带有财付通电子公章的权威交易证明。电子回单会显示交易双方的真实姓名，是证明微信使用者身份和交易事实的重要证据。

## Background

根据调研文章，如果双方存在微信转账交易，可以通过申请微信转账电子回单的方式固定对方的真实姓名。电子回单带有财付通公司的电子公章，法律效力很高，对方通常不会否认，也不敢否认。

## Action

### 申请微信转账电子回单

通过微信官方渠道申请特定转账记录的电子回单。

**申请路径（微信 App）：**
1. 打开微信，点击右下角 "我"
2. 点击 "服务" → "钱包" → "账单"
3. 找到目标转账记录，点击进入详情
4. 点击 "申请转账电子回单"
5. 填写收款人姓名（如不确定可尝试输入）
6. 提交申请，等待审核
7. 审核通过后下载电子回单

**电子回单信息内容：**
| 信息项 | 说明 | 重要提示 |
|-------|------|---------|
| 付款人姓名 | 完整显示 | 申请人本人 |
| 收款人姓名 | 完整显示 | 目标证明对象 |
| 付款微信号 | 完整显示 | 申请人本人 |
| 收款微信号 | **部分显示** | 带星号加密（近期版本） |
| 转账金额 | 精确到分 | 交易金额 |
| 转账时间 | 精确到秒 | 交易时间 |
| 交易单号 | 唯一标识 | 可追溯 |
| 财付通电子公章 | 防伪标识 | **核心效力来源** |

**历史版本差异：**
- **旧版电子回单**：双方微信号均完整显示
- **新版电子回单**：对方微信号带星号加密，己方微信号完整显示

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "WeChat Transfer Proof Application",
  "type": "object",
  "properties": {
    "transfer_records": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "transfer_date": {"type": "string", "description": "转账日期"},
          "amount": {"type": "number", "description": "转账金额"},
          "transaction_id": {"type": "string", "description": "交易单号（如有）"},
          "payee_wechat_id": {"type": "string", "description": "收款人微信号（如已知）"}
        }
      },
      "minItems": 1
    },
    "payee_name_guess": {
      "type": "string",
      "description": "收款人真实姓名猜测（用于填写申请表，如有不确定性可多尝试）"
    },
    "application_reason": {
      "type": "string",
      "description": "申请用途/原因"
    },
    "case_reference": {
      "type": "string",
      "description": "关联案件（如有）"
    }
  },
  "required": ["transfer_records"]
}
```

## Output Schema

```json
{
  "application_result": {
    "status": "success|pending|rejected",
    "electronic_receipt": {
      "receipt_number": "回单编号",
      "issue_date": "签发日期",
      "payer_name": "付款人姓名",
      "payee_name": "收款人姓名",
      "payer_wechat_id": "付款人微信号",
      "payee_wechat_id_masked": "收款人微信号（脱敏）",
      "transfer_amount": "转账金额",
      "transfer_time": "转账时间",
      "has_official_seal": true
    },
    "evidence_value": {
      "identity_proof": "proven|partial|none",
      "transaction_proof": "proven",
      "legal_validity": "high|medium|low",
      "court_acceptance": "high"
    }
  }
}
```

## Legal Guardrails

**风险提示：**
- 申请时需准确填写收款人真实姓名，如填写错误可能导致申请失败
- 如不确定收款人姓名，可以尝试输入，"说不定会有惊喜"
- 电子回单不显示身份证号，仅显示真实姓名
- 新版回单对方微信号脱敏，无法完整显示

**合规要求：**
- 电子回单应保存完整，包括电子公章信息
- 打印件需与原始电子文件保持一致，不得篡改
- 庭审时应出示电子回单的原始载体（手机或电子文件）

**证据效力：**
- 财付通电子公章赋予回单极高的法律效力
- 回单既是身份证明，也是交易事实证明
- 法院对加盖公章的电子回单认可度极高

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《如何在法庭上证明微信使用者的真实身份》第03节 |
| `evolution_value` | 获取带公章的权威交易证明，同时证明身份和交易事实，证据效力极高 |
| `execution_context` | 诉前证据固定、诉讼准备阶段 |

## Test Cases

### 测试用例 1：借贷纠纷 - 申请转账回单

**输入：**
```json
{
  "transfer_records": [
    {
      "transfer_date": "2024-06-15",
      "amount": 50000,
      "transaction_id": "10000500012024061500987654321",
      "payee_wechat_id": "wxid_debtor123"
    }
  ],
  "payee_name_guess": "张三",
  "application_reason": "民间借贷纠纷，证明借款已交付",
  "case_reference": "（2025）粤0305民初1234号"
}
```

**期望输出：**
```json
{
  "application_result": {
    "status": "success",
    "electronic_receipt": {
      "receipt_number": "FT20250110001",
      "issue_date": "2025-01-10",
      "payer_name": "李四",
      "payee_name": "张三",
      "payer_wechat_id": "wxid_lender456",
      "payee_wechat_id_masked": "wxid_de***",
      "transfer_amount": "50000.00",
      "transfer_time": "2024-06-15 14:30:25",
      "has_official_seal": true
    },
    "evidence_value": {
      "identity_proof": "proven",
      "transaction_proof": "proven",
      "legal_validity": "high",
      "court_acceptance": "high"
    }
  }
}
```

**解读：** 电子回单确认收款人姓名为"张三"，转账金额5万元，加盖财付通公章，可作为借款已交付的直接证据。

### 测试用例 2：买卖合同 - 多笔转账申请

**输入：**
```json
{
  "transfer_records": [
    {
      "transfer_date": "2024-03-10",
      "amount": 10000
    },
    {
      "transfer_date": "2024-04-15",
      "amount": 15000
    }
  ],
  "payee_name_guess": "王五",
  "application_reason": "买卖合同纠纷，证明货款已支付",
  "case_reference": "（2025）沪0101民初5678号"
}
```

**期望输出：**
```json
{
  "application_result": {
    "status": "success",
    "electronic_receipts": [
      {
        "receipt_number": "FT20250110002",
        "payer_name": "赵六",
        "payee_name": "王五",
        "transfer_amount": "10000.00",
        "transfer_time": "2024-03-10 10:15:30",
        "has_official_seal": true
      },
      {
        "receipt_number": "FT20250110003",
        "payer_name": "赵六",
        "payee_name": "王五",
        "transfer_amount": "15000.00",
        "transfer_time": "2024-04-15 16:20:45",
        "has_official_seal": true
      }
    ],
    "evidence_value": {
      "identity_proof": "proven",
      "transaction_proof": "proven",
      "legal_validity": "high",
      "court_acceptance": "high",
      "total_amount": "25000.00"
    }
  }
}
```

## Related Skills

- `wechat-verify-realname`: 申请前确认对方微信号实名状态
- `wechat-query-realname-info`: 如需更完整身份信息（含身份证号），可同时申请调取实名信息
- `wechat-present-evidence`: 获取回单后在法庭上展示证据的规范流程
