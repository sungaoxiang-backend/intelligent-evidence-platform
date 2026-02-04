---
name: evidence-open-extractor
description: |
  当需要从多模态证据材料（图片/PDF/文档）中开放式提取信息时，使用此技能执行：
  1. 输入证据材料（单个或多个）
  2. 识别证据类型和分组（联合卡/独立卡）
  3. 根据证据实际内容动态提取关键信息，不预设固定槽位
  4. 输出符合 EvidenceCard 数据结构的卡片
---

# 开放式证据提取

## 核心特点

与预设式提取不同，本技能：
- **不预设槽位列表**：根据证据实际内容决定提取什么
- **开放式提取**：从证据中发现并提取所有有价值的信息
- **数据结构一致**：输出仍为 EvidenceCard 标准格式

## 快速开始

### 输入格式

```yaml
evidence_materials:
  - url: "https://example.com/image1.jpg"
    evidence_id: "uuid-1"
  - url: "https://example.com/image2.jpg"
    evidence_id: "uuid-2"
```

### 输出：EvidenceCard 数据结构

**联合卡输出**（根据实际内容提取）：
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
        {"slot_name": "欠款金额", "slot_value": 5094.0, "slot_value_type": "number", "confidence": 0.92, "reasoning": "...", "reference_evidence_ids": ["uuid-2"]},
        {"slot_name": "欠款明细", "slot_value": "2024年：11.19 2110元...", "slot_value_type": "string", "confidence": 0.90, "reasoning": "...", "reference_evidence_ids": ["uuid-1", "uuid-2"]},
        {"slot_name": "催款记录", "slot_value": true, "slot_value_type": "boolean", "confidence": 0.95, "reasoning": "...", "reference_evidence_ids": ["uuid-1"]}
      ]
    }
  ]
}
```

**独立卡输出**（根据实际内容提取）：
```json
{
  "card_type": "身份证",
  "card_is_associated": false,
  "card_features": [
    {"slot_name": "姓名", "slot_value": "王立飞", "slot_value_type": "string", "confidence": 0.98, "reasoning": "...", "slot_group_info": null},
    {"slot_name": "公民身份号码", "slot_value": "421127198411060237", "slot_value_type": "string", "confidence": 0.98, "reasoning": "...", "slot_group_info": null}
  ]
}
```

## Step 1: 证据分类与分组

### 判断证据类型

根据视觉特征识别是什么类型的证据：
- 微信聊天记录、身份证、营业执照、转账记录等

### 判断处理模式

| 场景 | 处理模式 | 说明 |
|------|----------|------|
| 单张图片 | 独立卡 | 直接提取 |
| 多张同类型图片 | 联合卡 | 按标识分组后提取 |

### 联合卡分组规则

如果多张图片是微信聊天记录：
1. 识别每张图的 `微信备注名`
2. 按备注名分组
3. 为每组分配 `sequence_number`

## Step 2: 开放式提取原则

### 核心原则

**看见什么提取什么**：
- 不预设必须提取的槽位
- 根据证据内容决定提取范围
- 只提取证据中明确包含的信息
- 证据中没有的不强行提取

### 提取优先级

| 优先级 | 信息类型 | 示例 |
|--------|----------|------|
| P0 | 当事人身份信息 | 姓名、账号、身份信息 |
| P1 | 金额/数值信息 | 欠款金额、转账金额 |
| P2 | 关键事实表述 | 承认欠款、承诺还款 |
| P3 | 时间信息 | 交易时间、承诺还款时间 |
| P4 | 辅助信息 | 货物明细、交易内容 |

### 提取决策流程

```
证据内容
    ↓
识别证据类型
    ↓
是否包含身份信息？→ 提取（姓名、账号）
    ↓
是否包含金额信息？→ 提取（金额、币种）
    ↓
是否包含事实表述？→ 提取（承认/否认/承诺）
    ↓
是否包含时间信息？→ 提取（日期、时间）
    ↓
是否有其他重要信息？→ 判断价值后决定提取
    ↓
输出提取结果
```

## Step 3: 构建卡片结构

### 联合卡结构

```yaml
card_features:
  - slot_name: "分组标识"              # 如微信备注名
    slot_value_type: "group"
    slot_value: null
    confidence: 1.0
    reasoning: "分组说明"
    image_sequence_info:
      - evidence_id: "uuid-1"
        sequence_number: 1
      - evidence_id: "uuid-2"
        sequence_number: 2
    sub_features:                       # 动态提取的槽位
      - slot_name: "实际发现的槽位1"
        slot_value: "提取的值"
        slot_value_type: "string/number/boolean/date"
        confidence: 0.xx
        reasoning: "从哪张图、如何提取的"
        reference_evidence_ids: ["来源证据ID"]
      - slot_name: "实际发现的槽位2"
        ...
```

### 独立卡结构

```yaml
card_features:
  - slot_name: "实际发现的槽位1"
    slot_value: "提取的值"
    slot_value_type: "string/number/boolean/date"
    confidence: 0.xx
    reasoning: "如何提取的"
    slot_group_info: null
```

## 开放式提取示例

### 场景1：微信聊天记录（实际提取内容动态决定）

**输入**：2张微信聊天截图

**实际提取**（根据图中内容决定）：
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
          "slot_name": "欠款总金额",
          "slot_value": 5094.0,
          "slot_value_type": "number",
          "confidence": 0.92,
          "reasoning": "第2张图显示2024年欠款4084元，第1张图显示2023年送货单1010元，合计5094元",
          "reference_evidence_ids": ["uuid-2", "uuid-1"]
        },
        {
          "slot_name": "2024年欠款明细",
          "slot_value": "11.19 2110元, 11.24 1180元, 12.22 794元",
          "slot_value_type": "string",
          "confidence": 0.90,
          "reasoning": "第2张聊天记录中被告确认的三笔欠款",
          "reference_evidence_ids": ["uuid-2"]
        },
        {
          "slot_name": "2023年送货单信息",
          "slot_value": "2023年11.24 1010元（慧源建材送货单：中沙100包、水泥20包）",
          "slot_value_type": "string",
          "confidence": 0.88,
          "reasoning": "第1张聊天记录中提到的2023年送货单照片内容",
          "reference_evidence_ids": ["uuid-1"]
        },
        {
          "slot_name": "欠款确认",
          "slot_value": true,
          "slot_value_type": "boolean",
          "confidence": 0.90,
          "reasoning": "第2张图中被告回复'好，知道'确认欠款事实",
          "reference_evidence_ids": ["uuid-2"]
        },
        {
          "slot_name": "催款时间",
          "slot_value": "2024-08-23, 2024-12-28",
          "slot_value_type": "string",
          "confidence": 0.95,
          "reasoning": "第1张图显示8月23日催款，第2张图显示12月28日催款",
          "reference_evidence_ids": ["uuid-1", "uuid-2"]
        },
        {
          "slot_name": "建材种类",
          "slot_value": "中沙100包, 水泥20包",
          "slot_value_type": "string",
          "confidence": 0.85,
          "reasoning": "第1张图中送货单照片显示的货物明细",
          "reference_evidence_ids": ["uuid-1"]
        }
      ]
    }
  ]
}
```

### 场景2：身份证（实际提取内容动态决定）

**输入**：1张身份证照片

**实际提取**（根据图中内容决定）：
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
      "reasoning": "从身份证正面人像面识别",
      "slot_group_info": null
    },
    {
      "slot_name": "公民身份号码",
      "slot_value": "421127198411060237",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面识别",
      "slot_group_info": null
    },
    {
      "slot_name": "出生日期",
      "slot_value": "1984-11-06",
      "slot_value_type": "date",
      "confidence": 0.98,
      "reasoning": "从身份证正面人像面识别",
      "slot_group_info": null
    },
    {
      "slot_name": "户籍地址",
      "slot_value": "湖北省黄梅县柳林乡柳林村一组",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从身份证正面人像面识别",
      "slot_group_info": null
    }
  ]
}
```

### 场景3：营业执照（实际提取内容动态决定）

**输入**：1张营业执照照片

**实际提取**（根据图中内容决定）：
```json
{
  "card_type": "公司营业执照",
  "card_is_associated": false,
  "card_features": [
    {
      "slot_name": "公司名称",
      "slot_value": "武汉慧源建材有限公司",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从营业执照正本识别",
      "slot_group_info": null
    },
    {
      "slot_name": "统一社会信用代码",
      "slot_value": "91420100MA12345678",
      "slot_value_type": "string",
      "confidence": 0.98,
      "reasoning": "从营业执照正本识别",
      "slot_group_info": null
    },
    {
      "slot_name": "法定代表人",
      "slot_value": "李明",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从营业执照正本识别",
      "slot_group_info": null
    },
    {
      "slot_name": "注册资本",
      "slot_value": "500万元",
      "slot_value_type": "string",
      "confidence": 0.92,
      "reasoning": "从营业执照正本识别",
      "slot_group_info": null
    },
    {
      "slot_name": "经营范围",
      "slot_value": "建材销售、室内外装饰工程、水暖器材销售",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从营业执照正本识别经营范围一栏",
      "slot_group_info": null
    }
  ]
}
```

## 槽位类型规范

| slot_value_type | 说明 | 示例 |
|----------------|------|------|
| **string** | 字符串文本 | "王立飞", "湖北省..." |
| **number** | 数字金额 | 5000, 5094.0 |
| **boolean** | 布尔判断 | true, false |
| **date** | 日期 | "2024-12-25" |
| **group** | 分组标识（联合卡） | "王立飞" |

## 置信度评估指南

| 置信度 | 场景 | 示例 |
|--------|------|------|
| 0.98-1.00 | OCR清晰识别 | 身份证号码、营业执照统一社会信用代码 |
| 0.92-0.98 | AI清晰识别，无歧义 | 姓名、金额 |
| 0.85-0.92 | AI识别，有一定依据 | 欠款明细、时间 |
| 0.75-0.85 | AI推断，有一定不确定性 | 模糊表述的理解 |
| <0.75 | 不确定信息 | 不建议提取 |

## 开放式 vs 预设式对比

| 维度 | 预设式 | 开放式（当前技能） |
|------|--------|-------------------|
| 槽位列表 | 固定预设 | 动态生成 |
| 提取范围 | 预设范围 | 实际内容决定 |
| 灵活性 | 低 | 高 |
| 适用场景 | 标准化案件 | 复杂/多样化证据 |

## 相关技能

- `evidence-card-caster` - 预设式证据卡片铸造（固定槽位）
- `evidence-authenticator` - 证据审核认定
- `evidence-identifier` - 证据类型识别
