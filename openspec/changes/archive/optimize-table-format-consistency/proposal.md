# Change: 优化表格格式一致性

## Why

当前文书管理模块在处理从 WPS 复制粘贴的表格内容时存在格式不一致问题：

1. **表格宽度被压缩**：编辑器容器宽度（A4 内容区域 602px）比 WPS 中的表格更窄，导致原本可以一行显示的内容变成多行，表格格式与源文档不一致。

2. **字体大小不统一**：从 WPS 粘贴时，字体大小可能不一致，过大的字体会导致单元格变大，进一步影响表格布局。

3. **列宽信息丢失**：粘贴时表格的列宽信息可能没有正确保留，导致列宽比例失调。

这些问题直接影响用户体验，特别是在处理复杂表格时，用户需要频繁调整格式才能达到预期效果。

## What Changes

- **优化表格宽度处理**：
  - 保留 WPS 中的表格宽度信息（如果存在）
  - 允许表格超出容器宽度时使用水平滚动
  - 智能调整表格宽度以适应容器，同时保持列宽比例

- **统一字体处理**：
  - 在粘贴时统一表格单元格的字体大小
  - 确保表格单元格使用一致的字体样式

- **改进列宽保留**：
  - 正确提取和保留 WPS 表格的列宽信息
  - 使用 `table-layout: fixed` 和 `colgroup` 来保持列宽比例

- **容器布局优化**：
  - 允许表格容器有水平滚动，保持 A4 纸张的视觉效果
  - 优化表格在容器中的显示方式

## Impact

- **Affected specs**: 
  - `document-management` - 修改表格格式处理相关需求
- **Affected code**: 
  - `frontend/components/template-editor/extensions.ts` - 优化表格样式和列宽处理
  - `frontend/components/documents/document-editor.tsx` - 优化粘贴处理逻辑
  - `frontend/components/template-editor/document-editor.tsx` - 优化编辑器容器布局

