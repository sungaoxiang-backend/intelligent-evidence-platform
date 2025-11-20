# Implementation Plan - Sidebar UI Unification

将功能设计转换为一系列代码生成 LLM 的提示，该 LLM 将以测试驱动的方式实施每个步骤。

- [ ] 1. 创建基础 Sidebar 组件
  - 创建 `frontend/components/common/sidebar-layout.tsx`
  - 创建 `frontend/components/common/sidebar-item.tsx`
  - 实现基础样式和布局结构
  - _Requirements: 1.1, 2.1_

- [ ] 2. 重构文书模板列表
  - 修改 `frontend/app/document-templates/page.tsx` 使用 `SidebarLayout`
  - 修改 `TemplateListItem` 使用 `SidebarItem`
  - 验证筛选和新建功能是否正常
  - _Requirements: 3.1_

- [ ] 3. 重构占位符列表
  - 修改 `frontend/components/template-editor/placeholder-list.tsx` 使用 `SidebarLayout`
  - 确保搜索框正确显示在 subheader 中
  - 重构渲染逻辑以使用 `SidebarItem`
  - 验证搜索、刷新、新建功能是否正常
  - _Requirements: 3.2_

