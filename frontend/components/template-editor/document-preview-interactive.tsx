"use client"

/**
 * 交互式文档预览组件
 * 
 * 功能：
 * 1. 双击打开占位符插入器
 * 2. 右键显示上下文菜单
 * 3. 在指定位置插入占位符
 * 4. 点击chip显示操作菜单（替换/删除占位符引用）
 */

import React, { useEffect, useRef, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "./extensions"
import { normalizeContent as normalizeContentUtil } from "./utils"
import { PlaceholderNode } from "./placeholder-node-extension"
import { usePlaceholderManager, usePlaceholderDocumentBridge } from "./placeholder-manager"
import { PlaceholderInserter } from "./placeholder-inserter"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

interface DocumentPreviewInteractiveProps {
  /** 文档内容（ProseMirror JSON） */
  content?: JSONContent | null
  
  /** 内容变化回调 */
  onChange?: (json: JSONContent) => void
  
  /** 自定义类名 */
  className?: string
}

/**
 * 交互式文档预览组件
 * 
 * 支持双击插入占位符、右键菜单等交互
 */
export function DocumentPreviewInteractive({
  content,
  onChange,
  className,
}: DocumentPreviewInteractiveProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)
  const placeholderManager = usePlaceholderManager()
  const { toast } = useToast()
  
  // 插入器状态
  const [inserterOpen, setInserterOpen] = useState(false)
  const [insertPosition, setInsertPosition] = useState<number | null>(null)
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null) // 用于替换模式
  
  // 光标指示器状态
  const [cursorIndicator, setCursorIndicator] = useState<{
    x: number
    y: number
    height: number
    visible: boolean
    isActive: boolean // 是否处于激活状态（右键点击或打开插入器时）
  } | null>(null)
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeContentUtil(JSON.parse(JSON.stringify(value)))
  }, [])
  
  // Chip操作菜单状态
  const [chipMenuOpen, setChipMenuOpen] = useState(false)
  const [chipMenuPosition, setChipMenuPosition] = useState({ x: 0, y: 0 })
  const [chipMenuFieldKey, setChipMenuFieldKey] = useState<string | null>(null)
  
  // 处理占位符悬停
  const handlePlaceholderHover = useCallback((fieldKey: string | null) => {
    if (fieldKey) {
      placeholderManager.highlightPlaceholder(fieldKey)
    } else {
      placeholderManager.highlightPlaceholder(null)
    }
  }, [placeholderManager])
  
  // 获取占位符元数据
  const getPlaceholderMeta = useCallback((fieldKey: string) => {
    const meta = placeholderManager.placeholders[fieldKey]
    if (!meta?.backendMeta) return undefined
    
    return {
      name: meta.backendMeta.name,
      type: meta.backendMeta.type,
    }
  }, [placeholderManager.placeholders])
  
  // 处理占位符点击 - 显示操作菜单（不依赖editor）
  const handlePlaceholderClick = useCallback((fieldKey: string, event: MouseEvent) => {
    // 显示操作菜单
    setChipMenuFieldKey(fieldKey)
    setChipMenuPosition({ x: event.clientX, y: event.clientY })
    setChipMenuOpen(true)
  }, [])
  
  // 创建编辑器实例
  const editor = useEditor({
    immediatelyRender: false, // 修复 SSR hydration 问题
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        hardBreak: false, // 禁用 StarterKit 中的 hardBreak，避免重复扩展
      }),
      HardBreak.configure({
        keepMarks: true,
      }),
      ParagraphWithAttrs,
      HeadingWithAttrs,
      TableWithAttrs.configure({
        resizable: false,
        HTMLAttributes: {},
      }),
      TableRow.configure({
        HTMLAttributes: {},
      }),
      TableHeader.configure({
        HTMLAttributes: {},
      }),
      TableCellWithAttrs.configure({
        HTMLAttributes: {},
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Underline,
      TextStyle,
      Color,
      PlaceholderNode.configure({
        getPlaceholderMeta,
        onPlaceholderClick: handlePlaceholderClick,
        onPlaceholderHover: handlePlaceholderHover,
      }),
    ],
    content: { type: "doc", content: [] },
    editable: false, // ✅ 完全只读，避免widget与编辑冲突
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px; cursor: default;",
      },
    },
    // ⚠️ 移除 onUpdate，因为只读模式下不会有更新
  })
  
  // 更新内容
  useEffect(() => {
    if (!editor) return
    
    // 如果没有content，跳过
    if (!content) return
    
    const contentKey = JSON.stringify(content)
    
    // 如果内容没变，跳过
    if (previousContentRef.current === contentKey) {
      return
    }
    
    previousContentRef.current = contentKey
    
    try {
      const normalizedContent = normalizeContent(content) || content
      // 使用transaction来更新，避免完全重建
      editor.commands.setContent(normalizedContent, false)
    } catch (error) {
      console.error("Failed to set content:", error)
      // 如果失败，尝试重置
      previousContentRef.current = null
    }
  }, [editor, content, normalizeContent])
  
  // 当插入位置变化时，更新光标指示器
  useEffect(() => {
    if (!editor || insertPosition === null || insertPosition < 0) return
    
    // 获取插入位置的坐标
    const coords = editor.view.coordsAtPos(insertPosition)
    if (coords) {
      setCursorIndicator({
        x: coords.left,
        y: coords.top,
        height: coords.bottom - coords.top,
        visible: true,
        isActive: inserterOpen, // 如果插入器打开，则激活
      })
    }
  }, [editor, insertPosition, inserterOpen])
  
  // ✅ 以下回调依赖 editor，必须在 useEditor 之后定义
  
  
  const collectPlaceholderNodes = useCallback((fieldKey: string) => {
    const matches: Array<{ pos: number; node: ProseMirrorNode }> = []
    if (!editor) return matches
    
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "placeholder" && node.attrs.fieldKey === fieldKey) {
        matches.push({ pos, node })
      }
    })
    
    return matches
  }, [editor])
  
  // 删除占位符
  const handleDeletePlaceholder = useCallback(async () => {
    if (!chipMenuFieldKey || !editor) return
    
    try {
      const matches = collectPlaceholderNodes(chipMenuFieldKey)
      if (matches.length === 0) {
        toast({
          title: "未找到",
          description: "文档中没有找到该占位符",
        })
        return
      }
      
      // 从文档中删除所有占位符实例
      let tr = editor.state.tr
      matches
        .sort((a, b) => b.pos - a.pos)
        .forEach(({ pos, node }) => {
          tr = tr.delete(pos, pos + node.nodeSize)
        })
      
      editor.view.dispatch(tr)
      const updatedContent = editor.getJSON()
      onChange?.(updatedContent)
      
      // 检查文档中是否还有其他该占位符的实例
      // 如果没有，则从模板中移除占位符关联
      const remainingMatches = collectPlaceholderNodes(chipMenuFieldKey)
      if (remainingMatches.length === 0) {
        // 文档中已经没有该占位符了，移除关联
        try {
          await placeholderManager.detachPlaceholder(chipMenuFieldKey)
          // 确保刷新关联状态
          await placeholderManager.loadBackendPlaceholders()
        } catch (error: any) {
          console.error('Failed to detach placeholder:', error)
          // 即使移除关联失败，也继续显示删除成功的提示
          // 因为文档中的占位符已经删除了
        }
      }
      
      toast({
        title: "删除成功",
        description: `已删除 ${matches.length} 个占位符实例`,
      })
    } catch (error: any) {
      console.error("Delete placeholder error:", error)
      toast({
        title: "删除失败",
        description: error.message || "无法删除占位符",
        variant: "destructive",
      })
    }
    
    setChipMenuOpen(false)
  }, [chipMenuFieldKey, editor, onChange, toast, collectPlaceholderNodes, placeholderManager])
  
  // 从文档中移除占位符（用于 bridge）
  const removePlaceholderBlocks = useCallback(
    async (fieldKey: string) => {
      if (!editor) return
      
      const matches = collectPlaceholderNodes(fieldKey)
      if (matches.length === 0) return
      
      // 从文档中删除所有占位符实例
      let tr = editor.state.tr
      matches
        .sort((a, b) => b.pos - a.pos)
        .forEach(({ pos, node }) => {
          tr = tr.delete(pos, pos + node.nodeSize)
        })
      
      editor.view.dispatch(tr)
      const updatedContent = editor.getJSON()
      onChange?.(updatedContent)
    },
    [editor, onChange, collectPlaceholderNodes]
  )

  // 注册 document bridge，使 placeholder-manager 可以操作文档
  usePlaceholderDocumentBridge(
    React.useMemo(
      () => ({
        remove: removePlaceholderBlocks,
      }),
      [removePlaceholderBlocks]
    )
  )

  // 替换占位符
  const handleReplacePlaceholder = useCallback(() => {
    if (!chipMenuFieldKey) return
    
    // 打开插入器，但设置为"替换"模式
    setInsertPosition(-1) // 特殊标记表示"替换"模式
    setSelectedFieldKey(chipMenuFieldKey) // 记录要替换的字段
    setInserterOpen(true)
    setChipMenuOpen(false)
  }, [chipMenuFieldKey])
  
  // 处理选择占位符
  const handleSelectPlaceholder = useCallback(async (fieldKey: string) => {
    console.log('[handleSelectPlaceholder] Called with:', {
      fieldKey,
      insertPosition,
      selectedFieldKey,
      hasEditor: !!editor,
      hasOnChange: !!onChange,
    })
    
    if (!editor) {
      console.warn('[handleSelectPlaceholder] No editor available')
      return
    }
    
    try {
      // 替换模式
      if (insertPosition === -1 && selectedFieldKey) {
        console.log('[handleSelectPlaceholder] Replace mode: replacing', selectedFieldKey, 'with', fieldKey)
        
        const matches = collectPlaceholderNodes(selectedFieldKey)
        if (matches.length === 0) {
          toast({
            title: "未找到",
            description: "文档中没有找到该占位符",
          })
          setInsertPosition(null)
          setSelectedFieldKey(null)
          return
        }
        
        // 1. 先关联新的占位符到模板
        try {
          await placeholderManager.ensureAssociation(fieldKey)
        } catch (error: any) {
          console.error('Failed to ensure association:', error)
          toast({
            title: "关联失败",
            description: error.message || "无法关联占位符到模板",
            variant: "destructive",
          })
          setInsertPosition(null)
          setSelectedFieldKey(null)
          return
        }
        
        // 2. 在文档中替换占位符
        const placeholderType = editor.state.schema.nodes.placeholder
        if (!placeholderType) {
          console.warn("Placeholder node type is not registered")
          return
        }
        
        let tr = editor.state.tr
        matches.forEach(({ pos }) => {
          tr = tr.setNodeMarkup(pos, placeholderType, { fieldKey })
        })
        editor.view.dispatch(tr)
        
        const updatedContent = editor.getJSON()
        onChange?.(updatedContent)
        
        // 3. 检查旧占位符是否还在文档中，如果不在，则移除关联
        const remainingOldMatches = collectPlaceholderNodes(selectedFieldKey)
        if (remainingOldMatches.length === 0 && selectedFieldKey !== fieldKey) {
          // 文档中已经没有旧占位符了，且新旧占位符不同，移除旧占位符的关联
          try {
            await placeholderManager.detachPlaceholder(selectedFieldKey)
          } catch (error: any) {
            console.error('Failed to detach old placeholder:', error)
            // 即使移除关联失败，也继续显示替换成功的提示
          }
        }
        
        // 4. 确保刷新关联状态（无论是否移除旧关联）
        await placeholderManager.loadBackendPlaceholders()
        
        toast({
          title: "替换成功",
          description: `已替换 ${matches.length} 个占位符实例`,
        })
        
        setInsertPosition(null)
        setSelectedFieldKey(null)
        return
      }
      
      // 插入模式
      if (insertPosition !== null && insertPosition >= 0) {
        console.log('[handleSelectPlaceholder] Insert mode: position =', insertPosition, 'fieldKey =', fieldKey)
        
        // 确保占位符关联到当前模板（在管理占位符模式下）
        try {
          await placeholderManager.ensureAssociation(fieldKey)
          // 确保刷新关联状态
          await placeholderManager.loadBackendPlaceholders()
        } catch (error: any) {
          console.error('Failed to ensure association:', error)
          toast({
            title: "关联失败",
            description: error.message || "无法关联占位符到模板",
            variant: "destructive",
          })
          return
        }
        
        const placeholderType = editor.state.schema.nodes.placeholder
        if (!placeholderType) {
          console.warn("Placeholder node type is not registered")
          return
        }
        
        const placeholderNode = placeholderType.create({ fieldKey })
        let transaction = editor.state.tr.insert(insertPosition, placeholderNode)
        editor.view.dispatch(transaction)
        
        const updatedContent = editor.getJSON()
        console.log('[handleSelectPlaceholder] Insert result:', JSON.stringify(updatedContent).substring(0, 200))
        
        onChange?.(updatedContent)
        
        toast({
          title: "插入成功",
          description: `占位符 {{${fieldKey}}} 已插入`,
        })
        
        setInsertPosition(null)
      } else {
        console.warn('[handleSelectPlaceholder] Invalid mode: insertPosition =', insertPosition, 'selectedFieldKey =', selectedFieldKey)
      }
    } catch (error: any) {
      console.error('Select placeholder error:', error)
      toast({
        title: "操作失败",
        description: error.message || "无法完成操作",
        variant: "destructive",
      })
    }
  }, [editor, insertPosition, selectedFieldKey, onChange, toast, collectPlaceholderNodes, placeholderManager])
  
  // 处理右键插入
  const handleContextMenuInsert = useCallback((event: MouseEvent) => {
    if (!editor) return
    
    // 获取点击位置
    const pos = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })
    
    if (pos) {
      setInsertPosition(pos.pos)
      setInserterOpen(true)
    }
  }, [editor])
  
  // 处理鼠标移动 - 显示光标指示器
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!editor || !editorRef.current) return
    
    // 检查鼠标是否在编辑器区域内
    const rect = editorRef.current.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      // 如果不在激活状态，隐藏光标指示器
      if (!inserterOpen) {
        setCursorIndicator(null)
      }
      return
    }
    
    // 获取鼠标位置对应的文档位置
    const pos = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })
    
    if (pos) {
      // 获取该位置的坐标和高度
      const coords = editor.view.coordsAtPos(pos.pos)
      if (coords) {
        setCursorIndicator(prev => ({
          x: coords.left,
          y: coords.top,
          height: coords.bottom - coords.top,
          visible: true,
          // 保持激活状态（如果之前是激活的）
          isActive: prev?.isActive || false,
        }))
      }
    }
  }, [editor, inserterOpen])
  
  // 处理鼠标离开编辑器区域
  const handleMouseLeave = useCallback(() => {
    // 如果不在插入模式，隐藏光标指示器
    if (!inserterOpen) {
      setCursorIndicator(null)
    } else {
      // 如果在插入模式，保持光标指示器但标记为非激活
      setCursorIndicator(prev => prev ? { ...prev, isActive: false } : null)
    }
  }, [inserterOpen])
  
  // 处理右键菜单打开
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (!editor) return
    
    // 记录点击位置（用于插入）
    const pos = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })
    
    if (pos) {
      setInsertPosition(pos.pos)
      // 显示光标指示器（激活状态）
      const coords = editor.view.coordsAtPos(pos.pos)
      if (coords) {
        setCursorIndicator({
          x: coords.left,
          y: coords.top,
          height: coords.bottom - coords.top,
          visible: true,
          isActive: true, // 右键点击时激活
        })
      }
    }
  }, [editor])
  
  
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }
  
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger onContextMenu={handleContextMenu}>
          <div 
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div ref={editorRef} className="relative">
              <EditorContent editor={editor} />
            </div>
            <style jsx global>{`
              ${templateBaseStyles}
              
              @keyframes cursor-blink {
                0%, 50% { opacity: 0.6; }
                51%, 100% { opacity: 0.2; }
              }
              @keyframes cursor-blink-active {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0.4; }
              }
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            
            {/* 提示文本 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
              💡 <strong>提示：</strong>
              右键点击文档插入占位符 · 
              点击彩色chip显示操作菜单（替换/删除占位符引用） · 
              编辑占位符配置请在左侧列表进行
            </div>
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent>
          <ContextMenuItem onClick={() => {
            if (insertPosition !== null) {
              setInserterOpen(true)
              // 保持光标指示器激活状态
              if (cursorIndicator) {
                setCursorIndicator({ ...cursorIndicator, isActive: true })
              }
            }
          }}>
            <Plus className="h-4 w-4 mr-2" />
            在此位置插入占位符
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Chip 操作菜单（悬浮） */}
      {chipMenuOpen && chipMenuFieldKey && (
        <div
          className="fixed z-50 min-w-[12rem] overflow-hidden rounded-md border bg-white p-1 shadow-md"
          style={{
            left: `${chipMenuPosition.x}px`,
            top: `${chipMenuPosition.y}px`,
          }}
          onMouseLeave={() => setChipMenuOpen(false)}
        >
          <button
            onClick={handleReplacePlaceholder}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors text-left"
          >
            <Plus className="h-4 w-4" />
            替换为其他占位符
          </button>
          <div className="h-px bg-gray-200 my-1" />
          <button
            onClick={handleDeletePlaceholder}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-red-50 text-red-600 transition-colors text-left"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除占位符引用
          </button>
        </div>
      )}
      
      {/* 点击其他地方关闭chip菜单 */}
      {chipMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setChipMenuOpen(false)}
        />
      )}
      
      {/* 占位符插入器 */}
      <PlaceholderInserter
        open={inserterOpen}
        onClose={() => {
          setInserterOpen(false)
          setInsertPosition(null)
          setSelectedFieldKey(null)
          // 关闭插入器时，延迟隐藏光标指示器
          setTimeout(() => setCursorIndicator(null), 200)
        }}
        onSelect={handleSelectPlaceholder}
      />
      
      {/* 光标指示器 */}
      {cursorIndicator && cursorIndicator.visible && (
        <>
          <div
            className="fixed pointer-events-none z-50 transition-all duration-150"
            style={{
              left: `${cursorIndicator.x}px`,
              top: `${cursorIndicator.y}px`,
              width: cursorIndicator.isActive ? '3px' : '2px',
              height: `${cursorIndicator.height}px`,
              backgroundColor: cursorIndicator.isActive ? '#2563eb' : '#3b82f6',
              boxShadow: cursorIndicator.isActive 
                ? '0 0 8px rgba(37, 99, 235, 0.8)' 
                : '0 0 4px rgba(59, 130, 246, 0.5)',
              animation: cursorIndicator.isActive 
                ? 'cursor-blink-active 0.8s infinite' 
                : 'cursor-blink 1.2s infinite',
              borderRadius: '1px',
            }}
          />
          {/* 激活状态下的提示文本 */}
          {cursorIndicator.isActive && (
            <div
              className="fixed pointer-events-none z-50 bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap"
              style={{
                left: `${cursorIndicator.x + 8}px`,
                top: `${cursorIndicator.y - 24}px`,
                animation: 'fade-in 0.2s ease-in',
              }}
            >
              在此处插入
            </div>
          )}
        </>
      )}
      
    </>
  )
}

