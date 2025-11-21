"use client"

/**
 * 增强版文档预览组件
 * 
 * 设计原则：
 * 1. 预览模式 = 查看 + 占位符高亮
 * 2. 将 {{fieldKey}} 渲染为可交互的 chip
 * 3. 点击 chip 高亮显示，编辑配置统一在左侧列表进行
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
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
  }, [])
  
  // 处理占位符点击 - 不再打开编辑对话框，只高亮显示
  const handlePlaceholderClick = useCallback((fieldKey: string) => {
    if (!enablePlaceholderInteraction || !placeholderManager) return
    // 只高亮显示，不打开编辑对话框
    placeholderManager.selectPlaceholder(fieldKey)
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
      name: meta.backendMeta.name,
      type: meta.backendMeta.type,
    }
  }, [placeholderManager])
  
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
      
    </>
  )
}

