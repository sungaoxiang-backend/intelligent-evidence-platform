## Context
“技能管理”需要同时覆盖：技能包（多文件/目录，包含脚本与资源）和 Agent Prompt（多版本）两类编辑对象，并在一个调试界面中将 Skill 注册到指定 Agent 版本进行运行/验证。

## Goals
- 提供可用的端到端工作流：列出技能 → IDE 方式编辑保存 → 管理 Agent Prompt 版本 → 选择 Agent 版本 + Skills 调试。
- 以最小侵入方式接入现有 FastAPI 与 Next.js（App Router）结构。

## Non-Goals
- 不做复杂权限模型与协作编辑
- 不做分布式存储与远程同步

## Storage (Initial)
- Skills：以 `app/agentic/skills/<skill-id>/` 目录为单元管理，读取/写入文件树与文件内容。
- Agent Prompt 版本：以数据库表（若现有 Alembic/SQLModel 习惯）或 JSON 文件持久化（以项目既有模式为准），记录：
  - `agent_id`
  - `version`
  - `lang`
  - `content`（Prompt 文本）
  - `created_at` / `updated_at`

## API Shape (Draft)
- `GET /skill-management/skills`
- `GET /skill-management/skills/{skill_id}`
- `GET /skill-management/skills/{skill_id}/tree`
- `GET /skill-management/skills/{skill_id}/file?path=...`
- `PUT /skill-management/skills/{skill_id}/file?path=...`
- `POST /skill-management/skills/{skill_id}/files:batch`（可选：rename/delete/new）
- `GET /skill-management/agents/{agent_id}/prompts`
- `POST /skill-management/agents/{agent_id}/prompts`
- `PUT /skill-management/agents/{agent_id}/prompts/{version}`
- `POST /skill-management/playground:run`

