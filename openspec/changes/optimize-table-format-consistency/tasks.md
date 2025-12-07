# Implementation Tasks

## 1. 优化表格宽度处理

- [x] 1.1 在 `extensions.ts` 中优化 `buildTableStyle` 函数
  - 支持保留表格原始宽度（如果存在）
  - 添加水平滚动支持
  - 确保表格在容器中正确对齐
  - _Requirements: 1.1_

- [x] 1.2 在 `templateBaseStyles` 中更新表格样式
  - 允许表格超出容器宽度时使用水平滚动
  - 保持 A4 纸张的视觉效果
  - 优化表格在容器中的显示方式
  - _Requirements: 1.1_

- [x] 1.3 在 `document-editor.tsx` 中优化容器布局
  - 在 `.template-doc-container` 上添加 `overflow-x: auto`
  - 确保表格可以水平滚动
  - _Requirements: 1.1_

## 2. 改进列宽信息提取和保留

- [x] 2.1 在 `document-editor.tsx` 的 `transformPastedHTML` 中添加列宽提取逻辑
  - 检测粘贴内容中的 `<col>` 或 `<colgroup>` 元素
  - 提取每列的宽度值（支持 px、pt、% 等单位）
  - 将宽度转换为 twips（Tiptap 使用的单位）
  - _Requirements: 2.1_

- [x] 2.2 在 `TableWithAttrs` 扩展中优化列宽处理
  - 确保 `colWidths` 属性正确保存和应用
  - 在渲染时使用 `colgroup` 和 `col` 元素应用列宽
  - 支持 `table-layout: fixed` 模式
  - _Requirements: 2.1_

- [ ] 2.3 测试列宽保留功能
  - 从 WPS 复制包含列宽信息的表格
  - 验证列宽是否正确保留
  - 验证表格格式是否与源文档一致
  - _Requirements: 2.1_

## 3. 统一字体处理

- [x] 3.1 在 `transformPastedHTML` 中添加字体统一逻辑
  - 检测表格单元格中的字体大小
  - 如果字体大小差异较大（超过 2pt），统一为默认字体大小（14px）
  - 保留字体样式（如加粗、斜体等），但统一字体大小
  - _Requirements: 3.1_

- [x] 3.2 在 `templateBaseStyles` 中统一表格字体样式
  - 确保表格单元格使用一致的字体族和字体大小
  - 优化字体渲染，避免因字体导致的布局问题
  - _Requirements: 3.1_

- [ ] 3.3 测试字体统一功能
  - 从 WPS 复制包含不同字体大小的表格
  - 验证字体是否统一
  - 验证表格格式是否稳定
  - _Requirements: 3.1_

## 4. 测试和验证

- [ ] 4.1 测试从 WPS 复制粘贴表格
  - 测试不同宽度的表格（窄表格、宽表格、超宽表格）
  - 验证表格格式是否与源文档一致
  - 验证水平滚动是否正常工作
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 4.2 测试列宽保留
  - 测试包含列宽信息的表格
  - 验证列宽比例是否正确
  - 验证表格布局是否稳定
  - _Requirements: 2.1_

- [ ] 4.3 测试字体统一
  - 测试包含不同字体大小的表格
  - 验证字体是否统一
  - 验证表格格式是否稳定
  - _Requirements: 3.1_

- [ ] 4.4 端到端测试
  - 测试完整的粘贴流程
  - 测试编辑和保存流程
  - 测试导出 PDF 流程
  - 验证所有功能正常工作
  - _Requirements: 1.1, 2.1, 3.1_

