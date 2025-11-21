"use client"

/**
 * 交互式文档预览组件
 * 
 * 功能：
 * 1. 双击打开占位符插入器
 * 2. 右键显示上下文菜单
 * 3. 在指定位置插入占位符
 * 4. 点击chip配置占位符
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
import { normalizeHardBreaks } from "./utils"
import { PlaceholderNode } from "./placeholder-node-extension"
import { usePlaceholderManager } from "./placeholder-manager"
import { PlaceholderInserter } from "./placeholder-inserter"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Edit } from "lucide-react"
import {
  PlaceholderFormFields,
  PlaceholderFormState,
  createEmptyPlaceholderForm,
  buildFormStateFromMeta,
  buildPayloadFromFormState,
} from "./placeholder-form"
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
  
  // 占位符配置对话框状态
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [formData, setFormData] = useState<PlaceholderFormState>(createEmptyPlaceholderForm())
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
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
      label: meta.backendMeta.label,
      fieldType: meta.backendMeta.field_type,
      description: meta.backendMeta.description,
      required: meta.backendMeta.required,
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
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
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
  
  // ✅ 以下回调依赖 editor，必须在 useEditor 之后定义
  
  // 编辑占位符配置
  const handleEditPlaceholder = useCallback(() => {
    if (!chipMenuFieldKey) return
    
    const meta = placeholderManager.placeholders[chipMenuFieldKey]
    
    if (meta?.backendMeta) {
      // 已配置的占位符：编辑模式
      setFormData(buildFormStateFromMeta(meta))
      setSelectedFieldKey(chipMenuFieldKey)
      setConfigDialogOpen(true)
    } else {
      // 未配置的占位符：创建模式
      const emptyForm = createEmptyPlaceholderForm()
      emptyForm.placeholder_name = chipMenuFieldKey
      emptyForm.label = chipMenuFieldKey
      setFormData(emptyForm)
      setSelectedFieldKey(chipMenuFieldKey)
      setConfigDialogOpen(true)
    }
    
    setChipMenuOpen(false)
  }, [chipMenuFieldKey, placeholderManager.placeholders])
  
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
      
      let tr = editor.state.tr
      matches
        .sort((a, b) => b.pos - a.pos)
        .forEach(({ pos, node }) => {
          tr = tr.delete(pos, pos + node.nodeSize)
        })
      
      editor.view.dispatch(tr)
      onChange?.(editor.getJSON())
      
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
  }, [chipMenuFieldKey, editor, onChange, toast, collectPlaceholderNodes])
  
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
  const handleSelectPlaceholder = useCallback((fieldKey: string) => {
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
        
        onChange?.(editor.getJSON())
        
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
  }, [editor, insertPosition, selectedFieldKey, onChange, toast, collectPlaceholderNodes])
  
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
    }
  }, [editor])
  
  // 处理表单提交
  const handleSubmit = useCallback(async () => {
    if (!selectedFieldKey) return
    
    setIsSubmitting(true)
    try {
      const payload = buildPayloadFromFormState(formData)
      
      const meta = placeholderManager.placeholders[selectedFieldKey]
      if (meta?.backendMeta) {
        // 更新已有占位符
        await placeholderManager.updatePlaceholder(selectedFieldKey, payload)
        toast({
          title: "更新成功",
          description: "占位符配置已更新",
        })
      } else {
        // 创建新占位符
        await placeholderManager.createPlaceholder(payload, { insertIntoDocument: false })
        toast({
          title: "创建成功",
          description: "占位符已配置",
        })
      }
      
      setConfigDialogOpen(false)
      setSelectedFieldKey(null)
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "无法保存占位符配置",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedFieldKey, formData, placeholderManager, toast])
  
  // 关闭对话框
  const handleCloseDialog = useCallback(() => {
    if (!isSubmitting) {
      setConfigDialogOpen(false)
      setSelectedFieldKey(null)
    }
  }, [isSubmitting])
  
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
          <div className={className}>
            <div ref={editorRef} className="relative">
              <EditorContent editor={editor} />
            </div>
            <style jsx global>{templateBaseStyles}</style>
            
            {/* 提示文本 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">
              💡 <strong>提示：</strong>
              右键点击文档插入占位符 · 
              点击彩色chip显示操作菜单（编辑/删除/替换）
            </div>
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent>
          <ContextMenuItem onClick={() => {
            if (insertPosition !== null) {
              setInserterOpen(true)
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
            onClick={handleEditPlaceholder}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors text-left"
          >
            <Edit className="h-4 w-4" />
            编辑配置
          </button>
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
            删除占位符
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
        }}
        onSelect={handleSelectPlaceholder}
      />
      
      {/* 占位符配置对话框 */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {placeholderManager.placeholders[selectedFieldKey || ""]?.backendMeta
                ? "编辑占位符"
                : "配置占位符"}
            </DialogTitle>
            <DialogDescription>
              {selectedFieldKey && (
                <>
                  配置占位符 <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{selectedFieldKey}</code> 的元数据
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <PlaceholderFormFields
            formId="interactive-placeholder"
            formData={formData}
            onChange={setFormData}
            disabled={isSubmitting}
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

