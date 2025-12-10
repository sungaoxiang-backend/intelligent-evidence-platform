# Change: Add Table Row Export Control

## Why

在文书生成场景中，某些表格行需要根据案件情况可选地包含在最终导出的文档中。例如，原告主体可能是"原告（自然人）"或"原告（组织、非法人组织）"，这两个选项在模板创建时都写在模板中，但在下载文书时，用户需要根据实际情况选择只包含其中一个。

目前系统没有提供行级别的导出控制机制，导致所有表格行都会被包含在导出的文档中，无法满足这种场景需求。

## What Changes

- **ADDED**: 在ProseMirror JSON的`tableRow`节点中添加`exportEnabled`属性（boolean类型，默认为`true`）
- **ADDED**: 在文档导出时，过滤掉`exportEnabled: false`的表格行
- **ADDED**: 在文书生成表单中，为每个表格行提供UI控件（checkbox/toggle）来控制是否包含在导出中
- **MODIFIED**: 更新`_replace_placeholders_in_json`方法，在导出前过滤不可导出的行
- **MODIFIED**: 更新前端表格行渲染组件，支持显示和控制`exportEnabled`属性

## Impact

- **Affected specs**: `document-generation` capability
- **Affected code**:
  - `app/document_generation/services.py` - 导出逻辑
  - `app/template_editor/mappers.py` - ProseMirror映射（可选，用于向后兼容）
  - `frontend/components/document-generation/document-preview-form.tsx` - 表单渲染
  - `frontend/components/document-generation/narrative-table-cell.tsx` - 陈述式单元格渲染
  - `frontend/components/document-generation/replicable-table-cell-with-attrs.tsx` - 要素式单元格渲染
  - `frontend/components/template-editor/extensions.ts` - TableRow扩展定义（如需要）

