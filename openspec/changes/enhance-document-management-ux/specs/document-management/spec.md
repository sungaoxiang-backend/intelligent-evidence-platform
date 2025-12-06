# Document Management Specification - UX Enhancements

## Purpose

This specification defines the document management capability, including creation, editing, preview, export, and list management functionality for legal documents.

## ADDED Requirements

### Requirement: 编辑文书功能
系统 SHALL 提供编辑已存在文书的功能。

#### Scenario: 进入编辑模式
- **WHEN** 用户在预览模式下点击"编辑"按钮
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 加载当前文书的完整内容到编辑器
- **AND** 系统 SHALL 显示"保存"和"取消"按钮
- **AND** 系统 SHALL 不显示"导出 PDF"按钮

#### Scenario: 保存编辑
- **WHEN** 用户在编辑模式下修改内容并点击"保存"
- **THEN** 系统 SHALL 弹出命名对话框
- **AND** 系统 SHALL 在对话框中显示当前文书名称（如果存在）
- **AND** 系统 SHALL 允许用户输入或修改文书名称
- **AND** 系统 SHALL 在用户确认后保存修改后的内容和名称
- **AND** 系统 SHALL 返回预览模式显示更新后的文书
- **AND** 系统 SHALL 更新文书的更新时间

#### Scenario: 取消编辑
- **WHEN** 用户在编辑模式下点击"取消"
- **THEN** 系统 SHALL 返回预览模式
- **AND** 系统 SHALL 不保存任何修改
- **AND** 系统 SHALL 显示原始内容

### Requirement: 新增文书功能
系统 SHALL 提供新增文书功能，支持使用富文本编辑器创建新文书。

#### Scenario: 进入新增文书模式
- **WHEN** 用户点击"新增文书"按钮
- **THEN** 系统 SHALL 进入富文本编辑模式
- **AND** 系统 SHALL 显示基于 Tiptap 的富文本编辑器
- **AND** 系统 SHALL 提供空白的编辑区域
- **AND** 系统 SHALL 显示"保存"和"取消"按钮
- **AND** 系统 SHALL 不显示"导出 PDF"按钮

#### Scenario: 创建新文书
- **WHEN** 用户在编辑器中输入内容并点击"保存"
- **THEN** 系统 SHALL 弹出命名对话框
- **AND** 系统 SHALL 在对话框中显示空的名称输入框
- **AND** 系统 SHALL 允许用户输入文书名称
- **AND** 系统 SHALL 在用户确认后保存文书内容和名称
- **AND** 系统 SHALL 返回预览模式显示新创建的文书
- **AND** 系统 SHALL 在列表中显示新创建的文书

#### Scenario: 取消创建文书
- **WHEN** 用户在新增文书模式下点击"取消"
- **THEN** 系统 SHALL 返回文书列表
- **AND** 系统 SHALL 不保存任何内容

### Requirement: 文书预览功能
系统 SHALL 提供文书预览功能，显示文书的完整内容。

#### Scenario: 预览文书
- **WHEN** 用户点击列表中的某个文书
- **THEN** 系统 SHALL 在预览区域显示该文书的完整内容
- **AND** 系统 SHALL 保持原始文档的格式样式（字体、段落、表格等）
- **AND** 系统 SHALL 提供"编辑"按钮
- **AND** 系统 SHALL 提供"导出 PDF"按钮

### Requirement: PDF 导出功能
系统 SHALL 提供将文书导出为 PDF 的功能，确保导出内容与预览内容格式一致。

#### Scenario: 导出文书为 PDF
- **WHEN** 用户在预览模式下点击"导出 PDF"按钮
- **THEN** 系统 SHALL 将当前文书内容转换为 HTML
- **AND** 系统 SHALL 将 HTML 发送到后端进行 PDF 生成
- **AND** 系统 SHALL 下载生成的 PDF 文件
- **AND** 系统 SHALL 确保 PDF 内容与预览内容完全一致

### Requirement: 文书列表快速操作
系统 SHALL 在文书列表的每个文书卡片上提供快速操作按钮。

#### Scenario: 从列表编辑文书
- **WHEN** 用户在文书列表中点击某个文书的"编辑"按钮
- **THEN** 系统 SHALL 选中该文书
- **AND** 系统 SHALL 进入编辑模式
- **AND** 系统 SHALL 加载该文书的完整内容到编辑器

#### Scenario: 从列表删除文书
- **WHEN** 用户在文书列表中点击某个文书的"删除"按钮
- **THEN** 系统 SHALL 弹出删除确认对话框
- **AND** 系统 SHALL 显示文书的名称
- **AND** 系统 SHALL 提供"确认"和"取消"按钮
- **WHEN** 用户确认删除
- **THEN** 系统 SHALL 从数据库中删除该文书
- **AND** 系统 SHALL 从列表中移除该文书
- **AND** 系统 SHALL 如果该文书正在预览或编辑，则返回列表视图

#### Scenario: 列表操作按钮显示
- **WHEN** 用户将鼠标悬停在文书列表的某个文书卡片上
- **THEN** 系统 SHALL 显示"编辑"和"删除"按钮
- **AND** 系统 SHALL 按钮点击不会触发卡片选择事件

