# Implementation Tasks

## 1. 优化 WPS 粘贴处理

- [x] 1.1 在 `document-editor.tsx` 的 `transformPastedHTML` 中添加表格单元格处理逻辑
  - 检测 `<td>` 和 `<th>` 元素
  - 移除可能导致溢出的宽度样式
  - 添加 `word-wrap` 和 `overflow-wrap` 样式
  - 确保 `box-sizing: border-box`
  - _Requirements: 1.1_

- [x] 1.2 在 `globals.css` 中添加表格单元格溢出控制样式
  - 为 `.template-doc table td` 和 `.template-doc table th` 添加 `word-wrap: break-word`
  - 添加 `overflow-wrap: break-word`
  - 确保 `box-sizing: border-box`
  - _Requirements: 1.1_

- [ ] 1.3 测试 WPS 粘贴功能
  - 从 WPS 复制包含表格的内容
  - 粘贴到编辑器
  - 验证内容不会超出单元格
  - _Requirements: 1.1_

## 2. 实现单元格插入功能

- [x] 2.1 扩展 `TableWithAttrs` 扩展，添加 `insertCellAbove` 命令
  - 检测当前光标所在的单元格位置
  - 在相同列的上方插入新单元格
  - 处理合并单元格的边界情况
  - _Requirements: 2.1_

- [x] 2.2 扩展 `TableWithAttrs` 扩展，添加 `insertCellBelow` 命令
  - 检测当前光标所在的单元格位置
  - 在相同列的下方插入新单元格
  - 处理合并单元格的边界情况
  - _Requirements: 2.2_

- [x] 2.3 在工具栏中添加单元格插入按钮（使用现有的 addRowBefore/addRowAfter 作为基础）
  - 添加"在上方插入单元格"按钮
  - 添加"在下方插入单元格"按钮
  - 根据光标位置动态启用/禁用按钮
  - _Requirements: 2.1, 2.2_

- [ ] 2.4 测试单元格插入功能
  - 测试在普通单元格上方/下方插入
  - 测试在合并单元格附近插入
  - 验证表格结构正确性
  - _Requirements: 2.1, 2.2_

## 3. 实现单元格删除功能

- [x] 3.1 扩展 `TableWithAttrs` 扩展，添加 `deleteCell` 命令（使用 deleteRow 作为基础）
  - 删除当前光标所在的单元格
  - 处理合并单元格的拆分
  - 自动清理空行/空列
  - _Requirements: 3.1_

- [x] 3.2 在工具栏中添加单元格删除按钮
  - 添加"删除单元格"按钮
  - 根据光标位置动态启用/禁用按钮
  - _Requirements: 3.1_

- [ ] 3.3 测试单元格删除功能
  - 测试删除普通单元格
  - 测试删除合并单元格的一部分
  - 验证表格结构正确性
  - _Requirements: 3.1_

## 4. 实现单元格合并功能

- [x] 4.1 扩展 `TableWithAttrs` 扩展，添加 `mergeCells` 命令（基础实现）
  - 检测选中的单元格区域（矩形区域）
  - 计算合并后的 `colspan` 和 `rowspan` 值
  - 合并选中区域的所有单元格
  - 删除被合并的其他单元格
  - _Requirements: 4.1_

- [x] 4.2 在工具栏中添加合并按钮
  - 添加"合并单元格"按钮
  - 根据选中状态动态启用/禁用按钮
  - _Requirements: 4.1_

- [ ] 4.3 测试单元格合并功能
  - 测试合并普通单元格（横向、纵向、矩形区域）
  - 测试合并包含已合并单元格的区域
  - 验证合并后的表格结构
  - _Requirements: 4.1_

## 5. 实现单元格拆分功能

- [x] 5.1 扩展 `TableWithAttrs` 扩展，添加 `splitCell` 命令（基础实现）
  - 检测当前单元格的 `colspan` 和 `rowspan` 值
  - 创建相应数量的新单元格
  - 将原单元格内容复制到第一个新单元格
  - 更新表格结构
  - _Requirements: 5.1_

- [x] 5.2 在工具栏中添加拆分按钮
  - 添加"拆分单元格"按钮
  - 仅在选中合并单元格时启用
  - _Requirements: 5.1_

- [ ] 5.3 测试单元格拆分功能
  - 测试拆分横向合并的单元格
  - 测试拆分纵向合并的单元格
  - 测试拆分同时横向和纵向合并的单元格
  - 验证拆分后的表格结构
  - _Requirements: 5.1_

## 6. 添加右键菜单

- [x] 6.1 创建表格单元格右键菜单组件
  - 创建 `TableContextMenu` 组件
  - 包含所有表格操作选项（插入、删除、合并、拆分）
  - 根据当前选择状态显示/隐藏选项
  - _Requirements: 6.1_

- [x] 6.2 在 `document-editor.tsx` 中集成右键菜单
  - 监听表格单元格的右键点击事件
  - 显示上下文菜单
  - 处理菜单项点击
  - _Requirements: 6.1_

- [ ] 6.3 测试右键菜单功能
  - 测试在不同单元格上右键点击
  - 验证菜单项的正确显示和功能
  - _Requirements: 6.1_

## 7. 确保导出功能兼容性

- [x] 7.1 验证合并单元格在导出时的处理（已确认代码正确处理 colspan 和 rowspan）
  - 检查 `ProseMirrorToDocxMapper.map_table_node` 方法
  - 确保合并单元格正确映射到 DOCX 格式
  - 测试导出包含合并单元格的文档
  - _Requirements: 7.1_

- [ ] 7.2 修复导出问题（如有）
  - 修复合并单元格导出时的任何问题
  - 确保 `colspan` 和 `rowspan` 正确转换
  - _Requirements: 7.1_

## 8. 综合测试

- [ ] 8.1 端到端测试
  - 测试完整的表格编辑流程（插入、删除、合并、拆分）
  - 测试从 WPS 粘贴表格并编辑
  - 测试导出包含复杂表格的文档
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 4.1, 5.1, 7.1_

- [ ] 8.2 边界情况测试
  - 测试在表格边界处的操作
  - 测试极端情况（如只有一行一列的表格）
  - 测试连续多次操作
  - _Requirements: 2.1, 2.2, 3.1, 4.1, 5.1_

