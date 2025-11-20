# 文书生成功能需求文档

## Introduction

文书生成功能是基于现有文书模板管理系统的扩展，旨在为用户提供一个便捷的界面，通过填写表单的方式基于已发布的模板生成实际的法律文书。该功能与模板编辑器不同，它面向最终用户，允许他们选择已发布的模板，填写占位符内容，并生成可下载的正式文书。每个案件下的每个模板都有独立的草稿状态，用户可以多次编辑和生成文书。

## Requirements

### Requirement 1: 顶层导航入口

**User Story:** 作为员工，我想在顶层导航栏看到"文书生成"入口，以便快速访问文书生成功能。

#### Acceptance Criteria

1. WHEN 员工登录系统 THEN 系统顶部导航栏 SHALL 显示"文书生成"菜单项
2. WHEN 员工点击"文书生成"菜单项 THEN 系统 SHALL 导航到文书生成页面
3. WHEN 员工在文书生成页面时 THEN 系统 SHALL 高亮显示"文书生成"菜单项

### Requirement 2: 文书生成数据模型

**User Story:** 作为系统开发者，我需要数据模型来存储文书生成的状态和内容，以便支持草稿保存和多次生成功能。

#### Acceptance Criteria

1. WHEN 创建文书生成记录 THEN 系统 SHALL 关联到特定案件和模板
2. WHEN 创建文书生成记录 THEN 系统 SHALL 存储占位符的填写数据（JSON格式）
3. IF 同一案件下的同一模板已存在文书生成记录 THEN 系统 SHALL 返回现有记录而非创建新记录
4. WHEN 文书生成记录存在 THEN 系统 SHALL 记录创建时间、更新时间和创建人信息
5. WHEN 用户更新占位符填写数据 THEN 系统 SHALL 保存为草稿状态并更新更新时间
6. WHEN 查询文书生成记录 THEN 系统 SHALL 支持按案件ID和模板ID进行过滤

### Requirement 3: 已发布模板列表展示

**User Story:** 作为员工，我想在左侧看到所有已发布的模板列表，以便选择需要使用的模板生成文书。

#### Acceptance Criteria

1. WHEN 员工进入文书生成页面 THEN 系统 SHALL 在左侧显示所有状态为"published"的模板列表
2. WHEN 显示模板列表 THEN 系统 SHALL 展示模板名称、分类和描述信息
3. WHEN 模板列表为空 THEN 系统 SHALL 显示"暂无已发布模板"的空状态提示
4. WHEN 员工选择某个模板 THEN 系统 SHALL 高亮显示该模板并在右侧加载预览区
5. WHEN 模板列表加载失败 THEN 系统 SHALL 显示错误提示信息

### Requirement 4: 案件关联和上下文

**User Story:** 作为员工，我想文书生成功能能够关联到特定案件，以便生成的文书与案件相关联。

#### Acceptance Criteria

1. WHEN 员工从案件详情页进入文书生成 THEN 系统 SHALL 自动关联到该案件
2. WHEN 员工直接访问文书生成页面 THEN 系统 SHALL 提供案件选择器
3. WHEN 案件被选中 THEN 系统 SHALL 显示案件的基本信息（案由、当事人等）
4. WHEN 案件尚未选择 THEN 系统 SHALL 禁用模板选择和表单填写功能
5. IF 员工切换案件 THEN 系统 SHALL 重新加载对应案件的文书生成草稿

### Requirement 5: 占位符表单交互

**User Story:** 作为员工，我想通过合适的表单组件填写占位符内容，以便高效准确地输入文书信息。

#### Acceptance Criteria

1. WHEN 选择模板后 THEN 系统 SHALL 根据模板中的占位符类型渲染对应的表单组件
2. WHEN 占位符类型为"text" THEN 系统 SHALL 渲染单行文本输入框
3. WHEN 占位符类型为"textarea" THEN 系统 SHALL 渲染多行文本输入框
4. WHEN 占位符类型为"select" THEN 系统 SHALL 渲染下拉选择框并显示预定义选项
5. WHEN 占位符类型为"radio" THEN 系统 SHALL 渲染单选按钮组并显示预定义选项
6. WHEN 占位符类型为"checkbox" THEN 系统 SHALL 渲染多选框组并显示预定义选项
7. WHEN 占位符类型为"date" THEN 系统 SHALL 渲染日期选择器
8. WHEN 占位符类型为"number" THEN 系统 SHALL 渲染数字输入框
9. WHEN 占位符有提示文本 THEN 系统 SHALL 在表单字段下方显示提示信息
10. WHEN 占位符有默认值 THEN 系统 SHALL 预填充该默认值
11. WHEN 占位符有label属性 THEN 系统 SHALL 显示label作为字段标签
12. WHEN 占位符无label属性 THEN 系统 SHALL 使用placeholder_name作为字段标签

### Requirement 6: 文书预览功能

**User Story:** 作为员工，我想实时预览填写内容后的文书效果，以便在生成前确认文书内容的准确性。

#### Acceptance Criteria

1. WHEN 员工选择模板 THEN 系统 SHALL 在预览区显示模板的原始结构
2. WHEN 员工填写占位符内容 THEN 系统 SHALL 实时更新预览区中对应占位符的显示
3. WHEN 占位符未填写 THEN 系统 SHALL 在预览区以占位符标记形式显示
4. WHEN 占位符已填写 THEN 系统 SHALL 在预览区显示实际填写的内容
5. WHEN 预览区内容较长 THEN 系统 SHALL 提供滚动功能
6. WHEN 预览模式激活 THEN 系统 SHALL 禁用文档编辑功能（只读模式）

### Requirement 7: 草稿自动保存

**User Story:** 作为员工，我想系统自动保存我的填写进度，以便在离开页面后能够继续之前的工作。

#### Acceptance Criteria

1. WHEN 员工填写占位符内容 THEN 系统 SHALL 在内容变更后自动保存草稿
2. WHEN 自动保存触发 THEN 系统 SHALL 采用防抖策略（延迟2秒）避免频繁请求
3. WHEN 草稿保存成功 THEN 系统 SHALL 显示"已保存"状态提示
4. WHEN 草稿保存失败 THEN 系统 SHALL 显示错误提示并支持手动重试
5. WHEN 员工重新进入同一案件的同一模板 THEN 系统 SHALL 自动加载之前保存的草稿数据
6. WHEN 草稿数据加载完成 THEN 系统 SHALL 在表单中恢复所有已填写的内容

### Requirement 8: 文书生成和导出

**User Story:** 作为员工，我想基于填写的内容生成正式的DOCX文书并下载，以便提交或打印使用。

#### Acceptance Criteria

1. WHEN 员工点击"生成文书"按钮 THEN 系统 SHALL 调用后端API生成DOCX文件
2. WHEN 占位符未填写 THEN 系统 SHALL 在生成的文书中保留占位符标记（如{{placeholder_name}}）
3. WHEN 占位符已填写 THEN 系统 SHALL 在生成的文书中替换为实际填写的内容
4. WHEN 文书生成中 THEN 系统 SHALL 显示加载状态和进度提示
5. WHEN 文书生成成功 THEN 系统 SHALL 自动触发文件下载
6. WHEN 文书生成失败 THEN 系统 SHALL 显示详细的错误信息
7. WHEN 文书生成完成 THEN 系统 SHALL 保留草稿数据以支持再次生成
8. WHEN 员工多次生成同一文书 THEN 系统 SHALL 使用最新的草稿数据生成

### Requirement 9: 表单格式验证

**User Story:** 作为员工，我想系统在我填写表单时提供基本的格式验证反馈，以便保证数据格式的正确性。

#### Acceptance Criteria

1. WHEN number类型字段输入非数字内容 THEN 系统 SHALL 显示格式错误提示
2. WHEN date类型字段输入无效日期 THEN 系统 SHALL 显示日期格式错误提示
3. WHEN 字段格式验证失败 THEN 系统 SHALL 在字段旁显示友好的错误提示
4. WHEN 员工修正格式错误 THEN 系统 SHALL 清除错误提示
5. WHEN 字段为空 THEN 系统 SHALL 允许保存和生成（不强制必填）

### Requirement 10: 后端API接口

**User Story:** 作为前端开发者，我需要后端提供完整的API接口，以便实现文书生成的各项功能。

#### Acceptance Criteria

1. WHEN 调用获取已发布模板列表API THEN 系统 SHALL 返回所有status为"published"的模板
2. WHEN 调用创建/获取文书生成记录API THEN 系统 SHALL 基于案件ID和模板ID返回或创建记录
3. WHEN 调用更新草稿数据API THEN 系统 SHALL 保存占位符填写数据并返回成功状态
4. WHEN 调用生成文书API THEN 系统 SHALL 基于模板和填写数据生成DOCX文件并返回下载URL
5. WHEN 调用获取模板详情API THEN 系统 SHALL 返回模板的完整内容和关联的占位符元数据
6. WHEN API调用失败 THEN 系统 SHALL 返回标准化的错误响应结构
7. WHEN 请求未授权 THEN 系统 SHALL 返回401状态码
8. WHEN 请求的资源不存在 THEN 系统 SHALL 返回404状态码

### Requirement 11: 身份认证

**User Story:** 作为系统管理员，我需要确保只有已登录的员工能访问文书生成功能，以便保护系统数据安全。

#### Acceptance Criteria

1. WHEN 员工访问文书生成页面 THEN 系统 SHALL 验证员工登录状态
2. WHEN 未登录用户访问 THEN 系统 SHALL 重定向到登录页面
3. WHEN 员工登录后 THEN 系统 SHALL 允许访问所有案件的文书生成功能
4. WHEN 员工会话过期 THEN 系统 SHALL 提示重新登录

### Requirement 12: 响应式布局

**User Story:** 作为员工，我想在不同设备上都能良好使用文书生成功能，以便随时随地处理文书工作。

#### Acceptance Criteria

1. WHEN 在桌面端访问 THEN 系统 SHALL 显示左右分栏布局（左侧列表，右侧表单和预览）
2. WHEN 在平板设备访问 THEN 系统 SHALL 调整布局以适应屏幕宽度
3. WHEN 在移动设备访问 THEN 系统 SHALL 采用堆叠布局（列表在上，详情在下）
4. WHEN 屏幕宽度变化 THEN 系统 SHALL 平滑过渡到对应的布局方式
5. WHEN 在小屏设备上 THEN 系统 SHALL 确保所有交互元素有足够的触摸区域

### Requirement 13: 用户体验优化

**User Story:** 作为员工，我想获得流畅的操作体验和明确的状态反馈，以便高效完成文书生成工作。

#### Acceptance Criteria

1. WHEN 页面加载时 THEN 系统 SHALL 显示骨架屏或加载动画
2. WHEN 执行耗时操作 THEN 系统 SHALL 显示加载指示器
3. WHEN 操作成功完成 THEN 系统 SHALL 显示成功提示（toast消息）
4. WHEN 操作失败 THEN 系统 SHALL 显示清晰的错误信息和可能的解决方案
5. WHEN 表单内容较多 THEN 系统 SHALL 支持分组或折叠面板来组织表单字段
6. WHEN 员工会话即将过期 THEN 系统 SHALL 提示员工重新登录

