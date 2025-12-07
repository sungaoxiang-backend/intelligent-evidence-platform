## MODIFIED Requirements

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

#### Scenario: 粘贴表格内容对齐方式处理
- **WHEN** 用户从 WPS 或其他 Office 软件复制表格内容并粘贴到编辑器
- **THEN** 系统 SHALL 正确解析单元格的对齐方式
- **AND** 系统 SHALL 确保单元格的对齐方式由单元格本身控制，而不是段落
- **AND** 系统 SHALL 清理单元格内段落的对齐样式，避免冲突
- **AND** 系统 SHALL 确保不会出现多种对齐方式同时存在的情况
- **AND** 系统 SHALL 保持对齐方式互斥，不会出现"左对齐"+"居中对齐"同时存在的情况

