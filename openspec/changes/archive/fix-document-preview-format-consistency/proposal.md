# Change: 修复文档预览格式一致性问题

## Why

文书管理模块的编辑器存在两个关键问题：

1. **剪贴板操作错误**：在复制/剪切操作时，`clipboardTextSerializer` 中调用 `editor.getHTML()` 时 editor 可能尚未完全初始化，导致 `TypeError: Cannot read properties of undefined (reading 'getHTML')` 错误。

2. **预览格式不一致**：用户从 WPS 复制富文本到编辑器后，编辑时格式正常，但保存后回到预览页面时，预览没有正确显示格式（特别是字体大小、表格样式等），导致预览内容"一团糟"。而再次进入编辑模式和下载的文书都是正常的，说明问题仅出现在模板预览组件上。

**根本原因分析**：

问题的核心在于 **HTML ↔ Tiptap JSON Schema 的映射在不同环节没有统一**：

1. **粘贴时（HTML → JSON）**：
   - `DocumentEditor` 的 `transformPastedHTML` 做了大量预处理（字体大小、表格宽度、对齐等）
   - 扩展的 `parseHTML` 方法将处理后的 HTML 转换为 JSON
   - 字体大小通过 `FontSize` 扩展的 `parseHTML` 解析为 `textStyle` mark 的 `fontSize` 属性

2. **保存时（JSON → 数据库）**：
   - `onUpdate` 回调中 `editor.getJSON()` 获取 JSON
   - `normalizeContentUtil` 规范化（只处理空文本节点和硬换行，不影响 marks）
   - JSON 直接保存到数据库

3. **预览时（JSON → HTML）**：
   - 从数据库获取 JSON，直接传给 `DocumentPreview`
   - `setContent` 设置到编辑器
   - 扩展的 `renderHTML` 方法将 JSON 渲染为 HTML
   - **问题**：如果 JSON 中缺少 marks 或 marks 结构不正确，`renderHTML` 无法正确渲染

**关键发现**：
- `DocumentPreview` 之前缺少 `FontSize` 扩展，导致 `renderHTML` 无法渲染字体大小
- 但即使添加了 `FontSize` 扩展，如果 JSON 中 `textStyle` mark 的 `fontSize` 属性丢失，仍然无法正确渲染
- 需要确保所有环节使用相同的扩展配置和映射逻辑

## What Changes

- **修复剪贴板序列化错误**：在 `clipboardTextSerializer` 中添加 editor 空值检查，确保在 editor 未初始化时不会调用 `getHTML()`
- **统一预览和编辑的扩展配置**：确保 `DocumentPreview` 组件使用与 `DocumentEditor` 完全相同的扩展配置，包括 `FontSize` 扩展
- **统一 HTML ↔ JSON 映射逻辑**：确保所有环节（粘贴、保存、预览、导出）使用相同的扩展配置和映射逻辑
- **验证 JSON 结构完整性**：确保保存的 JSON 包含完整的 marks 信息（特别是 `textStyle` mark 的 `fontSize` 属性）
- **确保预览格式一致性**：预览组件应正确渲染所有格式（字体大小、表格样式、对齐方式等），与编辑模式和导出保持一致

## Impact

- **Affected specs**: `document-management` - 需要修改预览功能的要求，确保格式一致性
- **Affected code**:
  - `frontend/components/documents/document-editor.tsx` - 修复剪贴板序列化错误
  - `frontend/components/documents/document-preview.tsx` - 添加 FontSize 扩展，统一扩展配置
  - `frontend/components/documents/font-size-extension.ts` - 确保扩展在预览模式下也能正常工作

