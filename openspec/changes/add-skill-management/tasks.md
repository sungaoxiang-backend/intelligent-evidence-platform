## 1. Proposal
- [x] 1.1 定义 `skill-management` capability 的需求与场景
- [x] 1.2 明确数据与存储方案（Agent Prompt 版本、Skill 包文件树、调试绑定关系）

## 2. Backend
- [x] 2.1 添加 Skill 列表/详情/文件树/文件内容 API
- [x] 2.2 添加 Skill 文件保存 API（支持新增/重命名/删除/更新）
- [x] 2.3 添加 Agent Prompt 版本 CRUD API
- [x] 2.4 添加 Playground 调试 API（Agent 版本 + Skills 选择）

## 3. Frontend
- [x] 3.1 添加“技能管理”入口与页面布局（Playground + Settings）
- [x] 3.2 Prompt 版本列表与编辑保存
- [x] 3.3 Skills 搜索/选择与注册到调试会话
- [x] 3.4 Skill 包文件树 + 编辑保存

## 4. Validation
- [x] 4.1 后端路由与 schema 基础单测/冒烟
- [x] 4.2 前端构建通过（`npm run build`）
