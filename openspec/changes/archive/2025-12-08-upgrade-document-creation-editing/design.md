# Design: 升级文书制作页面编辑体验

## Context

当前文书制作页面使用表单填写模式，用户通过填写表单字段来填充模板占位符。而文书模板编辑页面使用富文本编辑器，提供更灵活的编辑体验。用户希望两个页面的编辑体验保持一致。

## Goals

1. **统一编辑体验**：文书制作页面使用与模板编辑页面完全相同的富文本编辑组件
2. **草稿副本化**：草稿存储完整的文档内容副本，而不是仅存储占位符填充值
3. **编辑独立性**：编辑草稿不会影响原模板

## Non-Goals

- 不改变模板编辑页面的功能
- 不改变草稿的基本概念（案件+模板的唯一组合）
- 不改变文档下载功能（仍然基于填充后的内容生成PDF）

## Decisions

### Decision 1: 复用现有编辑组件

**选择**：完全复用 `DocumentEditorSimple` 和 `DocumentPreviewInteractive` 组件

**理由**：
- 这些组件已经在模板编辑页面中经过充分测试
- 提供完整的富文本编辑功能
- 支持占位符的显示和编辑
- 保持代码一致性和可维护性

**替代方案**：
- 创建新的编辑组件：会增加代码重复和维护成本

### Decision 2: 扩展草稿数据模型

**选择**：在 `DocumentDraft` 模型中添加 `content_json` 字段，保留 `form_data` 字段（用于向后兼容，但不再使用）

**理由**：
- `content_json` 存储完整的 ProseMirror JSON 文档内容
- 草稿是模板的完整副本，包含所有编辑内容
- 保留 `form_data` 字段避免破坏现有数据，但新功能不再使用它

**替代方案**：
- 完全移除 `form_data`：会破坏现有数据，需要数据迁移

### Decision 3: 草稿初始化策略

**选择**：从模板创建草稿时，深拷贝模板的 `content_json` 到草稿

**理由**：
- 确保草稿是模板的完整副本
- 用户可以直接编辑文档内容，包括占位符
- 编辑草稿不会影响原模板

**实现细节**：
```python
# 创建草稿时
draft = DocumentDraft(
    case_id=case_id,
    document_id=document_id,
    content_json=deepcopy(template.content_json),  # 深拷贝
    form_data={},  # 保留字段但不再使用
)
```

### Decision 5: 内容格式转换策略

**选择**：与模板编辑页面保持一致，使用节点格式（nodes）存储，编辑时转换为文本格式（text）

**理由**：
- 与模板编辑页面完全一致的编辑体验
- 节点格式支持占位符的交互式预览（chip显示）
- 文本格式支持直接编辑占位符（`{{placeholder}}`格式）

**实现细节**：
- 草稿存储：使用节点格式（`content_json` 存储为节点格式）
- 编辑模式：将节点格式转换为文本格式，使用 `DocumentEditorSimple`
- 预览模式：使用节点格式，使用 `DocumentPreviewInteractive`
- 保存时：将文本格式转换回节点格式保存
- 使用 `convertPlaceholderNodesToText` 和 `convertTextToPlaceholderNodes` 进行格式转换

### Decision 4: 移除表单填写界面

**选择**：完全移除表单填写列，只保留文档编辑和预览区域

**理由**：
- 用户可以直接在文档中编辑内容，不需要单独的表单
- 简化界面，减少认知负担
- 与模板编辑页面保持一致

**UI布局变化**：
- 之前：左侧案件信息 + 中间表单填写 + 右侧预览
- 之后：左侧案件信息 + 右侧文档编辑/预览（与模板编辑页面一致）

## Architecture

### 数据流

```
模板 (Document)
  ↓ (深拷贝)
草稿 (DocumentDraft)
  ↓ (用户编辑)
更新草稿 content_json
  ↓ (保存)
数据库
```

### 组件复用

```
文书模板编辑页面
  ├── DocumentEditorSimple (编辑模式)
  └── DocumentPreviewInteractive (预览模式)

文书制作页面 (升级后)
  ├── DocumentEditorSimple (编辑模式) ← 复用
  └── DocumentPreviewInteractive (预览模式) ← 复用
```

## Risks / Trade-offs

### Risk 1: 数据迁移

**风险**：现有草稿只包含 `form_data`，不包含 `content_json`

**缓解措施**：
- 在加载草稿时，如果 `content_json` 为空，从模板重新生成
- 或者提供数据迁移脚本，基于 `form_data` 和模板内容生成 `content_json`

### Risk 2: 向后兼容

**风险**：现有代码可能依赖 `form_data` 字段

**缓解措施**：
- 保留 `form_data` 字段，但标记为废弃
- 逐步迁移相关代码到使用 `content_json`

### Risk 3: 性能影响

**风险**：`content_json` 可能比 `form_data` 更大，影响存储和传输

**缓解措施**：
- ProseMirror JSON 通常不会太大（几KB到几十KB）
- 使用数据库索引优化查询性能
- 考虑压缩存储（如果需要）

## Migration Plan

### Phase 1: 数据模型扩展
1. 添加数据库迁移，在 `DocumentDraft` 表中添加 `content_json` 字段
2. 更新模型定义和 Schema
3. 更新 API 接口

### Phase 2: 前端重构
1. 移除表单填写组件
2. 集成富文本编辑组件
3. 更新草稿加载和保存逻辑

### Phase 3: 数据迁移（可选）
1. 为现有草稿生成 `content_json`（基于模板和 `form_data`）
2. 验证数据完整性

## Open Questions

- 是否需要支持从旧草稿（只有 `form_data`）自动迁移到新格式？
- 是否需要在 UI 中显示草稿与模板的差异？

