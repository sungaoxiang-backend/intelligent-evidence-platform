## 1. 数据模型和结构

- [x] 1.1 在ProseMirror TableRow扩展中添加`exportEnabled`属性
  - 默认值为`true`以保持向后兼容
  - 支持在attrs中存储和读取

- [x] 1.2 更新模板映射器以支持`exportEnabled`属性（可选）
  - 确保从DOCX导入时，新属性有默认值
  - 确保向后兼容性

## 2. 后端导出逻辑

- [x] 2.1 修改`_replace_placeholders_in_json`方法
  - 在遍历表格行时，检查`exportEnabled`属性
  - 如果`exportEnabled`为`false`，跳过该行（不包含在导出的JSON中）
  - 确保过滤逻辑同时适用于陈述式和要素式模板

- [ ] 2.2 添加单元测试验证导出过滤逻辑
  - 测试包含`exportEnabled: false`的行被正确过滤
  - 测试默认行为（未设置属性时包含所有行）
  - 测试混合场景（部分行启用，部分行禁用）

## 3. 前端UI实现

- [ ] 3.1 在文书生成表单中识别表格行
  - 在`DocumentPreviewForm`组件中，遍历ProseMirror JSON识别所有`tableRow`节点
  - 为每个表格行生成唯一标识符

- [ ] 3.2 为每个表格行添加导出控制UI
  - 在表格行附近添加checkbox或toggle控件
  - 控件标签应清晰表明其作用（如"包含在导出中"）
  - 默认状态为选中（`exportEnabled: true`）

- [ ] 3.3 实现状态管理
  - 在表单状态中维护每行的`exportEnabled`状态
  - 当用户切换控件时，更新ProseMirror JSON中对应行的`exportEnabled`属性
  - 确保状态变化能正确反映到表单数据中

- [ ] 3.4 更新表格行渲染组件
  - 在`NarrativeTableCell`组件中支持显示导出控制
  - 在`ReplicableTableCellWithAttrs`组件中支持显示导出控制
  - 确保UI在不同模板类型下都能正常工作

## 4. 集成和测试

- [ ] 4.1 端到端测试
  - 测试陈述式模板的行级导出控制
  - 测试要素式模板的行级导出控制
  - 验证导出的DOCX文档中不包含被禁用的行

- [ ] 4.2 向后兼容性验证
  - 验证现有模板（没有`exportEnabled`属性）仍能正常导出
  - 验证现有模板的所有行默认包含在导出中

- [ ] 4.3 用户体验优化
  - 确保UI控件位置合理，不干扰表单填写
  - 添加适当的视觉反馈（如禁用行的视觉提示）
  - 考虑添加批量操作（如"全选/全不选"）

