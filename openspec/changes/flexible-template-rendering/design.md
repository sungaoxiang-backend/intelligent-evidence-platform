# 灵活模板渲染系统设计文档

## Context

当前系统对模板类型和表格结构有硬编码假设，无法支持复杂的模板场景。以"送达地址确认书"为例，它包含：
- 复杂的表格合并（横向和纵向的colspan/rowspan）
- 条件显示的内容（自然人/法人/其他组织的切换）
- 复选框交互元素
- 表格外的占位符（签名、日期等）
- 混合式内容（表格+段落）

需要设计一个更灵活的渲染系统，解耦模板类型和渲染逻辑。

## Goals

- 支持复杂的表格结构（任意colspan/rowspan组合）
- 支持条件渲染（基于表单数据的显示/隐藏）
- 支持表格外的占位符
- 支持交互元素（复选框、单选按钮等）
- 支持混合式内容（表格+段落+标题等）
- 保持向后兼容性

## Non-Goals

- 不改变现有的模板数据结构（ProseMirror JSON格式）
- 不改变现有的导出逻辑（DOCX导出）
- 不强制要求所有模板都使用新系统（支持渐进式迁移）

## 架构设计

### 1. 渲染配置系统

#### 1.1 模板渲染配置

每个模板可以有一个可选的渲染配置，定义如何渲染不同类型的节点：

```typescript
interface TemplateRenderConfig {
  // 单元格渲染配置
  cellRenderers?: {
    // 匹配规则：基于单元格内容、占位符数量等
    [matcher: string]: CellRendererConfig
  }
  
  // 条件渲染规则
  conditionalRendering?: ConditionalRule[]
  
  // 表格行配置
  tableRowConfig?: {
    showCheckbox?: boolean | 'auto'  // 'auto' 表示根据内容自动判断
    checkboxPosition?: 'left' | 'first-cell'
  }
  
  // 占位符提取配置
  placeholderExtraction?: {
    // 是否从表格外提取占位符
    extractFromNonTable?: boolean
    // 支持的节点类型
    supportedNodeTypes?: string[]
  }
}
```

#### 1.2 单元格渲染器配置

```typescript
interface CellRendererConfig {
  // 渲染器类型
  type: 'default' | 'replicable' | 'narrative' | 'conditional' | 'custom'
  
  // 匹配条件
  matcher: {
    // 占位符数量范围
    placeholderCount?: { min?: number, max?: number }
    // 占位符名称匹配
    placeholderNames?: string[]
    // 单元格内容匹配（正则表达式）
    contentPattern?: string
    // 自定义匹配函数
    customMatcher?: (cellNode: JSONContent) => boolean
  }
  
  // 渲染器选项
  options?: {
    // 是否支持添加/删除
    allowReplication?: boolean
    // 复制模式：'row' | 'paragraph' | 'cell'
    replicationMode?: 'row' | 'paragraph' | 'cell'
    // 是否显示checkbox
    showCheckbox?: boolean
  }
}
```

### 2. 条件渲染系统

#### 2.1 条件规则定义

```typescript
interface ConditionalRule {
  // 目标节点（通过选择器定位）
  target: {
    type: 'cell' | 'row' | 'paragraph' | 'section'
    selector: string  // 例如：'table-0-row-1-cell-0' 或 'placeholder:defendant_type'
  }
  
  // 显示条件
  showWhen: {
    // 表单字段条件
    field?: {
      name: string
      operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'notIn'
      value: any
    }
    // 组合条件（AND/OR）
    logic?: 'and' | 'or'
    conditions?: ConditionalRule[]
  }
  
  // 隐藏时的行为
  hideBehavior?: 'remove' | 'display-none' | 'collapse'
}
```

#### 2.2 条件渲染实现

- 在渲染时评估条件规则
- 根据表单数据动态显示/隐藏节点
- 支持嵌套条件（AND/OR逻辑）

### 3. 占位符提取增强

#### 3.1 扩展占位符提取

当前系统只从表格单元格中提取占位符，需要扩展到：
- 段落节点
- 标题节点
- 列表节点
- 其他支持文本的节点

#### 3.2 占位符提取配置

```typescript
interface PlaceholderExtractionConfig {
  // 从哪些节点类型提取
  nodeTypes: string[]
  // 占位符格式（支持自定义正则）
  pattern?: RegExp | string
  // 提取后的处理
  postProcess?: (placeholder: PlaceholderInfo) => PlaceholderInfo
}
```

### 4. 复杂表格支持

#### 4.1 合并单元格预览

- 在预览时正确显示colspan/rowspan
- 支持合并单元格中的占位符
- 支持合并单元格的交互（如果配置了）

#### 4.2 合并单元格编辑

- 在编辑时保持合并单元格结构
- 支持在合并单元格中插入占位符
- 支持拆分合并单元格（如果需要）

### 5. 交互元素支持

#### 5.1 复选框/单选按钮

- 支持在模板中定义复选框/单选按钮
- 支持基于选择的条件渲染
- 支持在表单预览中显示交互元素

#### 5.2 交互元素定义

```typescript
interface InteractiveElement {
  type: 'checkbox' | 'radio' | 'select'
  name: string  // 对应的表单字段名
  options?: { label: string, value: any }[]  // 选项（用于radio/select）
  defaultValue?: any
  // 条件渲染规则
  conditionalRendering?: ConditionalRule[]
}
```

### 6. 混合内容支持

#### 6.1 内容类型识别

- 自动识别模板中的内容类型（表格、段落、标题等）
- 为不同类型的内容应用不同的渲染逻辑
- 支持在同一模板中混合使用

#### 6.2 渲染策略

- 表格：使用表格渲染器（支持复杂合并）
- 段落：使用段落渲染器（支持占位符）
- 标题：使用标题渲染器（支持占位符）
- 列表：使用列表渲染器（支持占位符）

## 实现方案

### Phase 1: 基础架构（向后兼容）

1. **渲染配置系统**
   - 创建 `TemplateRenderConfig` 接口和默认配置
   - 实现配置加载和解析
   - 保持现有模板的默认行为（向后兼容）

2. **占位符提取增强**
   - 扩展 `extractPlaceholders` 函数，支持从段落、标题等节点提取
   - 更新占位符提取逻辑，不限制在表格单元格中

3. **条件渲染基础**
   - 实现条件规则评估引擎
   - 实现条件渲染组件
   - 支持简单的字段条件（equals/notEquals）

### Phase 2: 复杂表格支持

1. **合并单元格预览**
   - 增强表格渲染，正确显示colspan/rowspan
   - 支持合并单元格中的占位符渲染
   - 支持合并单元格的交互（如果配置）

2. **单元格渲染器系统**
   - 实现可配置的单元格渲染器
   - 支持基于匹配规则的渲染器选择
   - 保持现有渲染器作为默认选项

### Phase 3: 交互元素和条件渲染

1. **交互元素支持**
   - 实现复选框/单选按钮组件
   - 支持在模板中定义交互元素
   - 支持交互元素的条件渲染

2. **高级条件渲染**
   - 支持组合条件（AND/OR）
   - 支持嵌套条件
   - 支持复杂的字段条件（contains/in等）

### Phase 4: 混合内容和优化

1. **混合内容支持**
   - 实现内容类型识别
   - 为不同类型内容应用不同渲染策略
   - 优化渲染性能

2. **性能优化**
   - 优化条件渲染评估
   - 优化占位符提取
   - 优化表格渲染性能

## 迁移策略

### 现有模板迁移

1. **自动检测和配置生成**
   - 分析现有模板结构
   - 自动生成渲染配置
   - 保持现有行为不变

2. **渐进式迁移**
   - 新模板可以使用新配置
   - 现有模板可以逐步迁移
   - 支持配置覆盖默认行为

### 配置示例

#### 简单模板（保持现有行为）

```json
{
  "cellRenderers": {
    "default": {
      "type": "auto",  // 自动根据模板类型选择
      "matcher": {}
    }
  }
}
```

#### 复杂模板（送达地址确认书）

```json
{
  "cellRenderers": {
    "conditional-cells": {
      "type": "conditional",
      "matcher": {
        "placeholderNames": ["defendant_type"]
      },
      "options": {
        "replicationMode": "cell"
      }
    },
    "default": {
      "type": "default",
      "matcher": {}
    }
  },
  "conditionalRendering": [
    {
      "target": {
        "type": "section",
        "selector": "natural-person-section"
      },
      "showWhen": {
        "field": {
          "name": "defendant_type",
          "operator": "equals",
          "value": "natural"
        }
      }
    },
    {
      "target": {
        "type": "section",
        "selector": "legal-person-section"
      },
      "showWhen": {
        "field": {
          "name": "defendant_type",
          "operator": "equals",
          "value": "legal"
        }
      }
    }
  ],
  "placeholderExtraction": {
    "extractFromNonTable": true,
    "supportedNodeTypes": ["paragraph", "heading"]
  }
}
```

## Risks / Trade-offs

### Risks

1. **性能影响**：条件渲染和配置匹配可能影响性能
   - **缓解**：使用缓存和优化评估逻辑

2. **向后兼容性**：新系统可能破坏现有模板
   - **缓解**：保持默认行为，渐进式迁移

3. **配置复杂性**：复杂模板的配置可能很复杂
   - **缓解**：提供配置生成工具和文档

### Trade-offs

1. **灵活性 vs 简单性**：更灵活的系统可能更复杂
   - **选择**：提供默认配置，复杂场景才需要自定义

2. **性能 vs 功能**：更多功能可能影响性能
   - **选择**：优化关键路径，使用懒加载

## Open Questions

1. 是否需要支持模板级别的配置，还是只支持全局配置？
2. 条件渲染的评估时机（实时 vs 按需）？
3. 如何平衡灵活性和易用性？

