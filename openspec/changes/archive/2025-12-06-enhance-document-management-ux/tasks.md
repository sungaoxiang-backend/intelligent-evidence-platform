# Implementation Tasks

## 1. 优化编辑模式按钮显示

- [x] 1.1 修改 `DocumentEditor` 组件，移除编辑模式下的导出按钮显示
  - 检查 `onExport` prop 的使用，确保只在需要时显示
  - 移除编辑模式下导出按钮的渲染逻辑
  - _Requirements: 2.1_

- [x] 1.2 修改 `page.tsx`，确保预览模式下有导出按钮
  - 检查 `DocumentPreview` 组件的 `onExport` prop 传递
  - 确保预览模式下正确传递导出回调
  - _Requirements: 2.1_

## 2. 添加保存时命名功能

- [x] 2.1 在 `page.tsx` 中添加保存对话框状态管理
  - 添加 `isSaveDialogOpen` 状态
  - 添加 `documentName` 状态用于存储输入的名称
  - _Requirements: 2.2_

- [x] 2.2 创建保存命名对话框组件
  - 使用 Shadcn UI 的 `Dialog` 组件
  - 添加输入框用于输入文书名称
  - 添加"确认"和"取消"按钮
  - 如果是更新文书，自动填充现有名称
  - _Requirements: 2.2_

- [x] 2.3 修改 `handleSave` 函数，集成命名对话框
  - 保存前先打开对话框
  - 用户确认后，使用输入的名称调用 API
  - 创建新文书时传递 `name` 字段
  - 更新文书时传递 `name` 字段（如果修改了名称）
  - _Requirements: 2.2_

## 3. 增强列表操作功能

- [x] 3.1 在 `DocumentList` 组件中添加编辑和删除按钮
  - 在每个文书卡片上添加操作按钮区域
  - 使用 `Edit` 和 `Trash2` 图标（来自 lucide-react）
  - 使用 hover 效果，鼠标悬停时显示按钮
  - 防止按钮点击事件冒泡到卡片点击事件
  - _Requirements: 3.1_

- [x] 3.2 在 `DocumentListProps` 中添加 callbacks
  - 添加 `onEdit?: (document: Document) => void` callback
  - 添加 `onDelete?: (document: Document) => void` callback
  - 在按钮点击时调用对应的 callback
  - _Requirements: 3.1_

- [x] 3.3 添加删除确认对话框
  - 使用 Shadcn UI 的 `AlertDialog` 组件
  - 在 `DocumentList` 组件中实现删除确认逻辑
  - 确认后调用 `onDelete` callback
  - _Requirements: 3.2_

- [x] 3.4 在 `page.tsx` 中实现列表操作处理函数
  - 实现 `handleEditFromList` 函数：接收文书，设置选中状态，进入编辑模式
  - 实现 `handleDelete` 函数：调用 API 删除文书，刷新列表
  - 将处理函数传递给 `DocumentList` 组件
  - _Requirements: 3.1, 3.2_

## 4. 测试和验证

- [x] 4.1 测试编辑模式按钮显示
  - 验证编辑模式下只显示"保存"和"取消"按钮
  - 验证预览模式下有"导出 PDF"和"编辑"按钮
  - _Requirements: 2.1_

- [x] 4.2 测试保存命名功能
  - 验证创建新文书时可以输入名称
  - 验证更新文书时自动填充现有名称
  - 验证保存后名称正确更新
  - _Requirements: 2.2_

- [x] 4.3 测试列表操作功能
  - 验证列表中的"编辑"按钮可以进入编辑模式
  - 验证列表中的"删除"按钮可以删除文书
  - 验证删除确认对话框正常工作
  - 验证按钮点击不会触发卡片选择
  - _Requirements: 3.1, 3.2_

