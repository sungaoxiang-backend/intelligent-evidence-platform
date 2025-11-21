# 模板编辑器新架构说明

## 🎯 设计原则

### 核心问题
旧架构在**编辑模式**中将占位符渲染为不可编辑的组件（`contenteditable="false"`），导致：
- ❌ 光标无法在占位符之间自由移动
- ❌ 删除/回退行为不符合预期
- ❌ 复杂的键盘事件处理逻辑
- ❌ 状态管理复杂（8个状态变量）

### 解决方案：关注点分离

```
┌──────────────────────────────────────────────────┐
│  编辑模式 (Edit Mode)                              │
│  ├─ 占位符 = 纯文本 {{fieldKey}}                  │
│  ├─ 视觉高亮但不阻断编辑                           │
│  └─ 配置通过侧边栏进行                             │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  预览模式 (Preview Mode) = 查看 + 配置             │
│  ├─ 占位符渲染为可交互的 chip                      │
│  ├─ 点击 chip 快速配置                            │
│  └─ 显示丰富的元数据信息                          │
└──────────────────────────────────────────────────┘
```

---

## 📁 新组件结构

### 1. 编辑模式组件

#### `placeholder-highlight-extension.ts`
**轻量化占位符高亮扩展**
- ✅ 仅提供视觉高亮（黄色背景）
- ✅ 不设置 `contenteditable="false"`
- ✅ 不拦截键盘事件
- ✅ 占位符是普通文本，可以自由编辑

```typescript
// 使用示例
import { PlaceholderHighlightExtension } from "./placeholder-highlight-extension"

const editor = useEditor({
  extensions: [
    // ... 其他扩展
    PlaceholderHighlightExtension.configure({
      className: "placeholder-highlight",  // 自定义CSS类
      showTooltip: true,                   // 悬停显示提示
    }),
  ],
})
```

#### `document-editor-simple.tsx`
**简化版文档编辑器**
- ✅ 使用轻量高亮扩展
- ✅ 提供完整的格式化工具栏
- ✅ 自动提取并同步占位符列表
- ✅ 简单的状态管理

```tsx
// 使用示例
<DocumentEditorSimple
  initialContent={prosemirrorJson}
  onChange={(json) => setContent(json)}
  isLoading={isSaving}
/>
```

**编辑体验：**
- 占位符显示为 `{{fieldKey}}`，带黄色高亮
- 可以像编辑普通文本一样编辑占位符
- 删除、复制、粘贴行为自然
- 配置通过侧边栏 `PlaceholderList` 进行

---

### 2. 预览模式组件

#### `placeholder-preview-extension.ts`
**占位符预览扩展**
- ✅ 将 `{{fieldKey}}` 渲染为可交互的 chip
- ✅ 显示占位符图标、标签、必填标记
- ✅ 支持点击触发配置对话框
- ✅ 悬停高亮

```typescript
// 使用示例
import { PlaceholderPreviewExtension } from "./placeholder-preview-extension"

const editor = useEditor({
  extensions: [
    // ... 其他扩展
    PlaceholderPreviewExtension.configure({
      getPlaceholderMeta: (fieldKey) => {
        return {
          label: "姓名",
          fieldType: "text",
          description: "当事人姓名",
          required: true,
        }
      },
      onPlaceholderClick: (fieldKey) => {
        console.log("点击占位符:", fieldKey)
        // 打开配置对话框
      },
      onPlaceholderHover: (fieldKey) => {
        console.log("悬停占位符:", fieldKey)
      },
    }),
  ],
  editable: false, // 预览模式不可编辑
})
```

#### `document-preview-enhanced.tsx`
**增强版文档预览组件**
- ✅ 使用预览扩展渲染占位符为 chip
- ✅ 内置配置对话框
- ✅ 点击 chip 快速配置占位符
- ✅ 支持创建和编辑占位符

```tsx
// 使用示例
<PlaceholderProvider templateId={templateId}>
  <DocumentPreviewEnhanced
    content={prosemirrorJson}
    enablePlaceholderInteraction={true}  // 启用占位符交互
  />
</PlaceholderProvider>
```

**预览体验：**
- 占位符显示为彩色 chip（渐变色背景）
- 显示占位符图标（📝 📅 🔢 等）
- 点击 chip 打开配置对话框
- 未配置的占位符也可以点击快速创建

---

## 🎨 样式说明

### 编辑模式样式

```css
/* 轻量高亮 - 编辑模式 */
.placeholder-highlight {
  background-color: #fef3c7;     /* 黄色背景 */
  border-radius: 3px;
  padding: 1px 3px;
  color: #92400e;                /* 深棕色文字 */
  font-family: monospace;         /* 等宽字体 */
}

.placeholder-highlight:hover {
  background-color: #fde68a;     /* 悬停时加深 */
}
```

### 预览模式样式

```css
/* 可交互 chip - 预览模式 */
.placeholder-chip-preview {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.placeholder-chip-preview--hover {
  transform: translateY(-1px);   /* 悬停上浮 */
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
```

---

## 🔄 迁移指南

### 从旧组件迁移到新组件

#### 1. 编辑器迁移

**旧代码：**
```tsx
<DocumentEditor
  initialContent={content}
  onChange={setContent}
  isLoading={isLoading}
/>
```

**新代码：**
```tsx
<DocumentEditorSimple
  initialContent={content}
  onChange={setContent}
  isLoading={isLoading}
/>
```

#### 2. 预览组件迁移

**旧代码：**
```tsx
<DocumentPreview content={content} />
```

**新代码：**
```tsx
<PlaceholderProvider templateId={templateId}>
  <DocumentPreviewEnhanced
    content={content}
    enablePlaceholderInteraction={true}
  />
</PlaceholderProvider>
```

#### 3. 页面集成示例

```tsx
export default function TemplatePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [template, setTemplate] = useState(null)
  
  return (
    <PlaceholderProvider templateId={template?.id}>
      <div>
        {/* 模式切换按钮 */}
        <Button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? "预览" : "编辑"}
        </Button>
        
        {isEditing ? (
          <div className="grid grid-cols-12 gap-4">
            {/* 左侧：占位符管理 */}
            <div className="col-span-4">
              <PlaceholderList />
            </div>
            
            {/* 右侧：编辑器 */}
            <div className="col-span-8">
              <DocumentEditorSimple
                initialContent={template.content}
                onChange={(json) => setTemplate({ ...template, content: json })}
              />
            </div>
          </div>
        ) : (
          /* 预览模式：占位符可交互 */
          <DocumentPreviewEnhanced
            content={template.content}
            enablePlaceholderInteraction={true}
          />
        )}
      </div>
    </PlaceholderProvider>
  )
}
```

---

## ✅ 优势对比

| 特性 | 旧架构 | 新架构 |
|------|--------|--------|
| 占位符编辑 | ❌ 不可编辑，光标跳跃 | ✅ 像普通文本一样编辑 |
| 删除/回退 | ❌ 需要复杂的边界检测 | ✅ 自然的文本编辑行为 |
| 复制/粘贴 | ❌ 行为不可预测 | ✅ 行为自然 |
| 状态管理 | ❌ 8个状态变量 | ✅ 简化到2-3个 |
| 代码量 | ❌ 约1500行 | ✅ 约800行（减少47%） |
| 占位符配置 | ❌ 只能通过对话框 | ✅ 预览模式点击chip快速配置 |
| 用户体验 | ❌ 编辑受限 | ✅ 流畅自然 |

---

## 🧪 测试建议

### 1. 编辑模式测试

```typescript
describe("DocumentEditorSimple", () => {
  it("应该将占位符渲染为可编辑文本", () => {
    // 测试占位符可以被选中、编辑、删除
  })
  
  it("应该支持在占位符之间自由移动光标", () => {
    // 测试光标不会"跳跃"
  })
  
  it("应该支持删除占位符的部分内容", () => {
    // 测试可以删除 {{na 而不是整个 {{name}}
  })
  
  it("应该自动提取并同步占位符列表", () => {
    // 测试 extractPlaceholdersFromJSON 函数
  })
})
```

### 2. 预览模式测试

```typescript
describe("DocumentPreviewEnhanced", () => {
  it("应该将占位符渲染为可点击的chip", () => {
    // 测试 chip 渲染
  })
  
  it("点击chip应该打开配置对话框", () => {
    // 测试点击交互
  })
  
  it("应该显示占位符元数据（图标、标签）", () => {
    // 测试元数据显示
  })
})
```

---

## 📚 相关文件

### 核心文件
- `placeholder-highlight-extension.ts` - 编辑模式高亮扩展
- `placeholder-preview-extension.ts` - 预览模式交互扩展
- `document-editor-simple.tsx` - 简化编辑器
- `document-preview-enhanced.tsx` - 增强预览器
- `extensions.ts` - 样式定义

### 辅助文件
- `placeholder-manager.tsx` - 占位符状态管理
- `placeholder-list.tsx` - 占位符列表（侧边栏）
- `placeholder-form.tsx` - 占位符配置表单

### 页面集成
- `app/document-templates/page.tsx` - 模板管理页面
- `app/template-editor/page.tsx` - 独立编辑器页面

---

## 🔍 常见问题

### Q: 为什么要分离编辑和预览模式？
A: 编辑和配置是两个不同的关注点。编辑关注文档结构和内容，配置关注占位符元数据。分离后各自更专注，用户体验更好。

### Q: 旧的 DocumentEditor 会被删除吗？
A: 建议在新组件稳定后删除。在过渡期可以保留，使用功能开关切换。

### Q: 如何处理占位符重命名？
A: 在编辑模式直接修改文本（如 `{{name}}` → `{{fullName}}`），然后在侧边栏重新配置即可。

### Q: 预览模式下能编辑文档吗？
A: 预览模式是只读的，专注于查看和配置占位符。要编辑文档结构，需切换到编辑模式。

---

## 🚀 下一步计划

1. **性能优化**
   - 大文档的占位符提取优化
   - 使用虚拟滚动处理大量占位符

2. **功能增强**
   - 占位符自动补全
   - 占位符跳转导航
   - 批量配置占位符

3. **用户体验**
   - 键盘快捷键支持
   - 占位符拖拽排序
   - 占位符使用统计

---

**更新日期：** 2025-11-21  
**作者：** AI Assistant  
**版本：** 2.0

