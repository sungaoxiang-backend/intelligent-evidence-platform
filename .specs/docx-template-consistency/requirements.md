# Requirements Document

## Introduction

本功能旨在让模板编辑器在 docx ↔︎ ProseMirror 转换以及前端渲染过程中保持与源文档一致的排版、样式与结构，并消除当前因颜色、段落样式、列表、表格宽度等信息丢失导致的解析失败和导出失真问题。

## Requirements

### Requirement 1

**User Story:** 作为 模板配置管理员，我想在上传任何包含自定义字体颜色和复杂样式的 docx 时不再报错，以便顺利完成模板入库。

#### Acceptance Criteria

1. WHEN docx 中存在字体颜色等格式 THEN 解析服务 SHALL 在 rgb_to_hex 等转换环节安全处理并返回 JSON。
2. IF 解析出现无法识别的样式 THEN 服务 SHALL 记录警告并继续生成可用 JSON，而非抛出 5xx/4xx。

### Requirement 2

**User Story:** 作为 模板配置管理员，我想让复杂文档（列表、编号、文本对齐、缩进、表格宽度等）在平台预览时与原始 docx 基本一致，以便判断模板是否可用。

#### Acceptance Criteria

1. WHEN docx 中包含段落对齐、缩进、段前段后间距、标题级别、字体、字号、颜色、列表、编号、制表符等信息 THEN 解析器 SHALL 转换为 ProseMirror 节点属性。
2. WHEN ProseMirror JSON 渲染在前端 preview/editor 里 THEN 组件 SHALL 根据 JSON 中的样式渲染 DOM，不再统一覆写为默认字体或表格样式。
3. WHEN 表格有列宽、单元格合并、边框样式 THEN 解析结果 SHALL 在 JSON 中保留这些属性，并在预览中体现。

### Requirement 3

**User Story:** 作为 模板使用者，我希望导出后的 docx 能最大程度保持在平台中编辑/预览时的样式，以便直接用于业务。

#### Acceptance Criteria

1. WHEN 将 ProseMirror JSON 导出为 docx THEN 映射器 SHALL 将字体、字号、颜色、段落对齐、列表、表格列宽等属性写入 Word，而不是改写为全局默认。
2. WHEN JSON 中缺失某项样式 THEN 导出器 SHALL 使用合理默认值，但不能覆盖已有设定。
3. WHEN 导出的 docx 被再次上传解析 THEN 解析与导出结果 SHALL 在视觉上保持闭环一致性（允许微小差异，整体版式一致）。

### Requirement 4

**User Story:** 作为 系统运维人员，我想在上传、解析、导出链路中更容易诊断问题，以便快速定位格式丢失或兼容性问题。

#### Acceptance Criteria

1. WHEN 解析或导出遇到不支持的元素 THEN 服务 SHALL 输出结构化日志，包含元素位置、类型与降级策略。
2. WHEN 前端预览无法渲染某属性 THEN 控制台 SHALL 记录警告并回退到默认样式，不影响整体渲染。


