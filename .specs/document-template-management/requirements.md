# Requirements Document

## Introduction

本文档定义了文书模板管理与生成系统的功能需求。该系统旨在为企业提供一套完整的文书模板管理解决方案，支持模板的在线编辑、状态管理以及基于模板的文书快速生成功能。

系统包含两个核心模块：
1. **模板管理模块**：提供模板的创建、编辑、预览和状态管理功能
2. **文书生成模块**：基于已发布的模板，通过表单填写数据，生成最终的DOCX格式文书

## Requirements

### Requirement 1: 模板列表展示

**User Story:** 作为系统管理员，我想要在左侧边栏查看所有模板列表，以便快速浏览和管理模板

#### Acceptance Criteria

1. WHEN 用户访问模板管理页面 THEN 系统 SHALL 在左侧边栏显示所有模板的列表
2. WHEN 模板列表加载时 THEN 系统 SHALL 显示每个模板的名称和状态（草稿/已发布）
3. WHEN 用户点击列表中的模板 THEN 系统 SHALL 立即在右侧预览区域显示该模板的内容
4. WHEN 用户在搜索框输入模板名称 THEN 系统 SHALL 实时过滤显示匹配的模板
5. WHEN 搜索框为空 THEN 系统 SHALL 显示所有模板

### Requirement 2: 模板预览功能

**User Story:** 作为系统管理员，我想要预览模板内容并看到占位符高亮显示，以便了解模板的结构

#### Acceptance Criteria

1. WHEN 用户选择模板进行预览 THEN 系统 SHALL 在右侧预览区域渲染模板内容
2. WHEN 模板包含占位符字段（{{field_name}}格式）THEN 系统 SHALL 高亮显示这些占位符
3. WHEN 预览模板时 THEN 系统 SHALL 保持原始文档的格式样式（字体、段落、表格等）
4. WHEN 模板处于草稿状态 THEN 系统 SHALL 提供预览模式和编辑模式切换功能
5. WHEN 模板处于已发布状态 THEN 系统 SHALL 仅提供预览模式（只读）

### Requirement 3: 模板编辑功能

**User Story:** 作为系统管理员，我想要使用富文本编辑器编辑模板内容和插入占位符，以便创建和修改模板

#### Acceptance Criteria

1. WHEN 用户编辑草稿状态的模板 THEN 系统 SHALL 提供基于Tiptap的富文本编辑器
2. WHEN 用户在编辑器中操作 THEN 系统 SHALL 支持文本格式设置（粗体、斜体、下划线、字体大小、颜色等）
3. WHEN 用户需要插入占位符 THEN 系统 SHALL 提供占位符插入功能，格式为{{field_name}}
4. WHEN 用户插入占位符 THEN 系统 SHALL 验证占位符名称的合法性（不能包含特殊字符，只能包含字母、数字、下划线）
5. WHEN 用户插入占位符 THEN 系统 SHALL 要求用户配置占位符的元数据（字段类型、是否必填、字段标签、默认值等）
6. WHEN 用户配置占位符元数据 THEN 系统 SHALL 支持以下字段类型：文本、数字、日期、多行文本、复选框、多选框
7. WHEN 用户编辑模板内容 THEN 系统 SHALL 自动保存草稿（实时保存或定时保存）
8. WHEN 用户手动保存模板 THEN 系统 SHALL 保存模板内容和占位符元数据配置，并更新修改时间
9. WHEN 模板保存成功 THEN 系统 SHALL 显示保存成功的提示信息

### Requirement 4: 模板状态管理

**User Story:** 作为系统管理员，我想要管理模板的状态（草稿/已发布），以便控制模板的使用权限

#### Acceptance Criteria

1. WHEN 模板处于草稿状态 THEN 系统 SHALL 允许编辑，但不允许用于文书生成
2. WHEN 模板处于已发布状态 THEN 系统 SHALL 设置为只读模式，并允许用于文书生成
3. WHEN 用户将模板从草稿切换为已发布 THEN 系统 SHALL 验证模板至少包含一个占位符字段
4. WHEN 用户将模板从草稿切换为已发布 THEN 系统 SHALL 要求用户确认操作
5. WHEN 用户将模板从已发布切换为草稿 THEN 系统 SHALL 允许操作，但需要提示可能影响正在使用该模板的生成任务
6. WHEN 只有超级管理员（is_superuser）THEN 系统 SHALL 允许进行状态切换操作
7. WHEN 非超级管理员尝试切换状态 THEN 系统 SHALL 拒绝操作并提示权限不足

### Requirement 5: 模板分类和筛选

**User Story:** 作为系统用户，我想要通过分类和筛选功能快速找到需要的模板，以便提高工作效率

#### Acceptance Criteria

1. WHEN 系统支持模板分类 THEN 系统 SHALL 允许为模板设置分类标签（分类为可选属性）
2. WHEN 用户创建或编辑模板 THEN 系统 SHALL 允许用户自行创建新的分类名称
3. WHEN 用户设置模板分类 THEN 系统 SHALL 保存分类信息，如果分类不存在则自动创建
4. WHEN 用户在文书生成页面查看模板 THEN 系统 SHALL 支持按分类筛选模板
5. WHEN 用户筛选模板时 THEN 系统 SHALL 仅显示已发布状态的模板
6. WHEN 模板没有设置分类 THEN 系统 SHALL 显示为"未分类"或允许不显示分类

### Requirement 6: 模板选择功能

**User Story:** 作为系统用户，我想要在文书生成页面选择已发布的模板，以便开始生成文书

#### Acceptance Criteria

1. WHEN 用户访问文书生成页面 THEN 系统 SHALL 仅显示已发布状态的模板
2. WHEN 用户查看模板列表 THEN 系统 SHALL 显示模板的基本信息（名称、描述、分类、创建时间）
3. WHEN 用户选择模板 THEN 系统 SHALL 提供模板预览功能
4. WHEN 用户确认选择模板 THEN 系统 SHALL 进入表单填写步骤

### Requirement 7: 动态表单生成

**User Story:** 作为系统用户，我想要根据模板中的占位符自动生成填写表单，以便输入生成文书所需的数据

#### Acceptance Criteria

1. WHEN 用户选择模板后 THEN 系统 SHALL 解析模板中的所有占位符字段（{{field_name}}格式）
2. WHEN 系统解析占位符 THEN 系统 SHALL 从模板的占位符元数据配置中读取字段类型和属性，而不是从占位符名称推断
3. WHEN 系统解析占位符 THEN 系统 SHALL 为每个唯一占位符生成对应的表单输入字段
4. WHEN 占位符元数据配置字段类型为文本 THEN 系统 SHALL 提供文本输入框
5. WHEN 占位符元数据配置字段类型为数字 THEN 系统 SHALL 提供数字输入框并验证输入格式
6. WHEN 占位符元数据配置字段类型为日期 THEN 系统 SHALL 提供日期选择器
7. WHEN 占位符元数据配置字段类型为多行文本 THEN 系统 SHALL 提供多行文本输入框
8. WHEN 占位符元数据配置字段类型为复选框 THEN 系统 SHALL 提供复选框组件
9. WHEN 占位符元数据配置字段类型为多选框 THEN 系统 SHALL 提供多选框组件，并允许配置选项列表
10. WHEN 占位符元数据配置了字段标签 THEN 系统 SHALL 使用该标签作为表单字段的显示名称
11. WHEN 占位符元数据配置了默认值 THEN 系统 SHALL 在表单中预填充该默认值
12. WHEN 占位符元数据配置了必填属性 THEN 系统 SHALL 在表单中标记该字段为必填
13. WHEN 用户填写表单时 THEN 系统 SHALL 实时验证输入数据的格式和必填项
14. WHEN 表单验证失败 THEN 系统 SHALL 显示具体的错误提示信息
15. WHEN 用户填写表单时 THEN 系统 SHALL 支持保存填写进度（草稿保存）
16. WHEN 用户返回已保存的草稿 THEN 系统 SHALL 自动填充已保存的数据

### Requirement 8: 文书生成功能

**User Story:** 作为系统用户，我想要一键生成最终的DOCX格式文书，以便下载和使用

#### Acceptance Criteria

1. WHEN 用户填写完表单并点击生成按钮 THEN 系统 SHALL 验证所有必填字段已填写
2. WHEN 表单验证通过 THEN 系统 SHALL 使用python-docx-template将模板和表单数据合并生成DOCX文档
3. WHEN 文档生成成功 THEN 系统 SHALL 将生成的文档上传到COS存储
4. WHEN 文档上传成功 THEN 系统 SHALL 返回文档下载链接
5. WHEN 用户点击下载链接 THEN 系统 SHALL 提供DOCX格式文件的下载
6. WHEN 文档生成失败 THEN 系统 SHALL 返回具体的错误信息
7. WHEN 文档生成时 THEN 系统 SHALL 记录生成记录（模板ID、生成时间、生成用户、使用的数据）
8. WHEN 在MVP阶段 THEN 系统 SHALL 支持独立生成文书，不强制关联案件（后续版本可扩展案件关联功能）

### Requirement 9: 生成记录追踪

**User Story:** 作为系统管理员，我想要查看文书生成的历史记录，以便追踪和审计

#### Acceptance Criteria

1. WHEN 系统生成文书时 THEN 系统 SHALL 记录生成记录，包括：模板ID、生成用户、生成时间、文档存储路径、使用的表单数据
2. WHEN 用户查看生成记录 THEN 系统 SHALL 显示记录的列表，支持分页
3. WHEN 用户查看生成记录 THEN 系统 SHALL 支持按模板、用户、时间范围筛选
4. WHEN 用户点击记录 THEN 系统 SHALL 显示详细的生成信息
5. WHEN 生成记录中的文档仍然存在 THEN 系统 SHALL 提供重新下载功能

### Requirement 10: 模板导入导出

**User Story:** 作为系统管理员，我想要导入和导出模板，以便备份和迁移模板

#### Acceptance Criteria

1. WHEN 用户导出模板 THEN 系统 SHALL 将模板内容导出为DOCX格式文件
2. WHEN 用户导入模板 THEN 系统 SHALL 支持从DOCX文件导入模板内容
3. WHEN 用户导入模板时 THEN 系统 SHALL 解析DOCX文件中的占位符字段
4. WHEN 导入的模板包含占位符 THEN 系统 SHALL 自动识别并提取这些占位符
5. WHEN 模板导入成功 THEN 系统 SHALL 创建新的草稿状态模板

