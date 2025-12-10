# Design: Table Row Export Control

## Context

文书模板使用ProseMirror JSON格式存储，其中表格由`table`节点包含多个`tableRow`节点组成。每个`tableRow`包含多个`tableCell`节点。在导出文档时，需要能够根据用户选择，控制某些行是否包含在最终导出的DOCX文档中。

## Goals

- 支持在表格行级别控制是否包含在导出中
- 保持向后兼容性（现有模板无需修改即可正常工作）
- 提供直观的UI让用户在文书生成时控制行的导出状态
- 同时支持陈述式和要素式模板

## Non-Goals

- 不支持单元格级别的导出控制（仅支持行级别）
- 不支持在模板编辑器中设置默认的导出状态（仅在文书生成时控制）

## Decisions

### Decision 1: 使用`exportEnabled`属性

**What**: 在`tableRow`节点的`attrs`中添加`exportEnabled` boolean属性。

**Why**: 
- 符合ProseMirror的扩展模式
- 属性存储在JSON中，便于序列化和持久化
- 默认值为`true`，确保向后兼容

**Alternatives considered**:
- 使用单独的配置对象：增加了复杂性，需要额外的数据同步
- 使用行ID映射：需要额外的数据结构，不够直观

### Decision 2: 在导出时过滤行

**What**: 在`_replace_placeholders_in_json`方法中，遍历表格时检查每行的`exportEnabled`属性，如果为`false`则跳过该行。

**Why**:
- 集中处理逻辑，易于维护
- 在占位符替换之前过滤，避免不必要的处理
- 确保过滤后的JSON结构正确

**Alternatives considered**:
- 在DOCX导出时过滤：需要在ProseMirror到DOCX的映射中处理，逻辑分散
- 在表单提交时过滤：需要修改表单数据结构，影响面大

### Decision 3: UI控件位置和样式

**What**: 在每个表格行的左侧或上方添加checkbox控件，标签为"包含在导出中"。

**Why**:
- Checkbox是标准的开关控件，用户理解成本低
- 位置靠近行内容，关联性强
- 不影响现有的表单布局

**Alternatives considered**:
- 在行内添加toggle：可能干扰表格内容
- 在表格外部添加控制面板：关联性弱，用户体验差

### Decision 4: 状态管理方式

**What**: 在表单组件中维护一个Map，键为行路径（在JSON中的位置），值为`exportEnabled`状态。当用户切换时，直接更新ProseMirror JSON中对应行的属性。

**Why**:
- 状态与JSON结构同步，避免数据不一致
- 使用路径作为键，可以唯一标识每行
- 更新JSON后触发重新渲染，UI自动更新

**Alternatives considered**:
- 使用独立的状态对象：需要额外的同步逻辑
- 使用表单数据存储：与表单数据混合，逻辑不清

## Risks / Trade-offs

### Risk 1: 向后兼容性

**Risk**: 现有模板没有`exportEnabled`属性，可能导致导出时所有行被过滤。

**Mitigation**: 
- 在检查`exportEnabled`时，如果属性不存在，默认视为`true`
- 添加单元测试验证向后兼容性

### Risk 2: 性能影响

**Risk**: 在大型表格中，频繁更新JSON可能导致性能问题。

**Mitigation**:
- 使用React的优化技术（如useMemo、useCallback）
- 只在用户交互时更新，避免不必要的重新渲染
- 如果性能成为问题，考虑使用虚拟化或延迟更新

### Risk 3: 用户体验

**Risk**: 用户可能不理解导出控制的作用，或者误操作导致重要内容被排除。

**Mitigation**:
- 提供清晰的标签和提示文本
- 考虑添加确认对话框（如果行包含重要内容）
- 在文档预览中提供视觉反馈（如禁用行的样式）

## Migration Plan

1. **阶段1：数据结构支持**
   - 添加`exportEnabled`属性到TableRow扩展
   - 更新映射器支持新属性（向后兼容）

2. **阶段2：导出逻辑**
   - 实现过滤逻辑
   - 添加单元测试

3. **阶段3：前端UI**
   - 实现UI控件
   - 实现状态管理
   - 添加端到端测试

4. **阶段4：优化和测试**
   - 性能优化
   - 用户体验优化
   - 完整测试覆盖

## Open Questions

- [ ] 是否需要支持批量操作（如"全选/全不选"）？
- [ ] 是否需要在模板编辑器中显示导出控制（只读模式）？
- [ ] 是否需要在导出的文档中添加注释说明某些行被排除？

