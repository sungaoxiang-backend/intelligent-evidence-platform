## ADDED Requirements

### Requirement: Skill 包列表与检索
系统 SHALL 提供技能包列表，并支持按关键字检索（基于技能 ID、名称或描述）。

#### Scenario: 用户检索技能包
- **GIVEN** 系统中存在多个技能包目录
- **WHEN** 用户输入关键字进行检索
- **THEN** 列表仅展示匹配关键字的技能包

### Requirement: Skill 包以 IDE 方式编辑保存
系统 SHALL 以文件树形式展示技能包内容，并允许用户编辑文件内容后保存到后端存储。

#### Scenario: 用户编辑并保存技能脚本
- **GIVEN** 用户打开某个技能包并选中 `scripts/` 下的文件
- **WHEN** 用户修改文件内容并点击保存
- **THEN** 后端持久化更新，刷新后内容保持一致

### Requirement: Agent Prompt 版本化管理
系统 SHALL 支持为同一 Agent 管理多个 Prompt 版本，并可在调试时选择版本。

#### Scenario: 用户创建新 Prompt 版本
- **GIVEN** 用户处于技能管理页面的 Settings 区域
- **WHEN** 用户新增一个 Prompt 版本并保存
- **THEN** 版本列表出现该版本，且可被选中并用于调试

### Requirement: 调试时注册 1..N 个 Skills
系统 SHALL 允许用户在一次调试会话中为某个 Agent 版本选择 1..N 个技能包并运行调试。

#### Scenario: 用户选择多个技能进行调试
- **GIVEN** 用户已选择一个 Agent Prompt 版本
- **WHEN** 用户从 Skills 列表中选择多个技能并执行调试
- **THEN** 调试请求包含所选技能集合并返回运行结果/日志

