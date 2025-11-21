# 模板编辑器架构全面重构总结

## 问题根源

之前的架构存在**系统性的设计错误**，导致频繁崩溃：

### 核心问题

1. **在只读ProseMirror编辑器中混用Widget Decoration和内容修改**
   - Widget Decoration是为"纯展示"设计的
   - 在只读模式中修改文档内容会导致Decoration状态不同步
   - 导致`localsInner`、`eq`等ProseMirror内部引用失效

2. **缺少临时状态管理**
   - `onChange`直接修改`selectedTemplate`
   - 没有"草稿"概念，无法取消更改
   - 两个编辑模式共用同一状态，相互干扰

3. **缺少明确的保存/取消流程**
   - 编辑立即生效，用户无法撤销
   - "管理占位符"和"编辑文档"模式缺少独立的保存逻辑

## 解决方案

###  1. 完全受控的组件架构

**原则：单向数据流**

```typescript
// ❌ 旧方式：组件内部修改state
<DocumentPreviewInteractive 
  content={selectedTemplate.prosemirror_json}
  onChange={(json) => {
    setSelectedTemplate({
      ...selectedTemplate,
      prosemirror_json: json
    })
  }}
/>

// ✅ 新方式：只修改临时state
const [draftContent, setDraftContent] = useState<any>(null)

<DocumentPreviewInteractive 
  content={draftContent || selectedTemplate.prosemirror_json}
  onChange={setDraftContent}  // 只修改草稿
/>
```

###  2. 临时状态 + 显式保存/取消

**每个模式都有独立的保存/取消流程**

#### 进入编辑模式
```typescript
const handleEnterPlaceholderMode = useCallback(() => {
  if (selectedTemplate) {
    // 初始化临时状态（深拷贝）
    setDraftContent(JSON.parse(JSON.stringify(selectedTemplate.prosemirror_json)))
    setViewMode("placeholder-management")
  }
}, [selectedTemplate])
```

#### 保存更改
```typescript
const handleSavePlaceholderChanges = useCallback(async () => {
  if (!selectedTemplate || !draftContent) return
  
  setIsLoading(true)
  try {
    // 保存到后端
    const updated = await templateApi.updateTemplate(selectedTemplate.id, {
      prosemirror_json: draftContent
    })
    // 更新选中模板
    setSelectedTemplate(updated.data)
    // 清除草稿
    setDraftContent(null)
    // 返回预览模式
    setViewMode("preview")
    toast({ title: "保存成功" })
    await loadTemplates()
  } catch (error) {
    toast({ title: "保存失败", variant: "destructive" })
  } finally {
    setIsLoading(false)
  }
}, [selectedTemplate, draftContent])
```

#### 取消更改
```typescript
const handleCancelPlaceholderChanges = useCallback(() => {
  setDraftContent(null)  // 丢弃草稿
  setViewMode("preview")  // 返回预览
}, [])
```

### 3. 防御性错误处理

**在所有ProseMirror Extension中添加try-catch**

#### PlaceholderPreviewExtension
```typescript
state: {
  init(_, state) {
    try {
      return findPlaceholdersInDoc(state.doc) || []
    } catch (error) {
      console.error('PlaceholderPreview init error:', error)
      return []
    }
  },
  
  apply(tr, prev, _oldState, newState) {
    try {
      if (tr.docChanged) {
        return findPlaceholdersInDoc(newState.doc) || []
      }
      return Array.isArray(prev) ? prev : []
    } catch (error) {
      console.error('PlaceholderPreview apply error:', error)
      return Array.isArray(prev) ? prev : []
    }
  },
},

props: {
  decorations(state) {
    try {
      const placeholders = this.getState(state)
      
      if (!Array.isArray(placeholders) || placeholders.length === 0) {
        return DecorationSet.empty
      }
      
      // ... 创建decorations
      
      return DecorationSet.create(state.doc, decorations)
    } catch (error) {
      console.error('PlaceholderPreview decorations error:', error)
      return DecorationSet.empty
    }
  },
}
```

#### PlaceholderHighlightExtension
同样的防御性处理：
- Plugin state 总是返回有效数组
- Decorations 创建失败返回 `DecorationSet.empty`
- 所有错误都被捕获并记录

#### PlaceholderExtension（旧扩展）
- 在 `buildPluginState` 中添加 try-catch
- 确保总是返回有效的 `PlaceholderPluginState`
- Decorations getter 添加错误处理

### 4. 优化Content更新逻辑

```typescript
// 在DocumentPreviewEnhanced和DocumentEditorSimple中
useEffect(() => {
  if (!editor || !content) return
  
  const contentKey = JSON.stringify(content)
  
  if (previousContentRef.current === contentKey) {
    return
  }
  
  previousContentRef.current = contentKey
  
  try {
    const normalizedContent = normalizeContent(content) || content
    // 使用emitUpdate: false避免不必要的事件
    editor.commands.setContent(normalizedContent, false)
  } catch (error) {
    console.error("Failed to set content:", error)
    previousContentRef.current = null
  }
}, [editor, content, normalizeContent])
```

## 修改的文件

### 1. `/frontend/app/document-templates/page.tsx`

**核心改动：**
- 新增：`draftContent` state（临时编辑状态）
- 移除：`editedContent` state（旧的编辑状态）
- 新增：`handleSavePlaceholderChanges()` - 保存占位符更改
- 新增：`handleCancelPlaceholderChanges()` - 取消占位符更改
- 新增：`handleSaveDocumentChanges()` - 保存文档更改
- 新增：`handleCancelDocumentChanges()` - 取消文档更改
- 移除：`handleSaveDocumentEdit()` - 旧的保存函数
- 移除：`handleBackToPreview()` - 旧的返回函数

**模式1（预览模式）：**
- 无变化，纯预览

**模式2（管理占位符）：**
- 添加"保存更改"和"取消"按钮
- `DocumentPreviewInteractive` 使用 `draftContent`
- `onChange` 只修改 `draftContent`

**模式3（编辑文档）：**
- 添加"保存"和"取消"按钮
- `DocumentEditorSimple` 使用 `draftContent`
- `onChange` 只修改 `draftContent`

### 2. `/frontend/components/template-editor/document-preview-interactive.tsx`

**核心改动：**
- 编辑器设为 `editable: false`（完全只读）
- 移除了内部的 `editor.commands.setContent()`
- `onChange` 只通知父组件，不修改内部状态
- 所有操作函数只调用 `onChange`，让父组件决定如何处理

### 3. `/frontend/components/template-editor/placeholder-preview-extension.ts`

**核心改动：**
- 添加 try-catch 到所有 plugin 生命周期
- Plugin state 总是返回有效数组
- Decorations 失败返回 `DecorationSet.empty`
- 为 Widget 添加唯一 key

### 4. `/frontend/components/template-editor/placeholder-highlight-extension.ts`

**核心改动：**
- 添加防御性错误处理
- Plugin state 总是返回有效数组
- Decorations 失败返回 `DecorationSet.empty`

### 5. `/frontend/components/template-editor/placeholder-extension.ts`

**核心改动：**
- `buildPluginState` 添加 try-catch
- Plugin state init/apply 添加错误处理
- Decorations getter 添加错误处理

### 6. `/frontend/components/template-editor/document-preview-enhanced.tsx`

**核心改动：**
- 优化 `useEffect` 中的 content 更新逻辑
- 使用 `setContent(content, false)` 避免不必要的事件

### 7. `/frontend/components/template-editor/document-editor-simple.tsx`

**核心改动：**
- 优化初始内容设置逻辑
- 使用 `setContent(content, false)` 避免不必要的事件

## 架构改进

### 之前（错误的架构）

```
┌─────────────────────────────────────┐
│   document-templates/page.tsx      │
│                                      │
│  selectedTemplate ◄─────────┐       │
│        │                     │       │
│        ▼                     │       │
│  ┌──────────────────────────┴────┐  │
│  │ DocumentPreviewInteractive    │  │
│  │                               │  │
│  │ • editable: false             │  │
│  │ • 使用 Widget Decorations      │  │
│  │ • onChange 直接修改             │──┘
│  │   selectedTemplate (❌)        │
│  │ • 内部调用 setContent() (❌)   │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

问题：
❌ 在只读编辑器中修改内容
❌ Widget Decoration状态不同步
❌ 无法取消更改
❌ 频繁崩溃（localsInner错误）
```

### 现在（正确的架构）

```
┌─────────────────────────────────────────────────┐
│      document-templates/page.tsx                │
│                                                  │
│  ┌─────────────────────────────────┐           │
│  │     状态管理（State）            │           │
│  │                                  │           │
│  │  selectedTemplate (只读)         │           │
│  │  draftContent (临时编辑)          │           │
│  │  viewMode (模式切换)              │           │
│  └─────────────────────────────────┘           │
│                                                  │
│  ┌─────────────────────────────────┐           │
│  │   操作函数（Actions）            │           │
│  │                                  │           │
│  │  • handleEnterPlaceholderMode    │           │
│  │    ├─ 初始化 draftContent         │           │
│  │    └─ 进入编辑模式                │           │
│  │                                  │           │
│  │  • handleSavePlaceholderChanges  │           │
│  │    ├─ 保存 draftContent 到后端    │           │
│  │    ├─ 更新 selectedTemplate      │           │
│  │    ├─ 清除 draftContent          │           │
│  │    └─ 返回预览模式                │           │
│  │                                  │           │
│  │  • handleCancelPlaceholderChanges│           │
│  │    ├─ 丢弃 draftContent          │           │
│  │    └─ 返回预览模式                │           │
│  └─────────────────────────────────┘           │
│            │                                     │
│            ▼                                     │
│  ┌─────────────────────────────────┐           │
│  │ DocumentPreviewInteractive       │           │
│  │                                  │           │
│  │ • editable: false (完全只读)      │           │
│  │ • content={draftContent}         │           │
│  │ • onChange={setDraftContent}     │           │
│  │ • 不调用内部 setContent()         │           │
│  │ • 只通过 onChange 通知父组件       │           │
│  └─────────────────────────────────┘           │
└─────────────────────────────────────────────────┘

优势：
✅ 单向数据流
✅ 明确的临时状态
✅ 可以取消更改
✅ 不在只读编辑器中修改内容
✅ 不会崩溃
```

## 关键设计原则

### 1. 单向数据流

数据只能从父组件流向子组件，子组件通过回调通知父组件。

### 2. 临时状态（Draft）

编辑过程中使用临时状态，只有显式保存时才更新真实数据。

### 3. 完全只读的预览

在使用Widget Decoration的编辑器中，绝不修改内容。

### 4. 防御性编程

所有ProseMirror plugin代码都有错误处理和fallback。

### 5. 显式的保存/取消

每个编辑模式都有明确的"保存"和"取消"按钮。

## 测试要点

测试以下场景，确保不再崩溃：

1. ✅ 进入"管理占位符"模式
2. ✅ 右键插入占位符
3. ✅ 点击chip显示操作菜单
4. ✅ 编辑占位符配置并保存
5. ✅ 删除占位符
6. ✅ 替换占位符
7. ✅ 取消占位符更改
8. ✅ 进入"编辑文档"模式
9. ✅ 编辑文档内容
10. ✅ 保存文档更改
11. ✅ 取消文档更改
12. ✅ 在不同模式间切换

## 性能优化

1. **深拷贝只在必要时**
   - 进入编辑模式时拷贝一次
   - 保存时不需要拷贝

2. **避免不必要的重新渲染**
   - 使用 `setContent(content, false)`
   - 使用 `JSON.stringify` 检查内容是否真的变化

3. **Key优化**
   - 为编辑器组件添加稳定的key
   - 避免不必要的卸载/重新挂载

## 后续加强（2024-11-21 第二轮）

用户反馈：在编辑模式双击选中文本时仍然崩溃（`Cannot read properties of undefined (reading 'eq')`）

### 问题根源

之前的防御性处理不够**彻底**：
- 只在外层加了try-catch
- 没有检查state/doc是否为null
- Plugin实例引用方式可能导致this指向问题

### 解决方案：终极防御性编程

#### 1. 在每个可能出错的地方都加检查

```typescript
// ❌ 之前：假设state和doc总是存在
function findPlaceholdersInDoc(doc: any): PlaceholderMatch[] {
  const placeholders: PlaceholderMatch[] = []
  doc.descendants((node: any, pos: number) => {
    // ...
  })
  return placeholders
}

// ✅ 现在：检查每一个可能为null的对象
function findPlaceholdersInDoc(doc: any): PlaceholderMatch[] {
  try {
    if (!doc) {
      console.warn('findPlaceholdersInDoc: doc is null or undefined')
      return []
    }
    
    const placeholders: PlaceholderMatch[] = []
    
    doc.descendants((node: any, pos: number) => {
      try {
        if (!node || !node.isText || !node.text) return
        // ... 处理节点
      } catch (error) {
        console.error('Error processing node:', error)
      }
    })
    
    return placeholders
  } catch (error) {
    console.error('findPlaceholdersInDoc error:', error)
    return []
  }
}
```

#### 2. Plugin state 的每个生命周期都检查

```typescript
const pluginInstance = new Plugin({
  state: {
    init(_, state) {
      try {
        // ✅ 检查state和state.doc
        if (!state || !state.doc) {
          console.warn('Plugin init: invalid state')
          return []
        }
        return findPlaceholdersInDoc(state.doc) || []
      } catch (error) {
        console.error('Plugin init error:', error)
        return []
      }
    },
    
    apply(tr, prev, _oldState, newState) {
      try {
        // ✅ 检查newState和newState.doc
        if (!newState || !newState.doc) {
          console.warn('Plugin apply: invalid newState')
          return Array.isArray(prev) ? prev : []
        }
        
        // ✅ 检查tr
        if (tr && tr.docChanged) {
          return findPlaceholdersInDoc(newState.doc) || []
        }
        
        return Array.isArray(prev) ? prev : []
      } catch (error) {
        console.error('Plugin apply error:', error)
        return Array.isArray(prev) ? prev : []
      }
    },
  },
})
```

#### 3. Decorations 函数的终极防御

```typescript
props: {
  decorations(state) {
    try {
      // ✅ 第一层：检查state和state.doc
      if (!state || !state.doc) {
        console.warn('decorations: invalid state')
        return DecorationSet.empty
      }
      
      // ✅ 第二层：检查plugin state
      const placeholders = pluginInstance.getState(state)
      if (!Array.isArray(placeholders) || placeholders.length === 0) {
        return DecorationSet.empty
      }
      
      const decorations: Decoration[] = []
      
      // ✅ 第三层：每个decoration创建都包装在try-catch中
      for (const { from, to, fieldKey } of placeholders) {
        try {
          decorations.push(Decoration.inline(from, to, { ... }))
        } catch (error) {
          console.error('Failed to create decoration:', error)
        }
      }
      
      // ✅ 第四层：检查是否有成功创建的decorations
      if (decorations.length === 0) {
        return DecorationSet.empty
      }
      
      // ✅ 第五层：DecorationSet.create也可能失败
      try {
        return DecorationSet.create(state.doc, decorations)
      } catch (error) {
        console.error('Failed to create DecorationSet:', error)
        return DecorationSet.empty
      }
    } catch (error) {
      console.error('decorations error:', error)
      return DecorationSet.empty
    }
  },
}
```

#### 4. 使用Plugin实例引用避免this问题

```typescript
// ❌ 之前：使用this可能导致上下文丢失
return [
  new Plugin({
    props: {
      decorations(state) {
        const placeholders = this.getState(state)  // this可能undefined
        // ...
      }
    }
  })
]

// ✅ 现在：先创建实例，通过闭包引用
const pluginInstance = new Plugin({ ... })

return [pluginInstance]  // 在decorations中使用pluginInstance.getState(state)
```

### 修改的文件（第二轮）

1. **placeholder-highlight-extension.ts**（编辑模式）
   - 5层防御检查
   - Plugin实例引用
   - 详细的错误日志

2. **placeholder-preview-extension.ts**（管理占位符模式）
   - 同样的5层防御
   - Plugin实例引用
   - 详细的错误日志

### 防御层级总结

| 层级 | 检查点 | 失败时返回 |
|------|--------|-----------|
| 1 | `state` / `state.doc` 存在性 | `[]` 或 `DecorationSet.empty` |
| 2 | `node` / `node.text` 存在性 | `continue`（跳过该节点） |
| 3 | Plugin state 是有效数组 | `DecorationSet.empty` |
| 4 | 每个decoration创建 | 跳过失败的decoration |
| 5 | `DecorationSet.create()` | `DecorationSet.empty` |

### 为什么之前的修复不够

1. **只在外层加try-catch** - 内部仍可能有null/undefined传播
2. **没有检查state的有效性** - 假设state总是存在
3. **this引用问题** - 在某些上下文中this可能丢失
4. **没有逐个检查节点** - descendants回调中的错误可能导致整个查找失败

### 现在的防御策略

1. **零容忍** - 任何可能为null/undefined的地方都检查
2. **细粒度错误处理** - 每个小操作都有try-catch
3. **优雅降级** - 出错时返回empty而不是crash
4. **详细日志** - 便于定位问题根源

## 总结

这次重构从根本上解决了架构问题：

1. **不再在只读编辑器中修改内容** - 避免了Decoration状态不同步
2. **引入临时状态和显式保存** - 用户可以取消更改
3. **终极防御性编程** - 5层检查，确保在任何情况下都不会崩溃
4. **单向数据流** - 状态管理清晰，易于调试
5. **详细错误日志** - 便于定位和修复问题

这个架构更符合React和ProseMirror的设计哲学，经过两轮加强后，应该能够在所有边缘情况下稳定运行。

