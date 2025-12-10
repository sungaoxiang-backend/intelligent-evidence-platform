# Implementation Tasks

## 1. 后端实现

- [x] 1.1 创建数据库迁移文件，添加 `documents` 表
  - 定义 `Document` 模型
  - 包含必要的索引和约束
  - _Requirements: 1.1_

- [x] 1.2 创建 `app/documents_management/` 模块
  - 创建 `__init__.py`
  - 创建 `models.py` 定义 `Document` 模型
  - 创建 `schemas.py` 定义请求/响应模式
  - _Requirements: 1.1, 2.1_

- [x] 1.3 实现 `app/documents_management/services.py`
  - 实现 `create_document()` 方法
  - 实现 `get_document()` 方法
  - 实现 `list_documents()` 方法（支持搜索、筛选、分页）
  - 实现 `update_document()` 方法
  - 实现 `delete_document()` 方法
  - 实现 `export_document_to_pdf()` 方法（使用 Playwright 将 HTML 转换为 PDF）
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.3.1 安装和配置 Playwright
  - 在 `pyproject.toml` 中添加 `playwright` 依赖
  - 配置 Playwright Chromium 浏览器（`playwright install chromium`）
  - 创建 PDF 导出工具函数（HTML 转 PDF）
  - _Requirements: 2.4_

- [x] 1.4 实现 `app/documents_management/routers.py`
  - 实现 `POST /api/v1/documents` 创建文书
  - 实现 `GET /api/v1/documents` 获取文书列表
  - 实现 `GET /api/v1/documents/{id}` 获取文书详情
  - 实现 `PUT /api/v1/documents/{id}` 更新文书
  - 实现 `DELETE /api/v1/documents/{id}` 删除文书
  - 实现 `POST /api/v1/documents/{id}/export` 导出为 PDF（接收 HTML 内容，返回 PDF 文件流）
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 1.5 在 `app/api/v1.py` 中注册新路由
  - 导入 `documents_management` 路由
  - 注册到 API 路由器
  - _Requirements: 2.1_

## 2. 前端实现

- [x] 2.1 创建 `frontend/lib/documents-api.ts`
  - 定义 `Document` 类型接口
  - 实现 `documentsApi` 对象，包含所有 API 调用方法
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2.2 创建 `frontend/components/documents/document-list.tsx`
  - 实现文书列表展示组件
  - 支持搜索和筛选功能
  - 支持点击文书进入预览
  - _Requirements: 1.1, 1.2_

- [x] 2.3 创建 `frontend/components/documents/document-preview.tsx`
  - 独立实现文书预览组件
  - 基于 Tiptap 实现只读预览（editable: false）
  - 确保与编辑器使用相同的扩展配置
  - 提供"编辑"按钮
  - _Requirements: 1.2, 1.3_

- [x] 2.4 创建 `frontend/components/documents/document-editor.tsx`
  - 独立实现文书编辑器组件
  - 基于 Tiptap 最佳实践实现富文本编辑器
  - 支持文本格式、表格、列表等基本功能
  - 确保与预览组件格式一致性
  - 提供"保存"和"取消"按钮
  - _Requirements: 1.3, 1.4_

- [x] 2.7 实现 PDF 导出功能
  - 在预览和编辑组件中添加"导出 PDF"按钮
  - 实现 HTML 生成函数（使用 Tiptap 的 `generateHTML()` 将 ProseMirror JSON 转换为 HTML）
  - 实现导出 API 调用（发送 HTML 内容到后端）
  - 处理 PDF 文件下载
  - _Requirements: 2.4_

- [x] 2.5 创建 `frontend/app/documents/page.tsx`
  - 实现文书管理主页面
  - 集成列表、预览、编辑组件
  - 实现模式切换逻辑（列表/预览/编辑）
  - 实现"新增文书"功能
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.6 更新 `frontend/components/top-navigation.tsx`
  - 在导航项中添加"文书管理"入口
  - 添加对应的图标和路由
  - 更新 `getActiveModule()` 函数
  - _Requirements: 1.1_

## 3. 测试和验证

- [ ] 3.1 测试文书创建功能
  - 测试直接创建新文书
  - 验证数据保存正确性
  - 验证不与现有模板系统产生耦合
  - _Requirements: 1.3, 2.1_

- [ ] 3.2 测试文书编辑功能
  - 测试编辑已存在的文书
  - 测试保存和取消操作
  - 验证格式一致性
  - _Requirements: 1.4, 2.3_

- [ ] 3.3 测试预览功能
  - 测试预览模式下的内容显示
  - 验证表格格式正确性
  - 验证与编辑模式的一致性
  - _Requirements: 1.2, 2.2_

- [ ] 3.4 测试列表和检索功能
  - 测试文书列表加载
  - 测试搜索功能
  - 测试筛选功能
  - 测试分页功能
  - _Requirements: 1.1, 2.1_

- [ ] 3.5 测试 PDF 导出功能
  - 测试导出 PDF 功能
  - 验证 PDF 内容与预览内容一致
  - 验证表格格式在 PDF 中正确渲染
  - 验证复杂样式（合并单元格、边框等）正确显示
  - 验证 PDF 文件可正常下载和打开
  - _Requirements: 2.4_

