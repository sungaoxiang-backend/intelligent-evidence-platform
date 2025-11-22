"use client"

import React, { useEffect, useRef, useCallback } from "react"
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
} from "@/components/template-editor/extensions"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { PlaceholderFormNode } from "./placeholder-form-node-extension"
import { PlaceholderInfo } from "./placeholder-form-fields"

interface DocumentPreviewFormProps {
  /** 文档内容（ProseMirror JSON） */
  content?: JSONContent | null
  
  /** 占位符信息列表 */
  placeholders?: PlaceholderInfo[]
  
  /** 表单数据 */
  formData?: Record<string, any>
  
  /** 表单数据变化回调 */
  onFormDataChange?: (formData: Record<string, any>) => void
  
  /** 模板类型（要素式/陈述式） */
  templateCategory?: string | null
  
  /** 自定义类名 */
  className?: string
}

/**
 * 文档预览表单组件
 * 
 * 在文档预览中将占位符渲染为表单输入框
 */
export function DocumentPreviewForm({
  content,
  placeholders = [],
  formData = {},
  onFormDataChange,
  templateCategory,
  className,
}: DocumentPreviewFormProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
  }, [])
  
  // 获取占位符信息
  const getPlaceholderInfo = useCallback((fieldKey: string): PlaceholderInfo | undefined => {
    return placeholders.find((p) => p.name === fieldKey)
  }, [placeholders])
  
  // 获取表单值
  const getFormValue = useCallback((fieldKey: string) => {
    return formData[fieldKey]
  }, [formData])
  
  // 处理表单值变化
  const handleFormValueChange = useCallback((fieldKey: string, value: any) => {
    if (onFormDataChange) {
      // 使用函数式更新，确保使用最新的 formData
      onFormDataChange((prevFormData) => {
        const newFormData = {
          ...prevFormData,
          [fieldKey]: value,
        }
        console.log(`Form value changed: ${fieldKey} =`, value, "prevFormData:", prevFormData, "newFormData:", newFormData)
        return newFormData
      })
    }
  }, [onFormDataChange])
  
  // 存储值更新回调（用于外部数据加载时更新，不用于用户输入）
  const valueUpdateCallbacksRef = useRef<Set<() => void>>(new Set())
  
  // 注册值更新回调
  const registerUpdateCallback = useCallback((callback: () => void) => {
    valueUpdateCallbacksRef.current.add(callback)
    // 返回清理函数
    return () => {
      valueUpdateCallbacksRef.current.delete(callback)
    }
  }, [])
  
  // 注意：不在 formData 变化时触发更新，因为输入框使用内部状态管理
  // 只在占位符信息变化时更新（比如从服务器加载新数据）
  
  // 创建编辑器实例
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        hardBreak: false,
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
      PlaceholderFormNode.configure({
        getPlaceholderInfo,
        getFormValue,
        onFormValueChange: handleFormValueChange,
        registerUpdateCallback,
        templateCategory,
      }),
    ],
    content: { type: "doc", content: [] },
    editable: false, // 只读模式
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px; cursor: default;",
      },
    },
  })
  
  // 更新内容
  useEffect(() => {
    if (!editor) return
    
    if (!content) return
    
    const contentKey = JSON.stringify(content)
    
    if (previousContentRef.current === contentKey) {
      return
    }
    
    previousContentRef.current = contentKey
    
    try {
      const normalizedContent = normalizeContent(content) || content
      editor.commands.setContent(normalizedContent, false)
    } catch (error) {
      console.error("Failed to set content:", error)
      previousContentRef.current = null
    }
  }, [editor, content, normalizeContent])
  
  // 当占位符变化时，刷新编辑器（但不响应formData变化，避免中断输入）
  useEffect(() => {
    if (!editor) return
    // 只在占位符列表变化时刷新
    const { tr } = editor.state
    editor.view.dispatch(tr)
  }, [editor, placeholders])
  
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }
  
  return (
    <div className={className}>
      <div ref={editorRef} className="relative">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{templateBaseStyles}</style>
      <style jsx global>{`
        /* 要素式模板：表格单元格布局优化 - 50%:50%布局 */
        /* 表格单元格中包含占位符字段时，使用flex布局实现50%:50%分配 */
        .template-doc table td,
        .template-doc table th {
          position: relative;
        }
        
        /* 要素式模板：表格单元格中包含占位符时，使用flex布局 */
        .template-doc table td .placeholder-form-field,
        .template-doc table th .placeholder-form-field {
          display: inline-block;
          width: 50%;
          vertical-align: middle;
          margin-left: auto;
        }
        
        /* 要素式模板：确保输入框样式统一 */
        .template-doc table td .placeholder-form-field input,
        .template-doc table td .placeholder-form-field textarea,
        .template-doc table td .placeholder-form-field [role="combobox"],
        .template-doc table th .placeholder-form-field input,
        .template-doc table th .placeholder-form-field textarea,
        .template-doc table th .placeholder-form-field [role="combobox"] {
          width: 100%;
          height: 32px;
          padding: 4px 8px;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }
        
        .template-doc table td .placeholder-form-field textarea,
        .template-doc table th .placeholder-form-field textarea {
          height: auto;
          min-height: 60px;
        }
        
        /* 要素式模板：表格单元格中的文本（字段名）应该在左侧，占50% */
        .template-doc table td,
        .template-doc table th {
          text-align: left;
        }
        
        /* 陈述式模板：统一输入框样式 */
        .template-doc .placeholder-form-field input,
        .template-doc .placeholder-form-field textarea,
        .template-doc .placeholder-form-field [role="combobox"] {
          width: 100%;
          height: 32px;
          padding: 4px 8px;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }
        
        .template-doc .placeholder-form-field textarea {
          height: auto;
          min-height: 60px;
        }
        
        /* 统一所有输入框的placeholder样式 */
        .template-doc .placeholder-form-field input::placeholder,
        .template-doc .placeholder-form-field textarea::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

