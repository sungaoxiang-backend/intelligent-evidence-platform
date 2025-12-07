## MODIFIED Requirements

### Requirement: 文书管理页面导航
系统 SHALL 在顶部导航栏提供"文书管理"入口，点击后进入文书管理页面。该页面仅用于管理文书模板（创建、编辑、预览、发布），不包含表单填写功能。

#### Scenario: 访问文书管理页面
- **WHEN** 用户点击顶部导航栏的"文书管理"按钮
- **THEN** 系统 SHALL 导航到 `/documents` 路由
- **AND** 系统 SHALL 显示文书管理页面
- **AND** 系统 SHALL 仅显示模板管理功能（创建、编辑、预览、发布）

### Requirement: 文书列表检索和展示
系统 SHALL 提供文书列表检索和展示功能，支持搜索和筛选。该列表仅显示文书模板，不包含表单填写功能。

#### Scenario: 显示文书列表
- **WHEN** 用户进入文书管理页面
- **THEN** 系统 SHALL 显示文书列表
- **AND** 系统 SHALL 显示每个文书的基本信息（名称、描述、创建时间等）
- **AND** 系统 SHALL 不显示"进入表单模式"按钮

#### Scenario: 搜索文书
- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统 SHALL 实时过滤显示匹配的文书
- **AND** 系统 SHALL 支持按文书名称和描述搜索

#### Scenario: 筛选文书
- **WHEN** 用户选择分类筛选条件
- **THEN** 系统 SHALL 仅显示匹配分类的文书

### Requirement: 文书预览功能
系统 SHALL 提供文书预览功能，显示文书的完整内容。预览模式仅用于查看模板内容，不包含表单填写功能。

#### Scenario: 预览文书
- **WHEN** 用户点击列表中的某个文书
- **THEN** 系统 SHALL 在预览区域显示该文书的完整内容
- **AND** 系统 SHALL 保持原始文档的格式样式（字体、段落、表格等）
- **AND** 系统 SHALL 提供"编辑"按钮（仅当状态为草稿时）
- **AND** 系统 SHALL 提供"发布"按钮（仅当状态为草稿时）
- **AND** 系统 SHALL 不显示"进入表单模式"按钮

#### Scenario: 预览格式一致性
- **WHEN** 用户在预览模式下查看文书
- **THEN** 系统 SHALL 确保预览内容与编辑内容格式一致
- **AND** 系统 SHALL 正确渲染表格格式（包括合并单元格、边框等）

### Requirement: 新增文书功能
系统 SHALL 提供新增文书功能，支持使用富文本编辑器创建新文书模板。

#### Scenario: 进入新增文书模式
- **WHEN** 用户点击"新增文书"按钮
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 提供空白的编辑区域

#### Scenario: 创建新文书
- **WHEN** 用户在编辑器中输入内容并点击"保存"
- **THEN** 系统 SHALL 保存文书内容
- **AND** 系统 SHALL 返回预览模式显示新创建的文书
- **AND** 系统 SHALL 在列表中显示新创建的文书
- **AND** 系统 SHALL 设置状态为"草稿"

#### Scenario: 取消创建文书
- **WHEN** 用户在新增文书模式下点击"取消"
- **THEN** 系统 SHALL 返回文书列表
- **AND** 系统 SHALL 不保存任何内容

### Requirement: 编辑文书功能
系统 SHALL 提供编辑已存在文书的功能。仅当文书状态为"草稿"时允许编辑。

#### Scenario: 进入编辑模式
- **WHEN** 用户在预览模式下点击"编辑"按钮（仅当状态为草稿时）
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 加载当前文书的完整内容到编辑器

#### Scenario: 保存编辑
- **WHEN** 用户在编辑模式下修改内容并点击"保存"
- **THEN** 系统 SHALL 保存修改后的内容
- **AND** 系统 SHALL 返回预览模式显示更新后的文书
- **AND** 系统 SHALL 更新文书的更新时间

#### Scenario: 取消编辑
- **WHEN** 用户在编辑模式下点击"取消"
- **THEN** 系统 SHALL 返回预览模式
- **AND** 系统 SHALL 不保存任何修改
- **AND** 系统 SHALL 显示原始内容

### Requirement: 格式一致性保证
系统 SHALL 确保预览和编辑模式下内容和表格格式的统一性。

#### Scenario: 编辑后预览一致性
- **WHEN** 用户在编辑模式下修改内容并保存
- **THEN** 系统 SHALL 在预览模式下显示与编辑时相同的内容
- **AND** 系统 SHALL 保持表格格式的一致性（列宽、行高、合并单元格等）

#### Scenario: 预览后编辑一致性
- **WHEN** 用户在预览模式下查看文书后进入编辑模式
- **THEN** 系统 SHALL 在编辑模式下显示与预览时相同的内容
- **AND** 系统 SHALL 保持格式的一致性

### Requirement: 文书数据管理
系统 SHALL 提供文书的 CRUD 操作 API。这些API仅用于管理模板，不包含表单填写功能。

#### Scenario: 创建文书 API
- **WHEN** 前端调用 `POST /api/v1/documents` 创建文书
- **THEN** 系统 SHALL 验证请求数据
- **AND** 系统 SHALL 保存文书到数据库
- **AND** 系统 SHALL 返回创建的文书信息
- **AND** 系统 SHALL 设置状态为"草稿"

#### Scenario: 获取文书列表 API
- **WHEN** 前端调用 `GET /api/v1/documents` 获取文书列表
- **THEN** 系统 SHALL 支持分页参数（skip, limit）
- **AND** 系统 SHALL 支持搜索参数（search）
- **AND** 系统 SHALL 支持筛选参数（category, status）
- **AND** 系统 SHALL 返回匹配的文书列表和总数

#### Scenario: 获取文书详情 API
- **WHEN** 前端调用 `GET /api/v1/documents/{id}` 获取文书详情
- **THEN** 系统 SHALL 返回指定文书的完整信息
- **AND** 系统 SHALL 包含 ProseMirror JSON 格式的内容

#### Scenario: 更新文书 API
- **WHEN** 前端调用 `PUT /api/v1/documents/{id}` 更新文书
- **THEN** 系统 SHALL 验证请求数据
- **AND** 系统 SHALL 更新文书内容
- **AND** 系统 SHALL 更新文书的更新时间
- **AND** 系统 SHALL 返回更新后的文书信息

#### Scenario: 删除文书 API
- **WHEN** 前端调用 `DELETE /api/v1/documents/{id}` 删除文书
- **THEN** 系统 SHALL 从数据库中删除指定文书
- **AND** 系统 SHALL 返回成功响应

#### Scenario: 更新文书状态 API
- **WHEN** 前端调用 `PUT /api/v1/documents/{id}/status` 更新文书状态
- **THEN** 系统 SHALL 验证状态值（draft/published）
- **AND** 系统 SHALL 更新文书状态
- **AND** 系统 SHALL 返回更新后的文书信息

#### Scenario: 导出文书为 PDF API
- **WHEN** 前端调用 `POST /api/v1/documents/{id}/export` 导出文书
- **THEN** 系统 SHALL 接收 HTML 内容（由前端从 ProseMirror JSON 转换生成）
- **AND** 系统 SHALL 使用 Playwright 在无头浏览器中渲染 HTML
- **AND** 系统 SHALL 生成 PDF 文件
- **AND** 系统 SHALL 返回 PDF 文件流供前端下载
- **AND** 系统 SHALL 确保 PDF 内容与预览 HTML 格式一致

### Requirement: PDF 导出功能
系统 SHALL 提供将文书导出为 PDF 的功能，确保导出内容与预览内容格式一致。该功能仅用于导出模板内容，不包含表单数据填充。

#### Scenario: 导出文书为 PDF
- **WHEN** 用户在预览或编辑模式下点击"导出 PDF"按钮
- **THEN** 系统 SHALL 将当前文书内容转换为 HTML
- **AND** 系统 SHALL 将 HTML 发送到后端进行 PDF 生成
- **AND** 系统 SHALL 下载生成的 PDF 文件
- **AND** 系统 SHALL 确保 PDF 内容与预览内容完全一致

#### Scenario: PDF 格式一致性
- **WHEN** 用户导出包含表格的文书为 PDF
- **THEN** 系统 SHALL 在 PDF 中正确渲染表格格式
- **AND** 系统 SHALL 保持表格的合并单元格、边框、对齐等样式
- **AND** 系统 SHALL 确保 PDF 中的表格与预览中的表格格式一致

#### Scenario: PDF 样式渲染
- **WHEN** 用户导出包含复杂样式的文书为 PDF
- **THEN** 系统 SHALL 正确渲染文本格式（字体、大小、颜色、加粗、斜体等）
- **AND** 系统 SHALL 正确渲染段落格式（对齐、行距、缩进等）
- **AND** 系统 SHALL 正确渲染列表格式（有序列表、无序列表）
- **AND** 系统 SHALL 确保 PDF 样式与预览样式一致

## REMOVED Requirements

### Requirement: 表单填写和生成功能
**Reason**: 表单填写和生成功能已移至"文书制作"页面，文书管理页面仅负责模板管理。
**Migration**: 用户如需填写表单和生成文档，应使用"文书制作"页面。

