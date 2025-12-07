# Change: 修复表格单元格对齐方式冲突问题

## Why

当前文书管理模块在处理从 WPS 复制粘贴的表格内容时，存在单元格对齐方式冲突的问题：

1. **对齐方式冲突**：从 WPS 复制过来的表格单元格中，原本居中对齐的内容在编辑器中变成了"左对齐"+"居中对齐"同时存在，这很诡异。

2. **用户体验问题**：编辑器上的对齐方式是互斥按钮，理论上不会出现同时应用多种对齐方式的情况，但实际粘贴后却出现了这种冲突。

3. **根本原因**：
   - 从 WPS 粘贴时，单元格本身可能有 `text-align: left` 的内联样式（WPS 的默认行为）
   - 同时，单元格内的段落可能有 `text-align: center` 的样式
   - TextAlign 扩展在解析时，可能同时给单元格和段落都设置了对齐方式
   - 虽然 `ParagraphWithAttrs` 已经有一个修复：如果段落在表格单元格内，不解析段落的对齐方式，但这可能不够彻底

4. **影响范围**：所有从 WPS 或其他 Office 软件复制粘贴表格内容的场景都会受到影响，导致用户需要手动调整对齐方式。

## What Changes

- **优化粘贴时的对齐方式处理**：
  - 在粘贴时清理单元格内的段落对齐样式，确保单元格的对齐方式由单元格本身控制
  - 在 TextAlign 扩展解析时，确保单元格的对齐方式正确解析，并且不会与段落对齐冲突
  - 确保单元格的对齐方式统一，避免同时存在多种对齐方式

- **改进单元格对齐解析逻辑**：
  - 在 `TableCellWithAttrs` 中添加对齐方式的解析逻辑，确保从粘贴的 HTML 中正确提取单元格的对齐方式
  - 在粘贴处理时，清理单元格内段落的对齐样式，避免冲突
  - 确保 TextAlign 扩展在应用到单元格时，不会与段落对齐冲突

- **统一对齐方式应用**：
  - 确保单元格的对齐方式由单元格本身控制，而不是段落
  - 在渲染时，确保单元格的对齐方式正确应用，不会出现多种对齐方式同时存在的情况

## Impact

- **Affected specs**: 
  - `document-management` - 修改表格单元格对齐方式处理相关需求
- **Affected code**: 
  - `frontend/components/template-editor/extensions.ts` - 优化 TableCellWithAttrs 的对齐方式解析逻辑
  - `frontend/components/documents/document-editor.tsx` - 优化粘贴处理逻辑，清理单元格内段落的对齐样式
  - `frontend/components/template-editor/document-editor.tsx` - 确保 TextAlign 扩展正确应用到单元格

