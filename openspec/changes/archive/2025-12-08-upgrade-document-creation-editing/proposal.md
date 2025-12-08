# Change: 升级文书制作页面编辑体验

## Why

当前文书制作页面使用表单填写模式，用户通过填写表单字段来填充模板占位符。而文书模板编辑页面使用富文本编辑器，提供更灵活的编辑体验。用户希望两个页面的编辑体验保持一致，并且草稿应该存储完整的文档内容副本，而不是仅存储占位符填充值。

这种升级能够：
1. **统一编辑体验**：文书制作页面与模板编辑页面使用完全相同的富文本编辑组件
2. **草稿副本化**：草稿存储完整的文档内容副本，支持直接编辑文档内容
3. **编辑独立性**：编辑草稿不会影响原模板

## What Changes

- **移除表单填写界面**：完全移除文书制作页面中的表单填写列，不再基于占位符填写
- **复用编辑组件**：完全复用文书模板页面（`/documents`）的 `DocumentEditor` 和 `DocumentPreview` 组件
- **扩展草稿数据模型**：在 `DocumentDraft` 模型中添加 `content_json` 字段，存储完整的 ProseMirror JSON 文档内容
- **草稿初始化策略**：从模板创建草稿时，深拷贝模板的 `content_json` 到草稿
- **草稿保存逻辑**：保存草稿时，保存完整的文档内容（`content_json`），而不是仅保存占位符填充值（`form_data`）
- **UI布局调整**：
  - 之前：左侧案件信息 + 中间表单填写 + 右侧预览
  - 之后：左侧案件信息 + 右侧文档编辑/预览（与模板编辑页面一致）

## Impact

- **Affected specs**: 
  - `document-creation` - 修改文书制作能力规范（移除表单填写，改为富文本编辑）
- **Affected code**: 
  - `frontend/app/document-creation/page.tsx` - 重构为使用富文本编辑器
  - `frontend/components/document-creation/` - 移除表单相关组件，复用文档编辑组件
  - `app/documents_management/models.py` - 扩展 `DocumentDraft` 模型，添加 `content_json` 字段
  - `app/documents_management/services.py` - 更新草稿服务，支持 `content_json` 的创建和更新
  - `app/documents_management/routers.py` - 更新草稿API，支持 `content_json` 字段
  - `app/documents_management/schemas.py` - 更新草稿Schema，添加 `content_json` 字段
  - `frontend/lib/documents-api.ts` - 更新草稿API调用，支持 `content_json` 字段
  - 数据库迁移：添加 `content_json` 字段到 `document_drafts` 表

