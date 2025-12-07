## MODIFIED Requirements

### Requirement: 编辑文书功能
系统 SHALL 提供编辑已存在文书的功能，并确保从 WPS 粘贴的表格格式与源文档一致。

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

#### Scenario: 从 WPS 粘贴表格
- **WHEN** 用户从 WPS 复制表格内容并粘贴到编辑器
- **THEN** 系统 SHALL 保留表格的原始宽度（如果存在）
- **AND** 系统 SHALL 保留表格的列宽比例
- **AND** 系统 SHALL 统一表格单元格的字体大小
- **AND** 系统 SHALL 如果表格宽度超过容器宽度，提供水平滚动
- **AND** 系统 SHALL 确保表格格式与源文档一致

## ADDED Requirements

### Requirement: 表格格式一致性处理
系统 SHALL 在处理从 WPS 粘贴的表格内容时，保持表格格式与源文档一致。

#### Scenario: 保留表格宽度
- **WHEN** 用户从 WPS 复制包含宽度信息的表格并粘贴到编辑器
- **THEN** 系统 SHALL 检测表格的原始宽度
- **AND** 系统 SHALL 如果表格宽度超过容器宽度，保留原始宽度并使用水平滚动
- **AND** 系统 SHALL 如果表格宽度小于容器宽度，使用 `width: 100%` 填充容器
- **AND** 系统 SHALL 确保表格在容器中正确对齐

#### Scenario: 保留列宽比例
- **WHEN** 用户从 WPS 复制包含列宽信息的表格并粘贴到编辑器
- **THEN** 系统 SHALL 提取表格的列宽信息（支持 px、pt、% 等单位）
- **AND** 系统 SHALL 将列宽转换为 Tiptap 使用的单位（twips）
- **AND** 系统 SHALL 在表格节点中保存 `colWidths` 属性
- **AND** 系统 SHALL 在渲染时使用 `colgroup` 和 `col` 元素应用列宽
- **AND** 系统 SHALL 使用 `table-layout: fixed` 模式保持列宽比例

#### Scenario: 统一表格字体
- **WHEN** 用户从 WPS 复制包含不同字体大小的表格并粘贴到编辑器
- **THEN** 系统 SHALL 检测表格单元格中的字体大小
- **AND** 系统 SHALL 如果字体大小差异较大（超过 2pt），统一为默认字体大小（14px）
- **AND** 系统 SHALL 保留字体样式（如加粗、斜体等），但统一字体大小
- **AND** 系统 SHALL 确保表格单元格使用一致的字体族

#### Scenario: 水平滚动支持
- **WHEN** 表格宽度超过容器宽度
- **THEN** 系统 SHALL 在容器上显示水平滚动条
- **AND** 系统 SHALL 允许用户水平滚动查看完整表格
- **AND** 系统 SHALL 保持 A4 纸张的视觉效果（794px 宽度）
- **AND** 系统 SHALL 确保滚动行为流畅

