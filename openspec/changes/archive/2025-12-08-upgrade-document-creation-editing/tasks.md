# Implementation Tasks

## 1. 数据库模型扩展

- [x] 1.1 创建数据库迁移文件，在 `document_drafts` 表中添加 `content_json` 字段
  - 字段类型：JSON
  - 允许为空：是（向后兼容现有数据）
  - 添加注释说明字段用途
  - _Requirements: 2.1_

- [x] 1.2 更新 `app/documents_management/models.py` 中的 `DocumentDraft` 模型
  - 添加 `content_json` 字段定义
  - 保留 `form_data` 字段（用于向后兼容，但标记为废弃）
  - _Requirements: 2.1_

- [x] 1.3 运行数据库迁移
  - 执行迁移脚本
  - 验证字段添加成功
  - _Requirements: 2.1_

## 2. 后端 API 更新

- [x] 2.1 更新 `app/documents_management/schemas.py` 中的草稿相关 Schema
  - 在 `DocumentDraftCreateRequest` 中添加 `content_json` 字段（可选）
  - 在 `DocumentDraftResponse` 中添加 `content_json` 字段
  - 保留 `form_data` 字段（向后兼容）
  - _Requirements: 2.2, 2.3_

- [x] 2.2 更新 `app/documents_management/services.py` 中的 `DocumentDraftService`
  - 修改 `create_or_update_draft` 方法，支持 `content_json` 参数
  - 如果提供了 `content_json`，则保存 `content_json`；否则保持原有逻辑（向后兼容）
  - 在创建草稿时，如果未提供 `content_json`，从模板深拷贝 `content_json`
  - _Requirements: 2.2, 2.3_

- [x] 2.3 更新 `app/documents_management/routers.py` 中的草稿API路由
  - 更新 `create_or_update_draft` 路由，接收 `content_json` 参数
  - 更新 `get_draft` 路由，返回 `content_json` 字段
  - _Requirements: 2.2, 2.3_

## 3. 前端 API 客户端更新

- [x] 3.1 更新 `frontend/lib/documents-api.ts` 中的草稿相关类型定义
  - 在 `DocumentDraft` 接口中添加 `content_json` 字段（可选）
  - 保留 `form_data` 字段（向后兼容）
  - _Requirements: 3.1_

- [x] 3.2 更新 `frontend/lib/documents-api.ts` 中的草稿API调用
  - 更新 `createOrUpdateDraft` 方法，支持 `content_json` 参数
  - 更新 `getDraft` 方法，返回包含 `content_json` 的草稿数据
  - _Requirements: 3.1_

## 4. 前端组件重构

- [x] 4.1 重构 `frontend/app/document-creation/page.tsx`
  - 移除表单填写相关的状态和逻辑（`formData`, `savedFormData`, `DocumentForm` 组件等）
  - 移除表单填写列（中间列）
  - 添加文档编辑状态管理（`draftContent`, `viewMode` 等）
  - 集成 `DocumentEditor` 和 `DocumentPreview` 组件（从 `@/components/documents/` 导入）
  - 实现编辑模式和预览模式的切换
  - 更新草稿加载逻辑：从草稿的 `content_json` 加载，如果不存在则从模板的 `content_json` 深拷贝
  - 更新草稿保存逻辑：保存 `content_json` 而不是 `form_data`
  - 更新文档下载逻辑：基于草稿的 `content_json` 生成PDF
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 4.2 移除不再使用的组件（可选，如果确定不再需要）
  - `frontend/components/document-creation/document-form.tsx` - 表单填写组件
  - 相关表单字段组件（如果存在）
  - _Requirements: 1.1_

- [ ] 4.3 更新 `frontend/components/document-creation/document-preview.tsx`（如果存在）
  - 确保与 `@/components/documents/document-preview.tsx` 保持一致
  - 或者直接使用 `@/components/documents/document-preview.tsx`
  - _Requirements: 1.2_

## 5. 数据迁移（可选）

- [ ] 5.1 创建数据迁移脚本（如果需要）
  - 为现有草稿生成 `content_json`（基于模板的 `content_json` 和 `form_data`）
  - 使用 `replace_placeholders_in_prosemirror` 函数填充占位符
  - 验证数据完整性
  - _Requirements: 2.4_

## 6. 测试和验证

- [ ] 6.1 测试草稿创建流程
  - 选择案件和模板
  - 验证草稿从模板深拷贝 `content_json`
  - 验证草稿保存成功
  - _Requirements: 1.3, 2.3_

- [ ] 6.2 测试草稿编辑流程
  - 加载已存在的草稿
  - 在编辑模式下修改文档内容
  - 保存草稿
  - 验证草稿内容正确保存
  - _Requirements: 1.4, 2.3_

- [ ] 6.3 测试草稿预览和下载
  - 在预览模式下查看草稿
  - 下载草稿为PDF
  - 验证PDF内容与预览一致
  - _Requirements: 1.5_

- [ ] 6.4 测试向后兼容性
  - 验证现有草稿（只有 `form_data`）仍能正常加载
  - 验证旧草稿可以自动迁移到新格式（如果需要）
  - _Requirements: 2.4_

- [ ] 6.5 测试编辑独立性
  - 编辑草稿内容
  - 验证原模板内容不受影响
  - _Requirements: 1.4_

