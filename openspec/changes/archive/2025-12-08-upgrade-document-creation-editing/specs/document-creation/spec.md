## MODIFIED Requirements

### Requirement: 模板选择功能
系统 SHALL 在文书制作页面提供模板选择功能，仅显示已发布的模板。

#### Scenario: 显示已发布模板列表
- **WHEN** 用户选择了案件后
- **THEN** 系统 SHALL 显示已发布的模板列表
- **AND** 系统 SHALL 支持模板搜索和筛选
- **AND** 系统 SHALL 显示每个模板的基本信息（名称、描述等）

#### Scenario: 选择模板
- **WHEN** 用户点击列表中的某个模板
- **THEN** 系统 SHALL 进入文档编辑模式
- **AND** 系统 SHALL 自动加载该案件+模板的草稿（如果存在）
- **AND** 系统 SHALL 如果草稿存在，显示草稿的 `content_json` 内容
- **AND** 系统 SHALL 如果草稿不存在，从模板深拷贝 `content_json` 创建新草稿

### Requirement: 文档编辑功能
系统 SHALL 在文书制作页面提供文档编辑功能，使用与文书模板编辑页面完全相同的富文本编辑组件。

#### Scenario: 进入编辑模式
- **WHEN** 用户选择了模板后
- **THEN** 系统 SHALL 显示富文本编辑器（`DocumentEditor` 组件）
- **AND** 系统 SHALL 编辑器内容为草稿的 `content_json`（如果存在）或模板的 `content_json`（如果不存在草稿）
- **AND** 系统 SHALL 提供与模板编辑页面完全相同的编辑功能（字体、字号、对齐、表格等）

#### Scenario: 编辑文档内容
- **WHEN** 用户在编辑器中修改文档内容
- **THEN** 系统 SHALL 实时更新草稿的 `content_json`
- **AND** 系统 SHALL 检测内容是否有更新
- **AND** 系统 SHALL 当内容有更新时，将"保存草稿"按钮变为可点击状态
- **AND** 系统 SHALL 当内容有更新时，将"下载文书"按钮变为不可点击状态（禁用）

#### Scenario: 切换预览模式
- **WHEN** 用户在编辑模式下点击"预览"按钮
- **THEN** 系统 SHALL 切换到预览模式
- **AND** 系统 SHALL 显示 `DocumentPreview` 组件
- **AND** 系统 SHALL 显示当前草稿的 `content_json` 内容
- **AND** 系统 SHALL 提供"返回编辑"按钮

#### Scenario: 切换编辑模式
- **WHEN** 用户在预览模式下点击"返回编辑"按钮
- **THEN** 系统 SHALL 切换到编辑模式
- **AND** 系统 SHALL 显示 `DocumentEditor` 组件
- **AND** 系统 SHALL 恢复编辑器的内容

### Requirement: 草稿管理功能
系统 SHALL 提供草稿管理功能，支持手动保存和自动加载草稿。草稿存储完整的文档内容副本（`content_json`），而不是仅存储占位符填充值。

#### Scenario: 草稿初始化
- **WHEN** 用户首次选择某个案件+模板组合
- **THEN** 系统 SHALL 从模板深拷贝 `content_json` 创建新草稿
- **AND** 系统 SHALL 保存草稿到数据库（包含 `case_id`, `document_id`, `content_json`）
- **AND** 系统 SHALL 草稿的 `content_json` 是模板的完整副本

#### Scenario: 加载已存在草稿
- **WHEN** 用户选择了案件和模板，且存在该案件+模板的草稿
- **THEN** 系统 SHALL 自动加载草稿的 `content_json`
- **AND** 系统 SHALL 在编辑器中显示草稿内容
- **AND** 系统 SHALL 显示"已加载草稿"提示
- **AND** 系统 SHALL 将按钮状态设置为已保存状态（保存按钮置灰，下载按钮可点击）

#### Scenario: 检测内容更新
- **WHEN** 用户在编辑器中修改文档内容
- **THEN** 系统 SHALL 检测草稿的 `content_json` 是否与已保存的草稿不一致
- **AND** 系统 SHALL 当检测到有更新时，将"保存草稿"按钮变为可点击状态（高亮显示）
- **AND** 系统 SHALL 当检测到有更新时，将"下载文书"按钮变为不可点击状态（禁用）

#### Scenario: 手动保存草稿
- **WHEN** 用户点击"保存草稿"按钮
- **THEN** 系统 SHALL 保存案件ID、模板ID和草稿的 `content_json` 到服务器
- **AND** 系统 SHALL 显示"草稿已保存"提示
- **AND** 系统 SHALL 将"保存草稿"按钮变为不可点击状态（置灰）
- **AND** 系统 SHALL 将"下载文书"按钮变为可点击状态（启用）

#### Scenario: 按钮状态管理
- **WHEN** 草稿的 `content_json` 与已保存的草稿一致
- **THEN** 系统 SHALL 将"保存草稿"按钮保持为不可点击状态（置灰）
- **AND** 系统 SHALL 将"下载文书"按钮保持为可点击状态（启用）

#### Scenario: 创建新草稿
- **WHEN** 用户首次编辑某个案件+模板的文档
- **THEN** 系统 SHALL 创建新的草稿记录
- **AND** 系统 SHALL 保存草稿的 `content_json`

#### Scenario: 更新现有草稿
- **WHEN** 用户修改已存在的草稿
- **THEN** 系统 SHALL 更新现有草稿记录的 `content_json`
- **AND** 系统 SHALL 更新草稿的更新时间

#### Scenario: 草稿唯一性
- **WHEN** 用户为同一个案件+模板组合保存草稿
- **THEN** 系统 SHALL 确保只有一个草稿记录
- **AND** 系统 SHALL 使用 upsert 模式（存在则更新，不存在则创建）

#### Scenario: 编辑独立性
- **WHEN** 用户编辑草稿的 `content_json`
- **THEN** 系统 SHALL 确保编辑不会影响原模板的 `content_json`
- **AND** 系统 SHALL 草稿是模板的独立副本

### Requirement: 文档预览功能
系统 SHALL 在文书制作页面提供文档预览功能，显示草稿的 `content_json` 内容。

#### Scenario: 预览草稿内容
- **WHEN** 用户在预览模式下查看草稿
- **THEN** 系统 SHALL 显示草稿的 `content_json` 内容
- **AND** 系统 SHALL 使用 `DocumentPreview` 组件（与模板编辑页面一致）
- **AND** 系统 SHALL 保持文档格式（字体、段落、表格等）

#### Scenario: 预览格式一致性
- **WHEN** 用户在预览模式下查看文档
- **THEN** 系统 SHALL 确保预览内容与最终下载的文档格式一致
- **AND** 系统 SHALL 正确渲染表格格式（包括合并单元格、边框等）

### Requirement: 文档下载功能
系统 SHALL 在文书制作页面提供文档下载功能，下载草稿的完整文档。

#### Scenario: 下载文档
- **WHEN** 用户点击"下载文书"按钮（仅当按钮可点击时）
- **THEN** 系统 SHALL 基于草稿的 `content_json` 生成完整文档
- **AND** 系统 SHALL 将文档导出为 PDF 格式
- **AND** 系统 SHALL 触发文件下载
- **AND** 系统 SHALL 使用合适的文件名（例如：案件ID_模板名称_日期.pdf）

#### Scenario: 下载按钮禁用状态
- **WHEN** 草稿的 `content_json` 有未保存的更新
- **THEN** 系统 SHALL 禁用"下载文书"按钮
- **AND** 系统 SHALL 防止用户下载未保存的草稿

#### Scenario: 下载文档格式
- **WHEN** 用户下载文档
- **THEN** 系统 SHALL 确保 PDF 内容与预览内容完全一致
- **AND** 系统 SHALL 正确渲染所有文档内容
- **AND** 系统 SHALL 保持文档格式（字体、段落、表格等）

## REMOVED Requirements

### Requirement: 表单填写功能
**Reason**: 文书制作页面不再使用表单填写模式，改为使用富文本编辑器直接编辑文档内容。

**Migration**: 
- 移除表单填写相关的UI组件和逻辑
- 移除基于占位符元数据渲染表单的功能
- 用户现在可以直接在文档中编辑内容，包括占位符

## MODIFIED Requirements

### Requirement: 草稿数据管理 API
系统 SHALL 提供草稿的 CRUD 操作 API。草稿存储完整的文档内容（`content_json`），而不是仅存储占位符填充值（`form_data`）。

#### Scenario: 获取草稿 API
- **WHEN** 前端调用 `GET /api/v1/document-drafts?case_id={case_id}&document_id={document_id}` 获取草稿
- **THEN** 系统 SHALL 验证参数
- **AND** 系统 SHALL 查询指定案件+模板组合的草稿
- **AND** 系统 SHALL 返回草稿数据（包含 `content_json` 字段，如果存在）
- **AND** 系统 SHALL 返回404状态码（如果不存在）

#### Scenario: 创建或更新草稿 API
- **WHEN** 前端调用 `POST /api/v1/document-drafts` 创建或更新草稿
- **THEN** 系统 SHALL 验证请求数据（case_id, document_id, content_json）
- **AND** 系统 SHALL 检查是否存在该案件+模板组合的草稿
- **AND** 系统 SHALL 如果存在则更新，如果不存在则创建
- **AND** 系统 SHALL 保存草稿的 `content_json`
- **AND** 系统 SHALL 如果未提供 `content_json`，从模板深拷贝 `content_json` 创建新草稿
- **AND** 系统 SHALL 返回草稿信息（包含 `content_json`）

#### Scenario: 删除草稿 API
- **WHEN** 前端调用 `DELETE /api/v1/document-drafts/{draft_id}` 删除草稿
- **THEN** 系统 SHALL 从数据库中删除指定草稿
- **AND** 系统 SHALL 返回成功响应

#### Scenario: 获取案件的所有草稿 API
- **WHEN** 前端调用 `GET /api/v1/document-drafts/case/{case_id}` 获取案件的所有草稿
- **THEN** 系统 SHALL 查询指定案件的所有草稿
- **AND** 系统 SHALL 返回草稿列表（包含模板信息和 `content_json` 字段）

