## 1. 实现 TableCellWithAttrs 对齐方式解析

- [x] 1.1 在 `TableCellWithAttrs` 的 `addAttributes` 中添加 `textAlign` 属性
  - 定义 `textAlign` 属性的 `parseHTML` 方法，从粘贴的 HTML 中提取单元格的对齐方式
  - 支持从 `element.style.textAlign` 和 `element.getAttribute("align")` 中提取对齐方式
  - 确保只解析单元格本身的对齐方式，不解析单元格内段落的对齐方式
  - _Requirements: 1.1_

- [x] 1.2 在 `TableCellWithAttrs` 的 `renderHTML` 中应用对齐方式
  - 在 `buildCellStyle` 中添加对齐方式的处理逻辑
  - 确保单元格的对齐方式通过内联样式正确应用
  - 确保不会与段落对齐方式冲突
  - _Requirements: 1.1_

## 2. 优化粘贴处理逻辑

- [x] 2.1 在 `transformPastedHTML` 中清理单元格内段落的对齐样式
  - 遍历所有表格单元格内的段落元素
  - 清理段落元素的 `text-align` 样式，确保单元格的对齐方式由单元格本身控制
  - 确保不影响非表格内容的对齐方式
  - _Requirements: 1.2_

- [x] 2.2 优化单元格对齐方式的提取逻辑
  - 在粘贴处理时，确保单元格的对齐方式正确提取
  - 如果单元格本身没有对齐样式，但单元格内的段落有对齐样式，将段落的对齐样式提升到单元格
  - 清理单元格内段落的对齐样式，避免冲突
  - _Requirements: 1.2_

## 3. 测试验证

- [ ] 3.1 编写单元测试验证对齐方式解析
  - 测试从 WPS 粘贴的表格单元格对齐方式正确解析
  - 测试单元格和段落不会同时存在对齐方式
  - 测试对齐方式互斥，不会出现多种对齐方式同时存在的情况
  - _Requirements: 1.1, 1.2_

- [ ] 3.2 编写集成测试验证粘贴场景
  - 测试从 WPS 复制粘贴表格内容，对齐方式正确应用
  - 测试单元格对齐方式不会与段落对齐方式冲突
  - 测试对齐按钮的互斥行为正常工作
  - _Requirements: 1.1, 1.2_

## 4. 文档更新

- [x] 4.1 更新代码注释说明对齐方式处理逻辑
  - 在 `TableCellWithAttrs` 中添加注释说明对齐方式的解析和应用逻辑
  - 在粘贴处理逻辑中添加注释说明为什么需要清理单元格内段落的对齐样式
  - _Requirements: 1.1, 1.2_

