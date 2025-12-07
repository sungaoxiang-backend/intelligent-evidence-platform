## ADDED Requirements

### Requirement: 文书制作页面导航
系统 SHALL 在顶部导航栏提供"文书制作"入口，点击后进入文书制作页面。

#### Scenario: 访问文书制作页面
- **WHEN** 用户点击顶部导航栏的"文书制作"按钮
- **THEN** 系统 SHALL 导航到 `/document-creation` 路由
- **AND** 系统 SHALL 显示文书制作页面

### Requirement: 案件选择功能
系统 SHALL 在文书制作页面提供案件选择功能，用户必须选择一个案件才能进行文书制作。

#### Scenario: 选择案件
- **WHEN** 用户进入文书制作页面
- **THEN** 系统 SHALL 显示案件选择界面
- **AND** 系统 SHALL 提供案件搜索功能
- **AND** 系统 SHALL 显示案件列表（案件ID、当事人信息等）
- **AND** 系统 SHALL 允许用户选择一个案件

#### Scenario: 案件选择后进入模板选择
- **WHEN** 用户选择了一个案件
- **THEN** 系统 SHALL 进入模板选择步骤
- **AND** 系统 SHALL 显示已发布的模板列表

### Requirement: 模板选择功能
系统 SHALL 在文书制作页面提供模板选择功能，仅显示已发布的模板。

#### Scenario: 显示已发布模板列表
- **WHEN** 用户选择了案件后
- **THEN** 系统 SHALL 显示已发布的模板列表
- **AND** 系统 SHALL 支持模板搜索和筛选
- **AND** 系统 SHALL 显示每个模板的基本信息（名称、描述等）

#### Scenario: 选择模板
- **WHEN** 用户点击列表中的某个模板
- **THEN** 系统 SHALL 进入表单填写步骤
- **AND** 系统 SHALL 基于模板的占位符元数据渲染表单
- **AND** 系统 SHALL 自动加载该案件+模板的草稿（如果存在）

### Requirement: 表单填写功能
系统 SHALL 在文书制作页面提供表单填写功能，基于模板的占位符元数据动态渲染表单字段。

#### Scenario: 渲染表单
- **WHEN** 用户选择了模板后
- **THEN** 系统 SHALL 基于模板的 `placeholder_metadata` 渲染表单
- **AND** 系统 SHALL 支持文本输入字段（type: "text"）
- **AND** 系统 SHALL 支持单选字段（type: "radio"）
- **AND** 系统 SHALL 支持复选框字段（type: "checkbox"）
- **AND** 系统 SHALL 显示字段标签和提示信息

#### Scenario: 填写表单
- **WHEN** 用户在表单中输入数据
- **THEN** 系统 SHALL 实时更新表单数据
- **AND** 系统 SHALL 在右侧显示实时预览
- **AND** 系统 SHALL 检测表单数据是否有更新
- **AND** 系统 SHALL 当表单数据有更新时，将"保存草稿"按钮变为可点击状态
- **AND** 系统 SHALL 当表单数据有更新时，将"下载文书"按钮变为不可点击状态（禁用）

#### Scenario: 加载草稿
- **WHEN** 用户选择了案件和模板，且存在该案件+模板的草稿
- **THEN** 系统 SHALL 自动加载草稿数据
- **AND** 系统 SHALL 填充表单字段
- **AND** 系统 SHALL 显示"已加载草稿"提示
- **AND** 系统 SHALL 将按钮状态设置为已保存状态（保存按钮置灰，下载按钮可点击）

### Requirement: 草稿管理功能
系统 SHALL 提供草稿管理功能，支持手动保存和自动加载草稿。

#### Scenario: 检测表单更新
- **WHEN** 用户在表单中输入或修改数据
- **THEN** 系统 SHALL 检测表单数据是否与已保存的草稿不一致
- **AND** 系统 SHALL 当检测到有更新时，将"保存草稿"按钮变为可点击状态（高亮显示）
- **AND** 系统 SHALL 当检测到有更新时，将"下载文书"按钮变为不可点击状态（禁用）

#### Scenario: 手动保存草稿
- **WHEN** 用户点击"保存草稿"按钮
- **THEN** 系统 SHALL 保存案件ID、模板ID和表单数据到服务器
- **AND** 系统 SHALL 显示"草稿已保存"提示
- **AND** 系统 SHALL 将"保存草稿"按钮变为不可点击状态（置灰）
- **AND** 系统 SHALL 将"下载文书"按钮变为可点击状态（启用）

#### Scenario: 按钮状态管理
- **WHEN** 表单数据与已保存的草稿一致
- **THEN** 系统 SHALL 将"保存草稿"按钮保持为不可点击状态（置灰）
- **AND** 系统 SHALL 将"下载文书"按钮保持为可点击状态（启用）

#### Scenario: 创建新草稿
- **WHEN** 用户首次填写某个案件+模板的表单
- **THEN** 系统 SHALL 创建新的草稿记录
- **AND** 系统 SHALL 保存表单数据

#### Scenario: 更新现有草稿
- **WHEN** 用户修改已存在的草稿
- **THEN** 系统 SHALL 更新现有草稿记录
- **AND** 系统 SHALL 更新表单数据和更新时间

#### Scenario: 草稿唯一性
- **WHEN** 用户为同一个案件+模板组合保存草稿
- **THEN** 系统 SHALL 确保只有一个草稿记录
- **AND** 系统 SHALL 使用 upsert 模式（存在则更新，不存在则创建）

### Requirement: 文档预览功能
系统 SHALL 在文书制作页面提供文档预览功能，显示填充表单数据后的文档内容。

#### Scenario: 实时预览
- **WHEN** 用户在表单中输入数据
- **THEN** 系统 SHALL 在右侧预览区域实时显示填充后的文档
- **AND** 系统 SHALL 将占位符替换为表单数据
- **AND** 系统 SHALL 保持文档格式（字体、段落、表格等）

#### Scenario: 预览格式一致性
- **WHEN** 用户在预览模式下查看文档
- **THEN** 系统 SHALL 确保预览内容与最终下载的文档格式一致
- **AND** 系统 SHALL 正确渲染表格格式（包括合并单元格、边框等）

### Requirement: 文档下载功能
系统 SHALL 在文书制作页面提供文档下载功能，下载填充表单数据后的完整文档。

#### Scenario: 下载文档
- **WHEN** 用户点击"下载文书"按钮（仅当按钮可点击时）
- **THEN** 系统 SHALL 生成填充表单数据后的完整文档
- **AND** 系统 SHALL 将文档导出为 PDF 格式
- **AND** 系统 SHALL 触发文件下载
- **AND** 系统 SHALL 使用合适的文件名（例如：案件ID_模板名称_日期.pdf）

#### Scenario: 下载按钮禁用状态
- **WHEN** 表单数据有未保存的更新
- **THEN** 系统 SHALL 禁用"下载文书"按钮
- **AND** 系统 SHALL 防止用户下载未保存的草稿

#### Scenario: 下载文档格式
- **WHEN** 用户下载文档
- **THEN** 系统 SHALL 确保 PDF 内容与预览内容完全一致
- **AND** 系统 SHALL 正确渲染所有表单数据
- **AND** 系统 SHALL 保持文档格式（字体、段落、表格等）

### Requirement: 草稿数据管理 API
系统 SHALL 提供草稿的 CRUD 操作 API。

#### Scenario: 获取草稿 API
- **WHEN** 前端调用 `GET /api/v1/document-drafts?case_id={case_id}&document_id={document_id}` 获取草稿
- **THEN** 系统 SHALL 验证参数
- **AND** 系统 SHALL 查询指定案件+模板组合的草稿
- **AND** 系统 SHALL 返回草稿数据（如果存在）
- **AND** 系统 SHALL 返回404状态码（如果不存在）

#### Scenario: 创建或更新草稿 API
- **WHEN** 前端调用 `POST /api/v1/document-drafts` 创建或更新草稿
- **THEN** 系统 SHALL 验证请求数据（case_id, document_id, form_data）
- **AND** 系统 SHALL 检查是否存在该案件+模板组合的草稿
- **AND** 系统 SHALL 如果存在则更新，如果不存在则创建
- **AND** 系统 SHALL 保存表单数据
- **AND** 系统 SHALL 返回草稿信息

#### Scenario: 删除草稿 API
- **WHEN** 前端调用 `DELETE /api/v1/document-drafts/{draft_id}` 删除草稿
- **THEN** 系统 SHALL 从数据库中删除指定草稿
- **AND** 系统 SHALL 返回成功响应

#### Scenario: 获取案件的所有草稿 API
- **WHEN** 前端调用 `GET /api/v1/document-drafts/case/{case_id}` 获取案件的所有草稿
- **THEN** 系统 SHALL 查询指定案件的所有草稿
- **AND** 系统 SHALL 返回草稿列表（包含模板信息）

### Requirement: 文书制作相关 API
系统 SHALL 提供文书制作相关的 API。

#### Scenario: 获取已发布模板列表 API
- **WHEN** 前端调用 `GET /api/v1/documents/published` 获取已发布模板列表
- **THEN** 系统 SHALL 仅返回状态为"published"的模板
- **AND** 系统 SHALL 支持分页参数（skip, limit）
- **AND** 系统 SHALL 支持搜索参数（search）
- **AND** 系统 SHALL 返回模板列表和总数

#### Scenario: 生成填充后的文档 API
- **WHEN** 前端调用 `POST /api/v1/document-creation/generate` 生成文档
- **THEN** 系统 SHALL 验证请求数据（case_id, document_id, form_data）
- **AND** 系统 SHALL 获取模板内容
- **AND** 系统 SHALL 将表单数据填充到模板占位符中
- **AND** 系统 SHALL 生成填充后的文档内容（ProseMirror JSON格式）
- **AND** 系统 SHALL 返回填充后的文档内容

#### Scenario: 导出填充后的文档为 PDF API
- **WHEN** 前端调用 `POST /api/v1/document-creation/export` 导出文档
- **THEN** 系统 SHALL 接收填充后的 HTML 内容
- **AND** 系统 SHALL 使用 Playwright 在无头浏览器中渲染 HTML
- **AND** 系统 SHALL 生成 PDF 文件
- **AND** 系统 SHALL 返回 PDF 文件流供前端下载
- **AND** 系统 SHALL 确保 PDF 内容与预览 HTML 格式一致

