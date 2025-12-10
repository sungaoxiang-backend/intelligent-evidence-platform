# Change: 拆分文书管理和文书制作功能

## Why

当前"文书管理"模块同时承担了模板管理和文书制作两个职责，导致功能混杂。用户需要一个清晰的分离：
- **文书管理**：专注于管理文书模板（草稿和已发布状态）
- **文书制作**：专注于基于已发布模板制作具体文书，关联案件，支持草稿保存和下载

这种分离能够：
1. 明确职责边界，提升用户体验
2. 支持案件关联，便于后续的案件文书管理
3. 支持草稿功能，用户可以保存填写进度

## What Changes

- **新增"文书制作"页面**：在顶部导航添加"文书制作"入口，创建 `/document-creation` 路由页面
- **拆分功能职责**：
  - "文书管理"页面：仅管理草稿和已发布的文书模板（创建、编辑、预览、发布）
  - "文书制作"页面：展示已发布的文书模板，渲染为表单，用户填写并下载
- **案件关联功能**：在"文书制作"页面中，用户需要选择案件，然后选择模板进行填写
- **草稿存储模型**：新增 `DocumentDraft` 模型，存储某个案件+模板ID的表单草稿数据
- **草稿管理功能**：
  - 自动保存草稿（用户填写表单时）
  - 自动加载草稿（进入页面时，如果存在该案件+模板的草稿）
  - 支持新建和更新草稿
- **后端API扩展**：
  - 新增草稿相关的API（创建、更新、查询、删除）
  - 扩展文书制作相关的服务

## Impact

- **Affected specs**: 
  - `document-management` - 修改文书管理能力规范（拆分职责）
  - `document-creation` - 新增文书制作能力规范
- **Affected code**: 
  - `frontend/components/top-navigation.tsx` - 添加"文书制作"导航项
  - `frontend/app/documents/page.tsx` - 修改为仅管理模板（移除表单填写功能）
  - `frontend/app/document-creation/page.tsx` - 新增文书制作页面
  - `frontend/components/document-creation/` - 新增文书制作相关组件
  - `app/documents_management/models.py` - 新增 `DocumentDraft` 模型
  - `app/documents_management/services.py` - 新增草稿管理服务
  - `app/documents_management/routers.py` - 新增草稿相关API路由
  - `app/documents_management/schemas.py` - 新增草稿相关Schema
  - `frontend/lib/documents-api.ts` - 新增草稿相关API调用

