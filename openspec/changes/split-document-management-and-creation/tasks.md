# Implementation Tasks

## 1. 数据库模型

- [x] 1.1 在 `app/documents_management/models.py` 中创建 `DocumentDraft` 模型
  - 定义字段：`id`, `case_id`, `document_id`, `form_data`, `created_by_id`, `updated_by_id`, `created_at`, `updated_at`
  - 添加唯一约束：`(case_id, document_id)` 组合唯一
  - 添加外键关系：关联到 `Case` 和 `Document`
  - 添加索引：`case_id`, `document_id`, `(case_id, document_id)`
  - _Requirements: 3.1_

- [x] 1.2 创建数据库迁移文件
  - 使用 Alembic 创建迁移
  - 定义 `DocumentDraft` 表结构
  - 运行迁移验证
  - _Requirements: 3.1_

## 2. 后端 Schema 和 Service

- [x] 2.1 在 `app/documents_management/schemas.py` 中添加草稿相关的 Schema
  - `DocumentDraftCreateRequest` - 创建/更新草稿请求
  - `DocumentDraftResponse` - 草稿响应
  - `DocumentDraftDetailResponse` - 草稿详情响应
  - _Requirements: 3.2_

- [x] 2.2 在 `app/documents_management/services.py` 中实现草稿管理服务
  - `get_draft(case_id, document_id)` - 获取草稿
  - `create_or_update_draft(case_id, document_id, form_data, staff_id)` - 创建或更新草稿
  - `delete_draft(draft_id)` - 删除草稿
  - `list_drafts_by_case(case_id)` - 获取某个案件的所有草稿
  - _Requirements: 3.2, 3.3_

## 3. 后端 API 路由

- [x] 3.1 在 `app/documents_management/routers.py` 中添加草稿相关API
  - `GET /api/v1/document-drafts?case_id={case_id}&document_id={document_id}` - 获取草稿
  - `POST /api/v1/document-drafts` - 创建或更新草稿
  - `DELETE /api/v1/document-drafts/{draft_id}` - 删除草稿
  - `GET /api/v1/document-drafts/case/{case_id}` - 获取某个案件的所有草稿
  - _Requirements: 3.2, 3.3_

- [x] 3.2 在 `app/documents_management/routers.py` 中添加文书制作相关API
  - `GET /api/v1/documents/published` - 获取已发布模板列表（用于文书制作页面）
  - `POST /api/v1/document-creation/generate` - 生成填充后的文档（基于表单数据和模板）
  - _Requirements: 2.1, 2.2_

- [x] 3.3 在 `app/api/v1.py` 中注册新的路由
  - 注册草稿相关路由
  - 注册文书制作相关路由
  - _Requirements: 3.2, 3.3_

## 4. 前端 API 客户端

- [x] 4.1 在 `frontend/lib/documents-api.ts` 中添加草稿相关API调用
  - `getDraft(caseId, documentId)` - 获取草稿
  - `createOrUpdateDraft(request)` - 创建或更新草稿
  - `deleteDraft(draftId)` - 删除草稿
  - `getDraftsByCase(caseId)` - 获取某个案件的所有草稿
  - _Requirements: 3.2, 3.3_

- [x] 4.2 在 `frontend/lib/documents-api.ts` 中添加文书制作相关API调用
  - `getPublishedDocuments()` - 获取已发布模板列表
  - `generateDocument(request)` - 生成填充后的文档
  - _Requirements: 2.1, 2.2_

## 5. 前端组件 - 文书制作页面

- [ ] 5.1 创建 `frontend/app/document-creation/page.tsx`
  - 实现案件选择步骤
  - 实现模板选择步骤
  - 实现表单填写步骤
  - 实现预览和下载功能
  - 实现草稿手动保存和自动加载
  - 实现按钮状态管理（保存按钮和下载按钮的启用/禁用状态）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_

- [x] 5.2 创建 `frontend/components/document-creation/case-selector.tsx`
  - 复用或参考现有的案件选择器组件
  - 支持案件搜索和选择
  - _Requirements: 2.1_

- [x] 5.3 创建 `frontend/components/document-creation/template-selector.tsx`
  - 显示已发布的模板列表
  - 支持模板搜索和筛选
  - 支持模板选择
  - _Requirements: 2.1, 2.2_

- [x] 5.4 创建 `frontend/components/document-creation/document-form.tsx`
  - 基于模板的占位符元数据渲染表单
  - 支持文本、单选、复选框等字段类型
  - 实现表单数据管理
  - 实现表单数据更新检测（与已保存草稿对比）
  - 实现表单数据变化时触发按钮状态更新
  - _Requirements: 2.2, 2.3, 3.3_

- [x] 5.5 创建 `frontend/components/document-creation/document-preview.tsx`
  - 显示填充后的文档预览
  - 实现"保存草稿"按钮（根据表单更新状态启用/禁用）
  - 实现"下载文书"按钮（根据保存状态启用/禁用）
  - 实现按钮状态管理逻辑
  - _Requirements: 2.4, 3.3_

## 6. 前端组件 - 修改文书管理页面

- [x] 6.1 修改 `frontend/app/documents/page.tsx`
  - 移除表单填写功能（`generate` 模式）
  - 移除"进入表单模式"按钮
  - 保持模板管理功能（创建、编辑、预览、发布）
  - _Requirements: 1.1, 1.2_

## 7. 导航更新

- [x] 7.1 更新 `frontend/components/top-navigation.tsx`
  - 添加"文书制作"导航项
  - 添加对应的路由和图标
  - 更新 `getActiveModule()` 函数
  - _Requirements: 1.3_

## 8. 测试和验证

- [ ] 8.1 测试草稿功能
  - 测试创建草稿
  - 测试更新草稿
  - 测试查询草稿
  - 测试删除草稿
  - 测试唯一约束（同一案件+模板只能有一个草稿）
  - _Requirements: 3.2, 3.3_

- [ ] 8.2 测试文书制作流程
  - 测试选择案件
  - 测试选择模板
  - 测试填写表单
  - 测试草稿自动保存和加载
  - 测试预览和下载
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8.3 测试文书管理页面
  - 验证已移除表单填写功能
  - 验证模板管理功能正常
  - _Requirements: 1.1, 1.2_

