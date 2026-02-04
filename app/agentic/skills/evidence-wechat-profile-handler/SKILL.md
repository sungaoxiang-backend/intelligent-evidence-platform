---
name: evidence-wechat-profile-handler
description: |
  处理微信个人主页图片。输出独立卡格式的 card_features 列表。
  输入：单张微信个人主页截图
  输出：独立卡格式（扁平列表）
---

# 微信个人主页处理技能

## 证据类型

- **card_type**: 微信个人主页
- **card_is_associated**: false（独立卡）
- **处理方式**: Agent提取

## 提取模式

本技能支持两种提取模式：

| 模式 | 说明 |
|------|------|
| **规则模式**（默认） | 只提取预设槽位（备注名、微信号、昵称、地区） |
| **增强模式** | 预设槽位 + 额外开放信息（根据证据内容提取有价值信息） |

### 模式识别关键词

| 模式 | 触发关键词 |
|------|------------|
| 规则模式 | "提取制作证据卡片"、"提取证据信息" |
| 增强模式 | "开放式提取"、"顺便"、"分析"、"看看还有" |

## 输入

### 规则模式（默认）
```yaml
evidence_materials:
  - url: "https://example.com/wechat_profile.jpg"
    evidence_id: "uuid-1"
    file_type: "image"
```

### 增强模式
```yaml
evidence_materials:
  - url: "https://example.com/wechat_profile.jpg"
    evidence_id: "uuid-1"
    file_type: "image"

extraction_mode: enhanced
extraction_prompt: "分析该账户是否可能是目标被告"  # 可选，增强提取的焦点
```

## 输出：card_features 列表

### 规则模式输出
```json
[
  {
    "slot_name": "微信备注名",
    "slot_value": "王立飞",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从微信个人主页顶部识别备注名",
    "slot_group_info": null
  },
  {
    "slot_name": "微信号",
    "slot_value": "wanglifei123",
    "slot_value_type": "string",
    "confidence": 0.95,
    "reasoning": "从微信号栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "昵称",
    "slot_value": "生活不易",
    "slot_value_type": "string",
    "confidence": 0.90,
    "reasoning": "从昵称栏识别",
    "slot_group_info": null
  },
  {
    "slot_name": "地区",
    "slot_value": "北京",
    "slot_value_type": "string",
    "confidence": 0.85,
    "reasoning": "从地区栏识别",
    "slot_group_info": null
  }
]
```

### 增强模式输出（包含额外信息）
```json
{
  "card_type": "微信个人主页",
  "card_is_associated": false,
  "extraction_mode": "enhanced",
  "card_features": [
    {
      "slot_name": "微信备注名",
      "slot_value": "王立飞",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从微信个人主页顶部识别备注名",
      "slot_group_info": null
    },
    {
      "slot_name": "微信号",
      "slot_value": "wanglifei123",
      "slot_value_type": "string",
      "confidence": 0.95,
      "reasoning": "从微信号栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "昵称",
      "slot_value": "生活不易",
      "slot_value_type": "string",
      "confidence": 0.90,
      "reasoning": "从昵称栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "地区",
      "slot_value": "北京",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "从地区栏识别",
      "slot_group_info": null
    },
    {
      "slot_name": "身份匹配分析",
      "slot_value": "备注名为'王立飞'，与借条借款人姓名一致，可能是同一人",
      "slot_value_type": "string",
      "confidence": 0.85,
      "reasoning": "从备注名与其他证据比对分析",
      "slot_group_info": null,
      "is_enhanced": true
    },
    {
      "slot_name": "管辖法院建议",
      "slot_value": "地区显示为北京，如起诉可考虑北京法院管辖",
      "slot_value_type": "string",
      "confidence": 0.75,
      "reasoning": "从地区信息分析管辖法院",
      "slot_group_info": null,
      "is_enhanced": true
    }
  ]
}
```

## 物理特征识别

### Decisive 特征（必须存在）
- 微信个人主页
- 发消息按钮
- 音视频通话按钮

### Important 特征
- 个人头像
- 昵称
- 微信号
- 地区
- 朋友圈

### 排除规则
- 聊天记录中的头像弹窗
- 不完整的个人主页

## 槽位定义

### 预设槽位（规则模式必提）

| 槽位 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 微信备注名 | string | 是 | 微信中设置的备注名称 |
| 微信号 | string | 是 | 微信账号ID |
| 昵称 | string | 否 | 微信昵称 |
| 地区 | string | 否 | 所在地区 |

### 增强槽位（增强模式可选提）

| 槽位 | 类型 | 说明 |
|------|------|------|
| 身份匹配分析 | string | 与其他证据的比对分析 |
| 管辖法院建议 | string | 根据地区建议管辖法院 |
| 账号活跃度 | string | 账号情况分析 |
| 关联分析 | string | 与其他证据的关联性 |

## 使用示例

### 规则模式
**用户指令**：
> 提取这份微信个人主页制作证据卡片

**处理**：只提取预设槽位

### 增强模式
**用户指令**：
> 提取这份微信个人主页，顺便分析一下这个账户是否可能是目标被告

**处理**：预设槽位 + 身份匹配分析

**用户指令**：
> 提取这份微信个人主页，看看还有没有其他有价值的信息

**处理**：预设槽位 + 额外发现的开放信息

## 相关技能

- evidence-card-caster - 主技能（入口）
- evidence-wechat-chat-handler - 微信聊天记录处理
- evidence-wechat-transfer-handler - 微信转账记录处理
