---
name: evidence-list-compilation
description: 用于编制证据清单一览表的执行技能。本技能提供标准化的证据清单模板和组织方法，帮助律师规范地呈现证据，讲好"法律事实故事"。适用于诉前证据整理、证据交换阶段。
---

# 证据清单一览表制作技能

## Overview

本技能提供《证据清单一览表》的标准模板和编制规范，帮助律师系统化地组织证据，按照逻辑顺序或要件顺序编排，用证据砖石构建法律事实故事。

## Background

根据《最高人民法院关于民事诉讼证据的若干规定》第十九条，当事人应当对其提交的证据材料逐一分类编号，对证据材料的来源、证明对象和内容作简要说明。证据清单一览表是呈现证据的"万能工具"。

## Action

### 编制证据清单一览表

**标准表格格式：**

| 序号 | 证据名称 | 证据来源 | 页码 | 证明内容/证明目的 | 备注 |
|:---|:---|:---|:---|:---|:---|
| 1 | 《XX买卖合同》 | 原告提供 | P1-15 | 1. 证明原、被告之间存在合法有效的买卖合同关系<br>2. 证明合同约定被告应于2023年6月1日前支付货款50万元 | 附原件核对 |
| 2 | 《货物验收单》 | 原告提供 | P16 | 证明原告已于2023年5月15日按约交付全部货物，被告已验收确认 | 附原件核对 |
| 3 | 《律师函》及快递底单 | 原告提供 | P17-19 | 证明原告在被告违约后已履行正式催告程序 | 快递底单为原件 |

**证明目的撰写公式：**

```
"通过【证据具体内容】，证明【法律事实/要件事实】"
```

**示例：**
- ❌ 错误："证明合同关系"（过于笼统）
- ✅ 正确："通过《XX买卖合同》第3条约定的付款条款，证明被告应于2023年6月1日前向原告支付货款人民币50万元，逾期未付构成违约"

## 组织证据的逻辑顺序

**1. 时间顺序** - 最常用，符合认知习惯
- 按合同签订→履行→违约→损失的时间线编排

**2. 要件顺序** - 按法律关系构成要件分组
- 主体资格证据 → 合同订立证据 → 履行情况证据 → 违约及损失证据

**3. 主次顺序** - 核心证据在前，辅助证据在后

**切忌：** 简单按证据类型堆砌（所有合同放一起、所有发票放一起）

## Parameters

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Evidence List Compilation",
  "type": "object",
  "properties": {
    "case_type": {"type": "string"},
    "legal_elements": {
      "type": "array",
      "items": {"type": "string"},
      "description": "法律构成要件列表"
    },
    "organization_method": {
      "type": "string",
      "enum": ["chronological", "elemental", "primary_secondary"],
      "description": "编排方法"
    },
    "evidence_items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "source": {"type": "string"},
          "page_range": {"type": "string"},
          "content_summary": {"type": "string"},
          "legal_fact": {"type": "string"}
        }
      }
    }
  },
  "required": ["case_type", "organization_method"]
}
```

## Output Schema

```json
{
  "evidence_list": {
    "title": "证据清单一览表",
    "case_info": {},
    "table_headers": ["序号", "证据名称", "证据来源", "页码", "证明内容/证明目的", "备注"],
    "evidence_items": [
      {
        "seq": 1,
        "name": "证据名称",
        "source": "原告/被告提供",
        "page": "P1-15",
        "proof_purpose": "通过...,证明...",
        "remark": "附原件核对"
      }
    ],
    "organization_logic": "编排逻辑说明"
  }
}
```

## Legal Guardrails

**风险提示：**
- 证明目的必须精准、具体，指向诉讼请求
- 坚决剔除无关证据，避免干扰法官视线
- 证据间矛盾必须在提交前解决或解释

**编制要点：**
- 每份证据首页用标签纸隔开，标注编号
- 对关键条款、签名用荧光笔高亮
- 同时提交一份未标记的副本给法庭
- 编制清晰的目录和页码

## Metadata

| 属性 | 值 |
|-----|-----|
| `logic_origin` | 《诉讼律师证据工作实战指引（新手篇）》 |
| `evolution_value` | 规范证据呈现方式，提升法官理解效率 |
| `execution_context` | 诉前证据整理、证据交换阶段 |

## Test Cases

### 测试用例 1：买卖合同纠纷

**输入：**
```json
{
  "case_type": "买卖合同纠纷",
  "legal_elements": ["合同关系成立", "货物已交付", "被告违约", "原告损失"],
  "organization_method": "elemental",
  "evidence_items": [
    {"name": "《设备采购合同》", "content_summary": "约定购买设备一台，价款50万元"},
    {"name": "《货物验收单》", "content_summary": "被告签收确认"},
    {"name": "《律师函》", "content_summary": "催款记录"}
  ]
}
```

**期望输出：**
```json
{
  "evidence_list": {
    "title": "证据清单一览表",
    "table_headers": ["序号", "证据名称", "证据来源", "页码", "证明内容/证明目的", "备注"],
    "evidence_items": [
      {
        "seq": 1,
        "name": "《设备采购合同》",
        "source": "原告提供",
        "page": "P1-8",
        "proof_purpose": "1. 证明原、被告于2023年3月1日签订《设备采购合同》，建立合法有效的买卖合同关系；2. 证明合同约定被告应于收到设备后30日内支付价款50万元",
        "remark": "附原件核对"
      },
      {
        "seq": 2,
        "name": "《货物验收单》",
        "source": "原告提供",
        "page": "P9",
        "proof_purpose": "通过被告于2023年4月15日的签收确认，证明原告已按约交付设备，履行合同义务完毕",
        "remark": "附原件核对"
      },
      {
        "seq": 3,
        "name": "《律师函》及快递底单",
        "source": "原告提供",
        "page": "P10-12",
        "proof_purpose": "证明原告在被告逾期未付款后，于2023年6月1日通过律师函方式履行催告义务",
        "remark": "快递底单为原件"
      }
    ],
    "organization_logic": "按法律构成要件顺序编排：合同关系→履行情况→违约催告"
  }
}
```

## Related Skills

- `evidence-collection-guide`: 证据收集策略指引
- `evidence-authenticity-review`: 证据真实性审查
- `evidence-cross-examination`: 证据质证技巧
