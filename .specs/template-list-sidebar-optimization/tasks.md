# Implementation Plan - Template List Sidebar Optimization

将功能设计转换为一系列代码生成 LLM 的提示，该 LLM 将以测试驱动的方式实施每个步骤。

- [ ] 1. 实现状态筛选逻辑和 UI
  - 引入 Select 组件
  - 添加 statusFilter 状态
  - 更新 loadTemplates 以支持筛选参数
  - 在侧边栏添加 Select 下拉菜单
  - 更新新建按钮文本
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

- [ ] 2. 优化新建模板后的状态切换
  - 在创建新模板成功后，将 statusFilter 重置为 'all' 或 'draft'
  - 确保新创建的模板在列表中立即可见
  - _Requirements: 1.1_

