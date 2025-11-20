# Implementation Plan

- [ ] 1. 引入统一的侧栏卡片宽度变量
  - 在 `frontend/app/globals.css`（或等效全局样式）中添加 `--editor-sidebar-card-width` 并提供响应式 fallback
  - _Requirements: 1.1, 2.1, 3.2_

- [ ] 2. 让模板列表卡片使用固定宽度
- [ ] 2.1 限制模板列表容器宽度
  - 将模板列表 `CardContent` 内部包裹设置为 `flex flex-col items-center`，卡片宽度使用 `var(--editor-sidebar-card-width)`
  - _Requirements: 1.1, 3.1_
- [ ] 2.2 重构 `TemplateListItem` 分栏布局
  - 用 CSS Grid 或 `basis-0 grow` 代替 `flex-[0_0_70%]`/`30%`，确保左 70% 文本可截断，右 30% 保持按钮区
  - 确保按钮和状态徽章在长文本情况下不会被压缩隐藏
  - _Requirements: 1.2, 2.1, 3.1, 3.2_

- [ ] 3. 与编辑模式占位符卡片保持一致
- [ ] 3.1 在 `PlaceholderList` 卡片上应用同一宽度变量
  - 调整占位符卡片根节点宽度，使预览/编辑两模式侧栏视觉一致
  - _Requirements: 1.1, 2.1_

- [ ] 4. 验证视觉与交互
  - 在 `/document-templates` 页面手动测试长名称、窗口缩放、模式切换，确认按钮稳定展示
  - _Requirements: 1.2, 2.2, 3.1_

