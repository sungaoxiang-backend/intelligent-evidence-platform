# Change: add-skill-management

## Why
当前项目缺少一个统一的“技能管理”模块，来支持用户以 IDE 方式编辑/保存标准技能包，并以版本化 Prompt 调试 Agent，进而提升 Agent/Skill 的开发与联调效率。

## What Changes
- 新增“技能管理”前后端模块：提供 Playground + Settings 的调试界面（参照设计稿）。
- 新增 Skill 包管理：以“目录 + 文件”的形式展示/编辑/保存技能（支持 `scripts/`、`assets/`、`references/` 等）。
- 新增 Agent Prompt 版本管理：创建/切换/编辑/保存 Prompt 版本。
- 支持在调试会话中将 1..N 个 Skill “注册”到指定 Agent 版本进行调试。

## Impact
- Affected specs: `skill-management`（新增）
- Affected code:
  - Backend: 新增 skill-management 路由与服务；文件系统存储（或现有存储层）读写
  - Frontend: 新增 `frontend/app/skill-management/page.tsx` 及相关组件与 API client

## Out of Scope (Initial)
- 多用户并发编辑冲突解决（仅提供最后写入覆盖 + 基础提示）
- Skill 包的在线发布/市场/权限审批
- 对接远程 Git 仓库（初期仅本地存储）

