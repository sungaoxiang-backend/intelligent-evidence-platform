# Implementation Plan

- [X] 
  - [X] 1.1 修复 `rgb_to_hex`/`hex_to_rgb` 颜色转换并补充单元测试，确保 run.font.color 任意类型都不抛错。 _Requirements: 1.1_
  - [X] 1.2 扩展 `DocxToProseMirrorMapper` 段落/文本映射：捕获 `textAlign`, `spacing`, `indent`, `fontFamily`, `fontSize`, `color`, `list` 等完整属性，并为未知样式打 `__fallback` 标志。 _Requirements: 2.1_
  - [X] 1.3 增强表格解析：记录 `colWidths`, `cellWidth`, `border`, `shading`, `verticalAlign`，并针对合并单元格写入 attrs。 _Requirements: 2.3_
  - [X] 1.4 编写 round-trip unit tests：docx→JSON→docx→JSON，验证样式保持。 _Requirements: 3.3_
- [X] 
  - [X] 2.1 根据 JSON attrs 设置 `ParagraphFormat`、`Font`、列表编号，不再全局覆盖 Normal 样式。 _Requirements: 3.1_
  - [X] 2.2 使用 `colWidths`/`cellWidth` 重建 `tblGrid` 和 `tcW`，支持背景色、边框与合并。 _Requirements: 2.3, 3.1_
  - [X] 2.3 为导出阶段添加结构化日志和降级提示，确保失败时包含 element path。 _Requirements: 4.1_
- [X] 
  - [X] 3.1 重构 `DocumentEditor`/`DocumentPreview` 扩展：加载解析出的样式属性并生成对应 inline style；移除硬编码字体/表格 class。 _Requirements: 2.2_
  - [X] 3.2 新增样式控制面板（字体、字号、颜色、行距、缩进、列表），更新 JSON schema 并与后端对齐。 _Requirements: 2.2, 3.1_
  - [X] 3.3 为前端添加单元测试（Jest/RTL）验证渲染样式与 JSON 匹配。 _Requirements: 2.2_
- [ ] 
  - [X] 4.1 上传/导出接口增加错误 detail（包含 element path），前端显示友好提示。 _Requirements: 4.1, 4.2_
  - [X] 4.2 （可选）创建 `DocxMappingLog` 或集中日志 hook，汇总 parse/export 降级信息。 _Requirements: 4.1_
  - [ ] 4.3 Playwright/E2E：上传复杂 docx、预览、导出再回传，验证视觉一致性。 _Requirements: 3.3_
