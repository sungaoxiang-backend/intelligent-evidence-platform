"use client"

/**
 * 增强版文档预览组件
 * 
 * 设计原则：
 * 1. 预览模式 = 查看 + 占位符配置
 * 2. 将 {{fieldKey}} 渲染为可交互的 chip
 * 3. 点击 chip 可以快速打开配置对话框
 * 4. 显示占位符的丰富信息（类型、标签、描述）
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  PlaceholderFormFields,
  PlaceholderFormState,
  createEmptyPlaceholderForm,
  buildFormStateFromMeta,
  buildPayloadFromFormState,
} from "./placeholder-form"
import { useToast } from "@/hooks/use-toast"

interface DocumentPreviewEnhancedProps {
  /** 文档内容（ProseMirror JSON） */
  content?: JSONContent | null
  
  /** 是否启用占位符交互 */
  enablePlaceholderInteraction?: boolean
  
  /** 自定义类名 */
  className?: string
}

/**
 * 增强版文档预览组件
 * 
 * 在预览模式下渲染占位符为可交互的 chip
 */
export function DocumentPreviewEnhanced({
  content,
  enablePlaceholderInteraction = true,
  className,
}: DocumentPreviewEnhancedProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)
  
  // ✅ 始终调用 hook（符合 React 规则）
  // 调用者需要确保包裹 PlaceholderProvider
  const placeholderManager = usePlaceholderManager()
  const { toast } = useToast()
  
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
  
  // 处理占位符点击
  const handlePlaceholderClick = useCallback((fieldKey: string) => {
    if (!enablePlaceholderInteraction || !placeholderManager) return
    
    // 查找占位符元数据
    const meta = placeholderManager.placeholders[fieldKey]
    
    if (meta?.backendMeta) {
      // 已配置的占位符：编辑模式
      setFormData(buildFormStateFromMeta(meta))
      setSelectedFieldKey(fieldKey)
      setConfigDialogOpen(true)
    } else {
      // 未配置的占位符：创建模式
      const emptyForm = createEmptyPlaceholderForm()
      emptyForm.placeholder_name = fieldKey
      emptyForm.label = fieldKey
      setFormData(emptyForm)
      setSelectedFieldKey(fieldKey)
      setConfigDialogOpen(true)
    }
  }, [enablePlaceholderInteraction, placeholderManager])
  
  // 处理占位符悬停
  const handlePlaceholderHover = useCallback((fieldKey: string | null) => {
    if (!placeholderManager) return
    
    if (fieldKey) {
      placeholderManager.highlightPlaceholder(fieldKey)
    } else {
      placeholderManager.highlightPlaceholder(null)
    }
  }, [placeholderManager])
  
  // 获取占位符元数据
  const getPlaceholderMeta = useCallback((fieldKey: string) => {
    if (!placeholderManager) return undefined
    
    const meta = placeholderManager.placeholders[fieldKey]
    if (!meta?.backendMeta) return undefined
    
    return {
      label: meta.backendMeta.label,
      fieldType: meta.backendMeta.field_type,
      description: meta.backendMeta.description,
      required: meta.backendMeta.required,
    }
  }, [placeholderManager])
  
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
        onPlaceholderClick: enablePlaceholderInteraction ? handlePlaceholderClick : undefined,
        onPlaceholderHover: enablePlaceholderInteraction ? handlePlaceholderHover : undefined,
      }),
    ],
    content: { type: "doc", content: [] },
    editable: false, // 预览模式，不可编辑
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px;",
      },
    },
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
      // 使用emitUpdate: false避免不必要的更新事件
      editor.commands.setContent(normalizedContent, false)
    } catch (error) {
      console.error("Failed to set content:", error)
      // 如果失败，尝试重置
      previousContentRef.current = null
    }
  }, [editor, content, normalizeContent])
  
  // 处理表单提交
  const handleSubmit = useCallback(async () => {
    if (!selectedFieldKey || !placeholderManager) return
    
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
      <div className={className}>
        <div ref={editorRef} className="relative">
          <EditorContent editor={editor} />
        </div>
        <style jsx global>{templateBaseStyles}</style>
      </div>
      
      {/* 占位符配置对话框 */}
      {enablePlaceholderInteraction && (
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {placeholderManager.placeholders[selectedFieldKey || ""]?.backendMeta
                  ? "编辑占位符"
                  : "配置占位符"}
              </DialogTitle>
            <DialogDescription>
              {selectedFieldKey && placeholderManager && (
                <>
                  配置占位符 <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{selectedFieldKey}</code> 的元数据
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <PlaceholderFormFields
            formId="preview-placeholder"
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
      )}
    </>
  )
}

