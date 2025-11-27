# Change: 分析文书模板和文书生成模块的局限性

## Why

当前系统在模板预览、编辑、表单预览和编辑方面存在多个硬编码的假设和限制，这些假设限制了系统的灵活性和可扩展性。需要系统性地梳理这些局限性，为未来的架构改进提供基础。

## What Changes

- 文档化当前系统对模板类型的假设（要素式/陈述式/混合式）
- 文档化系统对表格和单元格结构的假设
- 文档化系统对占位符组织方式的假设
- 文档化预览和编辑功能的局限性
- 识别系统无法处理的模板场景

## Impact

- **Affected specs**: 无（这是分析性文档，不修改现有规范）
- **Affected code**: 
  - `frontend/components/document-generation/` - 表单预览和编辑逻辑
  - `frontend/components/template-editor/` - 模板编辑逻辑
  - `app/template_editor/` - 模板映射和导出逻辑
  - `app/document_generation/` - 文档生成逻辑

