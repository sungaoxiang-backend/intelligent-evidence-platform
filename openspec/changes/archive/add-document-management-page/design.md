# Design: 文书管理页面

## Context

当前系统存在旧的模板管理和文书生成模块，但这些模块存在问题。用户需要一个新的、完全独立的"文书管理"页面，用于管理文书文档，支持创建、编辑、预览等功能。

**重要原则**：本模块完全独立实现，不与现有模板管理、文书生成模块产生任何耦合，为后续逐步替换旧模块做准备。

## Goals / Non-Goals

### Goals
- 提供统一的文书管理界面
- 支持基于 Tiptap 的富文本编辑（独立实现）
- 确保预览和编辑时格式一致性
- 支持直接创建新文书（不依赖模板）
- 提供检索和列表展示功能
- 完全独立的实现，不依赖现有模块

### Non-Goals
- 不与现有的模板管理功能耦合
- 不与现有的文书生成功能耦合
- 不复用现有有问题的组件和代码
- 不实现复杂的权限控制（使用现有的权限系统）
- 不实现文档版本控制（后续可扩展）

## Decisions

### 1. 数据模型设计

创建新的 `Document` 模型来存储文书，完全独立于现有的模板和生成模块：

```python
class Document(Base):
    """文书模型 - 完全独立实现，不依赖现有模板系统"""
    __tablename__ = "documents"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    
    # ProseMirror JSON 内容（独立的数据格式，不依赖现有模板格式）
    content_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, comment="ProseMirror JSON 格式的文档内容")
    
    # 创建和更新信息
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True)
    updated_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("staffs.id"), nullable=True)
    
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

**理由**：
- 完全独立的数据模型，不关联现有模板系统
- 使用 `content_json` 字段名，区别于现有模板的 `prosemirror_json`
- 不包含模板关联字段，确保独立性
- 包含基本的元数据字段（名称、描述、分类）

### 2. 前端页面结构

```
frontend/app/documents/
├── page.tsx              # 文书列表和预览页面

frontend/components/documents/
├── document-list.tsx           # 文书列表组件（独立实现）
├── document-preview.tsx       # 文书预览组件（独立实现）
└── document-editor.tsx        # 文书编辑器组件（独立实现，基于 Tiptap）
```

**理由**：
- 完全独立的组件实现，不依赖现有有问题的组件
- 基于 Tiptap 独立实现编辑器，确保质量和可维护性
- 使用列表+预览的布局，符合用户需求

### 3. 编辑器实现

独立实现基于 Tiptap 的富文本编辑器，不依赖现有组件。

**理由**：
- 现有组件存在问题，不进行复用
- 独立实现确保代码质量和可维护性
- 基于 Tiptap 最佳实践实现，支持表格、格式等需求
- 保证预览和编辑格式一致性

### 4. API 设计

```
POST   /api/v1/documents              # 创建文书
GET    /api/v1/documents              # 获取文书列表（支持搜索、筛选、分页）
GET    /api/v1/documents/{id}         # 获取文书详情
PUT    /api/v1/documents/{id}         # 更新文书
DELETE /api/v1/documents/{id}         # 删除文书
POST   /api/v1/documents/{id}/export # 导出为 PDF
```

**理由**：
- RESTful 设计，符合现有 API 风格
- 支持基本的 CRUD 操作
- 支持 PDF 导出功能（避免复杂的 DOCX 样式映射）

### 4.1 PDF 导出方案

经过调研，确定使用 **后端 HTML 转 PDF** 方案，具体技术选型如下：

#### 方案对比

**方案 A：Playwright for Python（推荐）**
- **优点**：
  - 基于 Chromium 无头浏览器，渲染精确
  - 支持现代 CSS 和 JavaScript
  - 与前端预览完全一致
  - 支持复杂表格、合并单元格等
  - 可控制页面大小、边距等 PDF 参数
- **缺点**：
  - 需要安装 Chromium（体积较大，~300MB）
  - 首次启动可能较慢
- **适用场景**：需要精确渲染、复杂样式支持

**方案 B：WeasyPrint**
- **优点**：
  - 纯 Python 实现，无需外部依赖
  - 轻量级，安装简单
  - 支持 CSS 2.1 和部分 CSS 3
- **缺点**：
  - 对复杂 CSS 支持有限
  - 不支持 JavaScript
  - 表格渲染可能不如浏览器精确
- **适用场景**：简单文档、对样式要求不高

**方案 C：前端 jsPDF + html2canvas**
- **优点**：
  - 无需后端处理
  - 实现简单
- **缺点**：
  - 对复杂样式支持有限
  - 表格可能渲染不准确
  - 大文档性能问题
- **适用场景**：简单导出需求

#### 最终选择：Playwright for Python

**理由**：
1. **精确渲染**：基于 Chromium，与前端预览完全一致
2. **复杂样式支持**：支持现代 CSS，完美处理表格、合并单元格等
3. **格式一致性**：确保导出 PDF 与预览 HTML 格式一致
4. **可控性强**：可精确控制 PDF 参数（页面大小、边距、页眉页脚等）

**实现流程**：
1. 前端将 ProseMirror JSON 转换为 HTML（使用 Tiptap 的 `generateHTML`）
2. 后端接收 HTML 内容
3. 使用 Playwright 在无头浏览器中渲染 HTML
4. 调用 `page.pdf()` 生成 PDF
5. 返回 PDF 文件流给前端下载

**技术栈**：
- Python 包：`playwright` (需要 `playwright install chromium`)
- HTML 生成：前端使用 Tiptap 的 `generateHTML()` 方法
- PDF 参数：A4 纸张、合适的边距、打印样式

### 5. 预览和编辑模式

独立实现预览和编辑组件，使用状态管理切换模式：
- 预览模式：只读，独立实现的预览组件
- 编辑模式：可编辑，独立实现的编辑器组件

**理由**：
- 完全独立实现，不依赖现有有问题的组件
- 保证格式一致性（使用相同的 ProseMirror JSON 格式）
- 确保预览和编辑使用相同的渲染逻辑

## Risks / Trade-offs

### 风险
1. **开发工作量**：独立实现所有组件，开发工作量较大
   - **缓解**：基于 Tiptap 最佳实践，参考官方文档和示例
   - **收益**：获得高质量、可维护的代码，避免现有问题

2. **格式一致性**：预览和编辑使用不同组件，可能存在格式差异
   - **缓解**：使用相同的 ProseMirror JSON 格式，确保数据一致性
   - **缓解**：预览和编辑使用相同的 Tiptap 扩展配置

3. **性能**：大量文书时的列表加载性能
   - **缓解**：使用分页和搜索，限制单次加载数量

### 权衡
- **独立 vs 复用**：选择完全独立实现，虽然开发工作量大，但能确保代码质量，避免现有问题，为后续替换旧模块做准备
- **单页 vs 多页**：选择单页模式（列表+预览+编辑），减少页面跳转，但页面复杂度增加

## Migration Plan

1. **数据库迁移**：创建 `documents` 表
2. **后端实现**：创建模型、服务、路由
3. **前端实现**：创建页面和组件
4. **导航更新**：在顶部导航添加"文书管理"入口
5. **测试**：功能测试和格式一致性验证

## Open Questions

1. 是否需要支持从模板创建文书的快捷方式？
   - **决定**：不支持，完全独立实现，不依赖模板系统

2. 是否需要支持文书的分类和标签？
   - **决定**：先支持分类，标签后续扩展

3. 是否需要支持文书的导出功能？
   - **决定**：支持，独立实现 PDF 导出功能，使用 Playwright for Python 方案
   - **理由**：避免复杂的 DOCX 样式映射，基于 HTML 转 PDF 确保与预览一致

