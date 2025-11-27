# 模板系统局限性分析设计文档

## Context

当前文书模板和文书生成模块在实现过程中，为了支持"要素式"和"陈述式"两种模板类型，引入了大量硬编码的假设和特殊处理逻辑。这些假设限制了系统的灵活性，使得系统难以处理不符合这些假设的模板。

## Goals

- 系统性地识别和文档化当前系统的所有假设和限制
- 为未来的架构重构提供清晰的改进方向
- 帮助开发者理解系统的边界和约束

## Non-Goals

- 不在此阶段进行代码重构
- 不修改现有功能的行为
- 不添加新的功能

## 当前系统的假设和限制

### 1. 模板类型假设

#### 假设内容
系统假设所有模板必须属于以下三种类型之一：
- **要素式** (`category.includes("要素") || category === "要素式"`)
- **陈述式** (`category.includes("陈述") || category === "陈述式"`)
- **混合式** (`category === "混合式"`)

#### 影响范围
- 模板创建时必须选择类型
- 渲染逻辑完全基于类型判断
- 无法处理未分类或自定义类型的模板

#### 代码位置
- `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx:49-50`
- `frontend/components/document-generation/document-preview-form.tsx:213, 475-476`
- `app/template_editor/services.py:307-308`

### 2. 表格结构假设

#### 假设内容
系统假设：
- 所有需要交互的模板内容都必须在表格中
- 表格行必须支持checkbox控制（要素式使用绝对定位覆盖，陈述式创建checkbox单元格）
- 表格单元格必须按照特定方式组织（包含段落、占位符等）

#### 影响范围
- 无法处理纯段落结构的模板（无表格）
- 无法处理嵌套表格或复杂表格结构
- 表格行必须有checkbox列（要素式）或checkbox单元格（陈述式）

#### 代码位置
- `frontend/components/document-generation/document-preview-form.tsx:475-777`
- `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx:39-465`

### 3. 单元格处理假设

#### 假设内容
系统对不同模板类型的单元格处理有严格假设：

**要素式模板**：
- 只有包含**多个占位符**的单元格才使用 `ReplicableCell` 组件
- 单个占位符或没有占位符的单元格使用默认渲染
- 单元格内容必须能够垂直排列

**陈述式模板**：
- **所有单元格**（无论是否有占位符）都使用 `NarrativeTableCell` 组件
- 单元格必须支持段落复制功能
- 单元格内容必须能够转换为段落序列

**混合式模板**：
- 使用简单渲染，不应用任何特殊功能
- 保留原始 ProseMirror JSON 结构

#### 影响范围
- 无法处理不符合这些假设的单元格结构
- 无法自定义单元格的渲染方式
- 单元格的交互功能完全由模板类型决定

#### 代码位置
- `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx:57-329` (陈述式)
- `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx:331-457` (要素式)
- `frontend/components/document-generation/narrative-table-cell.tsx` (陈述式单元格实现)

### 4. 占位符组织假设

#### 假设内容
系统假设占位符必须按照以下方式组织：
- 占位符必须嵌入在单元格的段落中
- 要素式模板中，多个占位符的单元格才能使用 `ReplicableCell`
- 陈述式模板中，占位符可以没有，但仍然使用 `NarrativeTableCell`
- 占位符必须通过 `extractPlaceholdersFromCell` 函数提取

#### 影响范围
- 无法处理占位符在表格外的场景
- 无法处理占位符在非段落节点中的场景
- 占位符的提取逻辑硬编码在单元格处理中

#### 代码位置
- `frontend/components/document-generation/replicable-cell-utils.ts:26-40`
- `frontend/components/document-generation/narrative-table-cell.tsx:35-49`

### 5. 预览和编辑功能的局限性

#### 模板预览局限性
- 预览模式完全依赖模板类型判断
- 无法预览不符合假设的模板结构
- 预览渲染逻辑与编辑渲染逻辑耦合

#### 模板编辑局限性
- 编辑模式假设模板必须包含表格
- 编辑功能（如占位符插入）假设特定的文档结构
- 无法编辑纯段落结构的模板

#### 表单预览局限性
- 表单预览假设所有交互都在表格单元格中
- 无法处理表格外的表单字段
- 表单字段的布局完全由模板类型决定

#### 表单编辑局限性
- 表单编辑功能（添加/删除行、段落复制）完全由模板类型决定
- 无法自定义表单交互方式
- 表单数据存储结构假设单元格必须有稳定的 `cellId`

#### 代码位置
- `frontend/components/document-generation/document-preview-form.tsx` (表单预览)
- `frontend/components/template-editor/document-editor.tsx` (模板编辑)
- `frontend/components/document-generation/narrative-table-cell.tsx` (表单编辑)

### 6. 导出功能的局限性

#### 假设内容
- 要素式模板：导出时保留占位符组件和选项状态
- 陈述式模板：导出时将占位符转换为纯文本
- 混合式模板：直接替换占位符，保留表格结构

#### 影响范围
- 导出逻辑完全由模板类型决定
- 无法自定义导出行为
- 无法处理不符合假设的模板结构

#### 代码位置
- `app/template_editor/mappers.py:798-842` (ProseMirrorToDocxMapper)
- `app/document_generation/services.py:257-866` (占位符替换逻辑)

### 7. 数据结构的假设

#### CellId 生成假设
系统假设单元格必须有稳定的 `cellId`，格式为：`table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}`

#### 影响范围
- 无法处理动态表格结构
- 无法处理表格结构变化后的数据迁移
- 表单数据存储依赖稳定的单元格标识

#### 代码位置
- `frontend/components/document-generation/cell-id-utils.ts:46-94`
- `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx:62-312`

## 无法处理的场景

基于以上假设，系统无法处理以下场景：

1. **纯段落模板**：没有表格的模板，只有段落和占位符
2. **自定义模板类型**：不属于要素式/陈述式/混合式的模板
3. **表格外的占位符**：占位符不在表格单元格中
4. **非标准单元格结构**：单元格内容不符合假设的结构
5. **动态表格结构**：表格结构在运行时可能变化的模板
6. **自定义交互方式**：不符合要素式/陈述式交互模式的模板

## 未来改进方向

1. **解耦模板类型和渲染逻辑**：使用配置驱动的方式，而不是硬编码的类型判断
2. **支持灵活的单元格渲染**：允许自定义单元格渲染器，而不是基于类型硬编码
3. **支持非表格结构**：扩展系统以支持纯段落、列表等非表格结构
4. **可配置的交互模式**：允许为不同类型的单元格配置不同的交互方式
5. **更灵活的占位符组织**：支持占位符在任意节点类型中，而不仅仅是表格单元格

## Risks / Trade-offs

- **当前假设的合理性**：这些假设可能是为了满足特定业务需求而设计的，需要评估是否真的需要改变
- **向后兼容性**：任何架构改进都需要考虑对现有模板的兼容性
- **性能影响**：更灵活的架构可能会带来性能开销

## Open Questions

- 这些假设是否真的限制了业务需求？
- 是否有实际的模板需求无法被当前系统支持？
- 架构改进的优先级是什么？

