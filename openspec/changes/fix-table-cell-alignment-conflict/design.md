# Design: 修复表格单元格对齐方式冲突问题

## Context

从 WPS 复制粘贴表格内容时，单元格对齐方式出现冲突：
- 单元格本身可能有 `text-align: left` 的内联样式
- 单元格内的段落可能有 `text-align: center` 的样式
- 导致编辑器中同时出现"左对齐"+"居中对齐"的冲突

## Goals / Non-Goals

### Goals
- 确保单元格的对齐方式由单元格本身控制，而不是段落
- 在粘贴时正确解析和应用单元格的对齐方式
- 避免单元格和段落同时存在对齐方式导致的冲突
- 确保对齐方式互斥，不会出现多种对齐方式同时存在的情况

### Non-Goals
- 不改变对齐按钮的互斥行为（这是正确的）
- 不改变非表格内容的对齐方式处理逻辑

## Decisions

### Decision 1: 在 TableCellWithAttrs 中添加对齐方式解析
**What**: 在 `TableCellWithAttrs` 的 `addAttributes` 中添加 `textAlign` 属性的解析逻辑，从粘贴的 HTML 中正确提取单元格的对齐方式。

**Why**: 当前 `TableCellWithAttrs` 没有定义 `textAlign` 属性，依赖 TextAlign 扩展来处理对齐。但 TextAlign 扩展在解析时可能不够准确，导致对齐方式冲突。

**Alternatives considered**:
- 依赖 TextAlign 扩展：但 TextAlign 扩展可能同时给单元格和段落都设置对齐方式，导致冲突
- 在粘贴时处理：但需要在多个地方处理，不够统一

### Decision 2: 在粘贴时清理单元格内段落的对齐样式
**What**: 在 `transformPastedHTML` 中，清理单元格内段落的对齐样式，确保单元格的对齐方式由单元格本身控制。

**Why**: 从 WPS 粘贴时，单元格内的段落可能有对齐样式，这会导致冲突。虽然 `ParagraphWithAttrs` 已经有一个修复：如果段落在表格单元格内，不解析段落的对齐方式，但这可能不够彻底，因为粘贴的 HTML 中可能已经存在对齐样式。

**Alternatives considered**:
- 只在 ParagraphWithAttrs 中处理：但粘贴的 HTML 中可能已经存在对齐样式，需要在粘贴时清理
- 在渲染时处理：但这样会导致样式冲突，影响性能

### Decision 3: 确保 TextAlign 扩展正确应用到单元格
**What**: 确保 TextAlign 扩展在应用到单元格时，不会与段落对齐冲突。在 `TableCellWithAttrs` 的 `renderHTML` 中，确保单元格的对齐方式正确应用。

**Why**: TextAlign 扩展通过内联样式应用对齐方式，需要确保单元格的对齐方式正确应用，不会出现多种对齐方式同时存在的情况。

**Alternatives considered**:
- 不使用 TextAlign 扩展：但这样会失去对齐按钮的功能
- 在 CSS 中处理：但这样会导致样式冲突，不够灵活

## Risks / Trade-offs

### Risks
- **风险 1**: 修改对齐方式解析逻辑可能影响现有文档的对齐方式
  - **缓解措施**: 在修改时确保向后兼容，只影响新粘贴的内容

- **风险 2**: 清理单元格内段落的对齐样式可能影响某些特殊场景
  - **缓解措施**: 只在单元格内清理，不影响非表格内容的对齐方式

### Trade-offs
- **性能**: 在粘贴时清理样式会增加一些处理时间，但影响很小
- **兼容性**: 修改对齐方式解析逻辑可能影响现有文档，但这是必要的修复

## Migration Plan

1. **阶段 1**: 修改 `TableCellWithAttrs` 添加对齐方式解析逻辑
2. **阶段 2**: 在粘贴处理中清理单元格内段落的对齐样式
3. **阶段 3**: 测试验证，确保对齐方式正确应用，不会出现冲突
4. **阶段 4**: 部署到生产环境

## Open Questions

- 是否需要处理其他 Office 软件（如 Microsoft Word）的粘贴场景？
  - **答案**: 当前主要针对 WPS，但修复应该对其他 Office 软件也有效

