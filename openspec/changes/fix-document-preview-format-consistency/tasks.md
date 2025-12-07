## 1. 修复剪贴板序列化错误

- [x] 1.1 在 `document-editor.tsx` 的 `clipboardTextSerializer` 中添加 editor 空值检查
  - 检查 `editor` 是否存在且已初始化
  - 如果 editor 未准备好，返回空字符串或默认值
  - 确保不会在 editor 初始化过程中调用 `getHTML()`

## 2. 统一预览和编辑的扩展配置

- [x] 2.1 在 `document-preview.tsx` 中添加 `FontSize` 扩展
  - 导入 `FontSize` 扩展（从 `./font-size-extension`）
  - 将 `FontSize` 添加到扩展列表中，位置与 `DocumentEditor` 一致（在 `TextStyle` 之后）
  - 确保扩展配置与编辑器完全一致

- [x] 2.2 验证预览组件的扩展配置完整性
  - 确保所有扩展（`StarterKit`, `HardBreak`, `ParagraphWithAttrs`, `HeadingWithAttrs`, `TableWithAttrs`, `TableRow`, `TableHeader`, `TableCellWithAttrs`, `TextAlign`, `Underline`, `TextStyle`, `Color`, `FontSize`）都已包含
  - 确保扩展的配置选项与编辑器一致（如 `TableWithAttrs` 的 `resizable: false`）

## 3. 验证 JSON 结构完整性

- [ ] 3.1 检查保存的 JSON 结构
  - 在编辑器中粘贴包含字体大小的文本
  - 检查 `onUpdate` 回调中的 JSON 结构
  - 验证 `textStyle` mark 的 `fontSize` 属性是否正确保存
  - 验证 JSON 结构是否包含所有必要的 marks

- [ ] 3.2 检查预览时的 JSON 结构
  - 从数据库加载文档后，检查 `content_json` 的结构
  - 验证 `textStyle` mark 的 `fontSize` 属性是否存在
  - 如果 JSON 结构不完整，添加调试日志定位问题

## 4. 测试格式一致性

- [ ] 4.1 测试预览格式渲染
  - 从 WPS 复制包含字体大小、表格、对齐等格式的富文本到编辑器
  - 保存后进入预览模式，验证所有格式正确显示
  - 验证字体大小、表格样式、对齐方式等与编辑模式一致
  - 检查浏览器开发者工具，验证渲染的 HTML 是否包含正确的样式

- [ ] 4.2 测试剪贴板操作
  - 在编辑模式下执行复制操作，验证不再出现 `getHTML` 错误
  - 在编辑模式下执行剪切操作，验证不再出现 `getHTML` 错误
  - 验证复制的内容格式正确

- [ ] 4.3 端到端测试
  - 创建包含各种格式的文档（字体大小、表格、对齐等）
  - 保存后验证预览格式正确
  - 再次进入编辑模式，验证格式保持
  - 导出 PDF，验证格式与预览一致

