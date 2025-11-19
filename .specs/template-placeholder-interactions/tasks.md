# Implementation Plan

- [X] 
- [X] 1.1 创建 `PlaceholderManager` hook/state（Zustand 或 Context）

  - 定义 `PlaceholderMeta` 类型与字典/列表结构
  - 实现 `syncFromDoc(json)`, `select`, `highlight`, `openEditor` 基础方法
  - _Requirements: 1.1, 2.1, 2.2_
- [X] 1.2 集成后端 API 调用（CRUD）并处理回滚

  - 封装 `fetchPlaceholders`, `createPlaceholder`, `updatePlaceholder`, `deletePlaceholder`
  - 错误时设置状态 `error` 并恢复 UI
  - _Requirements: 1.2, 3.2, 4.2, 4.3_
- [X] 
- [X] 2.1 新建 `PlaceholderExtension` 包含 NodeView、InputRule、Decoration 逻辑

  - 在 DOM 中渲染 `<span data-placeholder-id>` 块，保持 JSON 仅含 `{{name}}`
  - hover/click 事件触发 PlaceholderManager 高亮与编辑
  - _Requirements: 2.1, 2.2, 2.3_
- [X] 2.2 在 `DocumentEditor` 注入扩展与交互桥梁

  - 将 editor selection/JSON 更新同步到 PlaceholderManager
  - 提供 `insertPlaceholder` API 给列表使用
  - _Requirements: 1.1, 2.1, 3.2, 4.1_
- [X] 
- [X] 3.1 重构 `placeholder-list.tsx` 使用 PlaceholderManager 数据

  - hover/click 联动、状态标签、未绑定提示
  - _Requirements: 1.2, 2.2_
- [X] 3.2 新增“新增占位符”流程

  - 打开 modal，提交后调用 `insertPlaceholder`
  - _Requirements: 4.1_
- [X] 3.3 支持列表中直接删除/编辑占位符

  - 触发 PlaceholderManager CRUD，确保文档同步
  - _Requirements: 3.1, 3.2, 4.2_
- [X] 
- [X] 4.1 实现 `PlaceholderModal` 表单与验证

  - 字段：label、fieldKey、description、defaultValue、dataType
  - _Requirements: 3.1_
- [X] 4.2 将 modal 与列表/文档触发联动，处理保存/失败反馈

  - _Requirements: 3.2, 3.3_
- [X] 
- [X] 5.1 确认 `onChange` JSON 输出仍为纯 `{{placeholder}}`

  - 添加单元测试覆盖 InputRule/NodeView 序列化
  - _Requirements: 2.4, 4.4_
- [X] 5.2 在 preview/export 模式禁用 Placeholder NodeView 包装

  - 确保 DocumentPreview 仅展示纯文本
  - _Requirements: 2.4_
- [ ] 
- [X] 6.1 Jest/RTL 覆盖 PlaceholderManager、列表交互、扩展序列化

  - _Requirements: 1.1, 2.1, 3.1_
- [ ] 6.2 Playwright/E2E：新增、编辑、删除占位符流程

  - 验证导出 API 调用仍含 `{{name}}`
  - _Requirements: 3.2, 4.4_
- [ ] 6.3 模拟 API 失败的回滚测试

  - mock 后端 CRUD 失败，断言占位符状态与文档内容恢复制前值
  - _Requirements: 3.2, 4.2, 4.3_
- [ ] 6.4 预览/导出回归测试

  - 切换 preview/export 模式验证输出无占位符包装 class，保持 `{{name}}`
  - _Requirements: 2.4, 4.4_
