# Document Management Specification

## Purpose

This specification defines the document management capability, including creation, editing, preview, export, and list management functionality for legal documents.
## Requirements
### Requirement: 编辑文书功能
系统 SHALL 提供编辑已存在文书的功能。

#### Scenario: 进入编辑模式
- **WHEN** 用户在预览模式下点击"编辑"按钮
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 加载当前文书的完整内容到编辑器
- **AND** 系统 SHALL 显示"保存"和"取消"按钮
- **AND** 系统 SHALL 不显示"导出 PDF"按钮
- **AND** 系统 SHALL 在工具栏中显示页面边距和行间距控制按钮
- **AND** 系统 SHALL 加载并显示当前文档的页面布局设置

#### Scenario: 保存编辑
- **WHEN** 用户在编辑模式下修改内容、调整布局并点击"保存"
- **THEN** 系统 SHALL 弹出命名对话框
- **AND** 系统 SHALL 在对话框中显示当前文书名称（如果存在）
- **AND** 系统 SHALL 允许用户输入或修改文书名称
- **AND** 系统 SHALL 在用户确认后保存修改后的内容、布局设置和名称
- **AND** 系统 SHALL 返回预览模式显示更新后的文书
- **AND** 系统 SHALL 更新文书的更新时间
- **AND** 系统 SHALL 在预览模式中应用保存的页面布局设置

### Requirement: 新增文书功能
系统 SHALL 提供新增文书功能，支持使用富文本编辑器创建新文书。

#### Scenario: 进入新增文书模式
- **WHEN** 用户点击"新增文书"按钮
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 提供空白的编辑区域
- **AND** 系统 SHALL 显示"保存"和"取消"按钮
- **AND** 系统 SHALL 不显示"导出 PDF"按钮
- **AND** 系统 SHALL 在工具栏中显示页面边距和行间距控制按钮
- **AND** 系统 SHALL 将页面布局设置为默认值（正常边距、1.5行间距）

### Requirement: 文书预览功能
系统 SHALL 提供文书预览功能，显示文书的完整内容。

#### Scenario: 预览文书
- **WHEN** 用户点击列表中的某个文书
- **THEN** 系统 SHALL 在预览区域显示该文书的完整内容
- **AND** 系统 SHALL 保持原始文档的格式样式（字体、段落、表格等）
- **AND** 系统 SHALL 应用保存的页面边距和行间距设置
- **AND** 系统 SHALL 提供"编辑"按钮
- **AND** 系统 SHALL 如果文书状态为"发布"，则提供"生成"按钮
- **AND** 系统 SHALL 如果文书状态为"草稿"，则提供"导出 PDF"按钮
- **AND** 系统 SHALL 如果文书状态为"发布"，则提供"导出 PDF"按钮（在预览模式下）

### Requirement: PDF 导出功能
系统 SHALL 提供将文书导出为 PDF 的功能，确保导出内容与预览内容格式一致。

#### Scenario: 导出文书为 PDF
- **WHEN** 用户在预览模式下点击"导出 PDF"按钮
- **THEN** 系统 SHALL 将当前文书内容转换为 HTML
- **AND** 系统 SHALL 在 HTML 中包含保存的页面边距和行间距样式
- **AND** 系统 SHALL 将 HTML 发送到后端进行 PDF 生成
- **AND** 系统 SHALL 下载生成的 PDF 文件
- **AND** 系统 SHALL 确保 PDF 内容与预览内容完全一致，包括页面布局设置

### Requirement: 文书列表快速操作
系统 SHALL 在文书列表的每个文书卡片上提供快速操作按钮。

#### Scenario: 从列表编辑文书
- **WHEN** 用户在文书列表中点击某个文书的"编辑"按钮
- **THEN** 系统 SHALL 选中该文书
- **AND** 系统 SHALL 进入编辑模式
- **AND** 系统 SHALL 加载该文书的完整内容到编辑器
- **AND** 系统 SHALL 在编辑模式下将占位符渲染为 chip 组件

#### Scenario: 从列表删除文书
- **WHEN** 用户在文书列表中点击某个文书的"删除"按钮
- **THEN** 系统 SHALL 弹出删除确认对话框
- **AND** 系统 SHALL 显示文书的名称和状态
- **AND** 系统 SHALL 提供"确认"和"取消"按钮
- **WHEN** 用户确认删除
- **THEN** 系统 SHALL 从数据库中删除该文书
- **AND** 系统 SHALL 从列表中移除该文书
- **AND** 系统 SHALL 如果该文书正在预览或编辑，则返回列表视图

#### Scenario: 列表操作按钮显示
- **WHEN** 用户将鼠标悬停在文书列表的某个文书卡片上
- **THEN** 系统 SHALL 显示"编辑"和"删除"按钮
- **AND** 系统 SHALL 显示文书状态标识（草稿/发布）
- **AND** 系统 SHALL 按钮点击不会触发卡片选择事件

### Requirement: Document Status Management
系统 SHALL 为文书模板提供状态管理功能，支持"草稿"和"发布"两种状态。

#### Scenario: 设置文书状态为草稿
- **WHEN** 用户创建新文书模板
- **THEN** 系统 SHALL 自动设置状态为"草稿"
- **AND** 系统 SHALL 允许用户编辑和修改内容

#### Scenario: 发布文书模板
- **WHEN** 用户在文书详情页面将状态从"草稿"更新为"发布"
- **THEN** 系统 SHALL 保存状态变更
- **AND** 系统 SHALL 在文书列表和详情页面显示"发布"状态标识
- **AND** 系统 SHALL 在已发布的文书预览页面显示"生成"按钮

#### Scenario: 更新文书状态
- **WHEN** 用户在文书详情页面修改状态（草稿↔发布）
- **THEN** 系统 SHALL 允许状态更新
- **AND** 系统 SHALL 保存状态变更到数据库

### Requirement: Status-Based Document Filtering
系统 SHALL 在文书列表搜索功能中提供按状态筛选的能力。

#### Scenario: 筛选草稿状态的文书
- **WHEN** 用户在文书列表的状态筛选下拉框中选择"草稿"
- **THEN** 系统 SHALL 仅显示状态为"草稿"的文书
- **AND** 系统 SHALL 更新列表总数统计

#### Scenario: 筛选已发布的文书
- **WHEN** 用户在文书列表的状态筛选下拉框中选择"已发布"
- **THEN** 系统 SHALL 仅显示状态为"发布"的文书
- **AND** 系统 SHALL 更新列表总数统计

#### Scenario: 显示全部状态的文书
- **WHEN** 用户在文书列表的状态筛选下拉框中选择"全部"（默认选项）
- **THEN** 系统 SHALL 显示所有状态的文书
- **AND** 系统 SHALL 更新列表总数统计

### Requirement: Placeholder Metadata Storage
系统 SHALL 为文书模板存储占位符的元数据信息，包括占位符名称、接收值类型和选项配置。

#### Scenario: 自动初始化占位符
- **WHEN** 用户创建或更新文书模板，内容中包含 `{{placeholder_name}}` 格式的占位符
- **THEN** 系统 SHALL 自动提取所有占位符名称
- **AND** 系统 SHALL 为每个占位符初始化元数据（仅名称，其他字段为空）
- **AND** 系统 SHALL 将占位符元数据存储到 `placeholder_metadata` 字段

#### Scenario: 占位符元数据结构
- **WHEN** 系统存储占位符元数据
- **THEN** 每个占位符 SHALL 包含以下字段：
  - `name`: 占位符名称（从 `{{name}}` 中提取）
  - `type`: 接收值类型（"text" | "radio" | "checkbox"，默认为空）
  - `options`: 选项列表（当 type 为 "radio" 或 "checkbox" 时使用，默认为空数组）

#### Scenario: 占位符元数据更新
- **WHEN** 用户更新文书模板内容
- **THEN** 系统 SHALL 重新提取占位符
- **AND** 系统 SHALL 合并新占位符与现有元数据（保留已配置的元数据）

### Requirement: Placeholder Chip Editing in Edit Mode
系统 SHALL 在编辑模式下将占位符渲染为可点击的 chip 组件，点击后弹出对话框编辑元数据。

#### Scenario: 占位符显示为 Chip
- **WHEN** 用户在编辑模式下查看包含占位符的文书内容
- **THEN** 系统 SHALL 将 `{{placeholder_name}}` 格式的占位符渲染为 chip 组件
- **AND** 系统 SHALL 显示占位符名称
- **AND** 系统 SHALL 使占位符不可直接编辑（非文本编辑模式）

#### Scenario: 打开占位符元数据编辑对话框
- **WHEN** 用户点击编辑模式中的占位符 chip
- **THEN** 系统 SHALL 弹出占位符元数据编辑对话框
- **AND** 系统 SHALL 显示当前占位符的元数据（名称、类型、选项）
- **AND** 系统 SHALL 允许用户修改类型和选项

#### Scenario: 保存占位符元数据
- **WHEN** 用户在占位符元数据编辑对话框中修改配置并点击保存
- **THEN** 系统 SHALL 更新该占位符的元数据
- **AND** 系统 SHALL 保存到数据库
- **AND** 系统 SHALL 关闭对话框
- **AND** 系统 SHALL 更新 chip 显示（如有需要）

### Requirement: Document Generation from Published Templates
系统 SHALL 为已发布的文书模板提供基于表单的文档生成功能。

#### Scenario: 进入文档生成模式
- **WHEN** 用户查看已发布状态的文书模板预览
- **THEN** 系统 SHALL 在"编辑"按钮旁边显示"生成"按钮
- **WHEN** 用户点击"生成"按钮
- **THEN** 系统 SHALL 进入表单填写模式
- **AND** 系统 SHALL 根据占位符元数据渲染对应的表单组件

#### Scenario: 表单组件渲染
- **WHEN** 系统进入表单填写模式
- **THEN** 系统 SHALL 根据占位符的 `type` 字段渲染对应的表单组件：
  - `type="text"`: 渲染文本输入框
  - `type="radio"`: 渲染单选按钮组，选项来自 `options` 字段
  - `type="checkbox"`: 渲染复选框组，选项来自 `options` 字段
- **AND** 系统 SHALL 在表单中显示占位符名称作为标签

#### Scenario: 表单填写和预览
- **WHEN** 用户在表单中填写或选择值
- **THEN** 系统 SHALL 实时更新文档预览，将占位符替换为对应的值
- **AND** 系统 SHALL 保持文档的格式和样式

### Requirement: Download Generated Document
系统 SHALL 在表单填写模式下提供"下载文书"功能，基于表单内容和源模板生成 PDF。

#### Scenario: 下载生成的文书
- **WHEN** 用户在表单填写模式下填写完表单并点击"下载文书"按钮
- **THEN** 系统 SHALL 将表单值替换到模板的所有占位符位置
- **AND** 系统 SHALL 生成包含填充内容的完整文档
- **AND** 系统 SHALL 将文档转换为 PDF 格式
- **AND** 系统 SHALL 触发 PDF 文件下载

#### Scenario: 下载按钮显示
- **WHEN** 用户在表单填写模式下
- **THEN** 系统 SHALL 在预览区域显示"下载文书"按钮（替代预览模式下的"导出 PDF"按钮）
- **AND** 系统 SHALL 按钮位置和样式与"导出 PDF"按钮一致

### Requirement: 页面边距调整功能
系统 SHALL 在文书编辑器中提供页面边距调整功能，允许用户通过下拉菜单选择预设的边距值。

#### Scenario: 显示页面边距控制按钮
- **WHEN** 用户在编辑模式下查看文书编辑器工具栏
- **THEN** 系统 SHALL 在格式工具栏中显示"页边距"按钮
- **AND** 按钮 SHALL 显示当前边距设置的图标和名称
- **AND** 点击按钮 SHALL 显示包含预设选项的下拉菜单

#### Scenario: 选择预设页面边距
- **WHEN** 用户点击"页边距"按钮并选择一个预设选项
- **THEN** 系统 SHALL 立即应用新的页面边距设置到文档
- **AND** 系统 SHALL 更新文档预览以反映新的边距
- **AND** 系统 SHALL 保存边距设置到文档模板元数据
- **AND** 预设选项 SHALL 包括：窄边距(12.7mm)、适中边距(19.05mm)、正常边距(25.4mm)、宽边距(38.1mm)

#### Scenario: 页面边距实时预览
- **WHEN** 用户选择不同的页面边距预设
- **THEN** 系统 SHALL 实时更新文档布局显示
- **AND** 系统 SHALL 重新计算分页以适应新的内容区域
- **AND** 系统 SHALL 保持文档内容的完整性

### Requirement: 行间距调整功能
系统 SHALL 在文书编辑器中提供行间距调整功能，允许用户通过下拉菜单选择预设的行间距值。

#### Scenario: 显示行间距控制按钮
- **WHEN** 用户在编辑模式下查看文书编辑器工具栏
- **THEN** 系统 SHALL 在格式工具栏中显示"行间距"按钮
- **AND** 按钮 SHALL 显示当前行间距设置的图标和数值
- **AND** 点击按钮 SHALL 显示包含预设选项的下拉菜单

#### Scenario: 选择预设行间距
- **WHEN** 用户点击"行间距"按钮并选择一个预设选项
- **THEN** 系统 SHALL 立即应用新的行间距设置到选中的文本段落
- **AND** 如果没有选中特定文本，则应用于整个文档
- **AND** 系统 SHALL 保存行间距设置到文档模板元数据
- **AND** 预设选项 SHALL 包括：1.0(单倍行距)、1.15、1.5(默认)、1.75、2.0(双倍行距)

#### Scenario: 行间距应用范围
- **WHEN** 用户选中部分文本并调整行间距
- **THEN** 系统 SHALL 只对选中的段落应用新的行间距
- **AND** 当用户没有选中任何文本时，系统 SHALL 将新的行间距应用于整个文档
- **AND** 系统 SHALL 保持其他段落格式不变

