# 占位符交互修复总结

## 问题诊断

### 根本原因

在ProseMirror中，**Widget装饰（`Decoration.widget`）与编辑功能混合使用会产生严重的交互冲突**：

1. **光标定位异常**：Widget创建的DOM元素会打断文本流，导致光标无法正常定位在占位符前后
2. **事件处理冲突**：Widget的事件处理与编辑器的事件处理相互干扰
3. **焦点管理混乱**：对话框打开时，编辑器的焦点管理与DOM焦点管理冲突
4. **半编辑状态不稳定**：ProseMirror不是为"半编辑"状态设计的

### 具体表现

- ✗ 光标在占位符前后无法显示/闪烁
- ✗ 双击后打开的对话框中，按钮点击失效
- ✗ 插入操作后光标焦点移动到错误位置
- ✗ 缺少删除、替换占位符的交互

## 解决方案

### 设计原则

**彻底分离编辑和预览**，不再追求"半编辑"状态：

1. **预览模式完全只读**：`editable: false`，避免所有光标相关问题
2. **通过明确的交互操作**：右键菜单、点击chip菜单，而不是依赖编辑器事件
3. **手动管理文档更新**：使用ProseMirror Transaction API直接操作文档

### 核心改动

#### 1. 编辑器设为只读（`document-preview-interactive.tsx`）

```typescript
const editor = useEditor({
  // ...
  editable: false, // ✅ 完全只读，避免widget与编辑冲突
  editorProps: {
    attributes: {
      class: "template-doc",
      style: "padding: 16px; cursor: default;", // 改为默认光标
    },
    // ✅ 移除了 handleDoubleClick
  },
  // ✅ 移除了 onUpdate（只读模式下不会有更新）
})
```

#### 2. Chip点击显示操作菜单（`placeholder-preview-extension.ts`）

```typescript
// 修改接口：传递完整的MouseEvent以便定位菜单
onPlaceholderClick?: (fieldKey: string, event: MouseEvent) => void

// 创建chip时添加点击事件
chip.addEventListener("click", (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  onClick(fieldKey, e) // 传递event
})

// ✅ 移除了 stopEvent: () => true，允许事件传播
```

#### 3. 实现Chip操作菜单（`document-preview-interactive.tsx`）

**菜单选项：**
- **编辑配置**：打开配置对话框修改占位符元数据
- **替换为其他占位符**：将所有该占位符替换为另一个
- **删除占位符**：从文档中删除所有该占位符实例

**实现：**
```typescript
const handlePlaceholderClick = useCallback((fieldKey: string, event: MouseEvent) => {
  // 显示操作菜单
  setChipMenuFieldKey(fieldKey)
  setChipMenuPosition({ x: event.clientX, y: event.clientY })
  setChipMenuOpen(true)
}, [])
```

#### 4. 右键菜单插入（`document-preview-interactive.tsx`）

```typescript
const handleContextMenu = useCallback((event: React.MouseEvent) => {
  if (!editor) return
  
  // 记录点击位置（用于插入）
  const pos = editor.view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  })
  
  if (pos) {
    setInsertPosition(pos.pos)
  }
}, [editor])
```

#### 5. 手动操作文档（`document-preview-interactive.tsx`）

**插入占位符：**
```typescript
const { tr } = editor.state
tr.insertText(`{{${fieldKey}}}`, insertPosition)
editor.view.dispatch(tr)
onChange?.(editor.getJSON())
```

**删除占位符：**
```typescript
// 1. 查找所有匹配的占位符
doc.descendants((node, pos) => {
  if (node.isText && node.text) {
    const regex = new RegExp(`\\{\\{${fieldKey}\\}\\}`, 'g')
    let match
    while ((match = regex.exec(node.text)) !== null) {
      positions.push({ from: pos + match.index, to: pos + match.index + match[0].length })
    }
  }
})

// 2. 从后往前删除（避免位置偏移）
positions.reverse().forEach(({ from, to }) => {
  tr.delete(from, to)
})
```

**替换占位符：**
```typescript
// 查找 + 删除 + 插入
positions.reverse().forEach(({ from, to }) => {
  tr.delete(from, to)
  tr.insertText(`{{${newFieldKey}}}`, from)
})
```

## 新的交互流程

### 1. 插入占位符

**步骤：**
1. 右键点击文档中的任意位置
2. 选择"在此位置插入占位符"
3. 在对话框中搜索已有占位符或创建新的
4. 选择/创建后自动插入

**优势：**
- ✅ 明确的操作入口
- ✅ 不依赖编辑器焦点
- ✅ 位置精确可控

### 2. 编辑占位符配置

**步骤：**
1. 点击彩色chip
2. 在弹出的菜单中选择"编辑配置"
3. 修改元数据并保存

**优势：**
- ✅ 直观的视觉反馈
- ✅ 快速访问配置

### 3. 替换占位符

**步骤：**
1. 点击要替换的chip
2. 选择"替换为其他占位符"
3. 在对话框中选择新的占位符
4. 自动替换文档中所有该占位符实例

**优势：**
- ✅ 批量替换
- ✅ 避免手动查找

### 4. 删除占位符

**步骤：**
1. 点击要删除的chip
2. 选择"删除占位符"
3. 自动删除文档中所有该占位符实例

**优势：**
- ✅ 批量删除
- ✅ 防止遗漏

## 技术要点

### 1. 完全只读的预览模式

```typescript
editable: false
```

**好处：**
- ✅ 没有光标，不会有光标定位问题
- ✅ Widget不会干扰编辑体验
- ✅ 性能更好（不需要处理编辑事件）

### 2. 手动管理文档更新

```typescript
const { tr } = editor.state
// 修改transaction
editor.view.dispatch(tr)
// 手动触发onChange
onChange?.(editor.getJSON())
```

**好处：**
- ✅ 完全可控的文档操作
- ✅ 可以实现复杂的批量操作
- ✅ 不依赖编辑器的自动更新机制

### 3. Widget装饰不阻止事件

```typescript
Decoration.widget(from, chip, {
  side: 0,
  marks: [],
  // ⚠️ 不使用 stopEvent，让chip的点击事件正常传播
})
```

**好处：**
- ✅ Chip的点击事件正常工作
- ✅ 可以显示操作菜单

### 4. 悬浮菜单定位

```typescript
<div
  className="fixed z-50 ..."
  style={{
    left: `${chipMenuPosition.x}px`,
    top: `${chipMenuPosition.y}px`,
  }}
>
```

**好处：**
- ✅ 不依赖ProseMirror的插件系统
- ✅ 可以使用React组件
- ✅ 定位精确

## 解决的问题

- ✅ **光标问题**：完全只读，没有光标
- ✅ **按钮失效问题**：不依赖编辑器焦点，对话框按钮正常工作
- ✅ **焦点移动问题**：手动管理，不会意外移动
- ✅ **删除占位符**：实现了批量删除功能
- ✅ **替换占位符**：实现了批量替换功能

## 用户体验改进

### 操作更明确
- 右键菜单清晰提示"在此位置插入占位符"
- Chip点击显示明确的操作选项

### 批量操作
- 替换：一次性替换所有实例
- 删除：一次性删除所有实例

### 视觉反馈
- Chip悬停高亮
- 操作菜单位置跟随鼠标
- Toast提示操作结果

## 文件清单

修改的文件：
1. `frontend/components/template-editor/document-preview-interactive.tsx`
   - 改为只读模式
   - 添加chip操作菜单
   - 实现删除、替换功能
   - 优化插入逻辑

2. `frontend/components/template-editor/placeholder-preview-extension.ts`
   - 修改onClick接口，传递MouseEvent
   - 移除stopEvent，允许事件传播
   - 更新tooltip提示

## 后续优化建议

1. **添加撤销/重做功能**（可选）
   - 利用ProseMirror的history插件
   
2. **拖拽插入**（高级功能）
   - 从左侧占位符列表拖拽到预览区域
   - 需要实现drag & drop逻辑
   
3. **占位符高亮**（可选）
   - 悬停chip时，高亮文档中所有该占位符实例
   
4. **后端API扩展**
   - 添加"替换"端点（批量更新模板-占位符关联）
   - 当前使用前端逻辑替换，后端可以优化

## Bug修复（2024-11-21）

### 问题1：删除占位符时误删其他占位符

**原因：**
- 直接在只读编辑器上使用Transaction API修改文档
- Decoration插件的状态与文档状态不同步
- 导致Widget装饰的位置引用失效

**修复：**
使用**JSON操作 + 完整重新渲染**的方式：

```typescript
// ❌ 错误方式：直接修改Transaction
const { tr } = editor.state
tr.delete(from, to)
editor.view.dispatch(tr)

// ✅ 正确方式：修改JSON content
const currentContent = editor.getJSON()
const { content: newContent, count } = replaceTextInContent(
  currentContent,
  `{{${chipMenuFieldKey}}}`,
  ''
)
editor.commands.setContent(newContent) // 触发完整重新渲染
```

### 问题2：页面崩溃（DecorationGroup错误）

**原因：**
- 在只读编辑器中手动dispatch transaction
- Decoration的localsInner引用变为undefined
- ProseMirror内部状态不一致

**修复：**
通过`editor.commands.setContent()`触发完整的内容更新，让ProseMirror正确重建Decoration：

```typescript
// 完整的替换流程
1. editor.getJSON() - 获取当前JSON
2. replaceTextInContent() - 在JSON中操作
3. editor.commands.setContent() - 设置新内容
4. onChange?.(newContent) - 通知外部
```

### 问题3：正则表达式需要转义

**原因：**
如果字段名包含正则特殊字符（如`.`、`*`、`+`等），会导致误匹配。

**修复：**
添加`escapeRegex`函数转义特殊字符：

```typescript
const escapeRegex = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 使用
const regex = new RegExp(escapeRegex(searchPattern), 'g')
```

## 核心改进

### 1. 安全的文档操作

**replaceTextInContent**：在JSON中替换文本

```typescript
const replaceTextInContent = (
  content: JSONContent,
  searchPattern: string,
  replacement: string
): { content: JSONContent; count: number } => {
  let count = 0
  
  const replaceInNode = (node: JSONContent): JSONContent => {
    if (node.type === 'text' && node.text) {
      const regex = new RegExp(escapeRegex(searchPattern), 'g')
      const newText = node.text.replace(regex, (match) => {
        count++
        return replacement
      })
      return { ...node, text: newText }
    }
    
    if (node.content && Array.isArray(node.content)) {
      return {
        ...node,
        content: node.content.map(replaceInNode),
      }
    }
    
    return node
  }
  
  return { content: replaceInNode(content), count }
}
```

**insertTextAtPosition**：在指定位置插入文本

```typescript
const insertTextAtPosition = (
  content: JSONContent,
  position: number,
  text: string
): JSONContent => {
  const state = { currentPos: 0, inserted: false }
  
  const insertInNode = (node: JSONContent): JSONContent => {
    if (state.inserted) return node
    
    if (node.type === 'text' && node.text) {
      const nodeStart = state.currentPos
      const nodeEnd = state.currentPos + node.text.length
      
      if (position >= nodeStart && position <= nodeEnd) {
        const offset = position - nodeStart
        const newText = 
          node.text.substring(0, offset) + 
          text + 
          node.text.substring(offset)
        state.currentPos = nodeEnd + text.length
        state.inserted = true
        return { ...node, text: newText }
      }
      
      state.currentPos = nodeEnd
      return node
    }
    
    // 递归处理子节点
    if (node.content && Array.isArray(node.content)) {
      const newContent: JSONContent[] = []
      for (const child of node.content) {
        newContent.push(insertInNode(child))
        if (state.inserted) {
          newContent.push(...node.content.slice(newContent.length))
          break
        }
      }
      return { ...node, content: newContent }
    }
    
    return node
  }
  
  return insertInNode(content)
}
```

### 2. 更新后的操作流程

**删除占位符：**
```typescript
const currentContent = editor.getJSON()
const { content: newContent, count } = replaceTextInContent(
  currentContent,
  `{{${fieldKey}}}`,
  '' // 替换为空字符串
)
editor.commands.setContent(newContent)
onChange?.(newContent)
```

**替换占位符：**
```typescript
const currentContent = editor.getJSON()
const { content: newContent, count } = replaceTextInContent(
  currentContent,
  `{{${oldFieldKey}}}`,
  `{{${newFieldKey}}}`
)
editor.commands.setContent(newContent)
onChange?.(newContent)
```

**插入占位符：**
```typescript
const currentContent = editor.getJSON()
const newContent = insertTextAtPosition(
  currentContent,
  insertPosition,
  `{{${fieldKey}}}`
)
editor.commands.setContent(newContent)
onChange?.(newContent)
```

## 技术要点

### 为什么不能直接修改Transaction？

在**只读编辑器**中：
1. `editable: false` 意味着编辑器不期望内容变化
2. Decoration插件的状态管理假设内容不会被外部修改
3. 直接dispatch transaction会导致Decoration状态不同步
4. Widget装饰的DOM引用会失效

### 为什么用JSON操作？

1. **完全重建**：`setContent()`会触发编辑器完全重建
2. **状态一致**：所有插件（包括PlaceholderPreviewExtension）都会重新初始化
3. **Decoration重建**：Widget装饰会基于新内容重新创建
4. **安全可靠**：不会出现状态不一致的问题

### 性能考虑

虽然完全重建比Transaction修改慢，但：
- 占位符操作不频繁
- 文档大小通常不大
- 用户体验的稳定性更重要
- 避免了难以调试的状态bug

### 问题4：持续的崩溃（Decoration状态管理错误）

**原因：**
1. **Widget和Inline Decoration冲突**：同时在相同位置创建widget和inline decoration
2. **缺少防御性检查**：plugin state可能在某些情况下为undefined
3. **双向更新循环**：内部调用`setContent()`又触发`onChange`，可能导致重复更新

**修复方案：**

#### 1. 加强Decoration创建的防御性

```typescript
props: {
  decorations(state) {
    const placeholders = this.getState(state)
    
    // ✅ 防御性检查：确保placeholders是有效数组
    if (!Array.isArray(placeholders) || placeholders.length === 0) {
      return DecorationSet.empty
    }
    
    const decorations: Decoration[] = []
    
    for (const { from, to, fieldKey } of placeholders) {
      try {
        // 1. 先创建inline decoration隐藏原始文本
        decorations.push(
          Decoration.inline(from, to, {
            class: "placeholder-original-hidden",
          })
        )
        
        // 2. 在from位置创建widget decoration显示chip
        const meta = getPlaceholderMeta?.(fieldKey)
        const chip = createPlaceholderChip(fieldKey, meta, onPlaceholderClick)
        
        decorations.push(
          Decoration.widget(from, chip, {
            side: 0,
            key: `placeholder-${fieldKey}-${from}`, // 添加key避免重复
          })
        )
      } catch (error) {
        console.error(`Failed to create decoration for placeholder ${fieldKey}:`, error)
      }
    }
    
    try {
      return DecorationSet.create(state.doc, decorations)
    } catch (error) {
      console.error('Failed to create DecorationSet:', error)
      return DecorationSet.empty
    }
  },
}
```

#### 2. 加强Plugin State的防御性

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
      // 确保prev是有效数组
      return Array.isArray(prev) ? prev : []
    } catch (error) {
      console.error('PlaceholderPreview apply error:', error)
      return Array.isArray(prev) ? prev : []
    }
  },
}
```

#### 3. 改为完全受控的组件模式

**问题：**之前在操作函数中同时调用`editor.commands.setContent()`和`onChange()`，导致：
- 内部状态更新
- 触发onChange
- 父组件更新content prop
- useEffect再次setContent
- 可能导致状态循环和Decoration不同步

**修复：**只调用`onChange`，让父组件通过prop来更新content

```typescript
// ❌ 旧方式：双向更新
const { content: newContent, count } = replaceTextInContent(...)
editor.commands.setContent(newContent)  // 内部更新
onChange?.(newContent)                   // 通知外部

// ✅ 新方式：单向数据流
const { content: newContent, count } = replaceTextInContent(...)
onChange?.(newContent)  // 只通知外部，让父组件通过prop更新
```

#### 4. 优化Content更新逻辑

```typescript
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

## 解决的问题

- ✅ **删除误操作**：正则表达式转义，精确匹配
- ✅ **页面崩溃（DecorationGroup错误）**：不再直接修改Transaction
- ✅ **状态不同步**：使用JSON操作触发完整重建
- ✅ **Decoration失效**：让插件正确重新初始化
- ✅ **持续崩溃（localsInner/eq错误）**：
  - 加强防御性检查
  - 添加try-catch错误处理
  - 为decoration添加唯一key
  - 改为单向数据流避免状态循环
  - 返回DecorationSet.empty作为fallback

## 总结

通过将"占位符管理"模式改为**完全只读 + JSON操作**的设计，我们：

1. ✅ 彻底解决了Widget与编辑器的冲突问题
2. ✅ 修复了删除和崩溃的bug
3. ✅ 提供了更清晰、更可靠的交互方式
4. ✅ 实现了所有核心功能（插入、编辑、删除、替换）
5. ✅ 改善了用户体验和视觉反馈
6. ✅ 代码更容易理解和维护

这是一个更符合ProseMirror设计哲学的方案，避免了直接操作Transaction带来的复杂性和不可预测性。

