"use client"

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
  TableWithAttrs,
  templateBaseStyles,
} from "@/components/template-editor/extensions"
import { ReplicableTableCellWithAttrs } from "./replicable-table-cell-with-attrs"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { PlaceholderFormNode } from "./placeholder-form-node-extension"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { identifyReplicableCells, type ReplicableCellInfo } from "./replicable-cell-utils"
import { createRoot } from "react-dom/client"
import { ReplicableCell } from "./replicable-cell"

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
  const formDataRef = useRef<Record<string, any>>(formData || {})
  
  // 保持 formDataRef 与 formData 同步
  useEffect(() => {
    formDataRef.current = formData || {}
  }, [formData])
  
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
  const replicableCellUpdateCallbacksRef = useRef<Set<() => void>>(new Set())
  
  // 注册值更新回调
  const registerUpdateCallback = useCallback((callback: () => void) => {
    valueUpdateCallbacksRef.current.add(callback)
    // 返回清理函数
    return () => {
      valueUpdateCallbacksRef.current.delete(callback)
    }
  }, [])
  
  // 注册可复制单元格更新回调
  const registerReplicableCellUpdateCallback = useCallback((callback: () => void) => {
    replicableCellUpdateCallbacksRef.current.add(callback)
    // 返回清理函数
    return () => {
      replicableCellUpdateCallbacksRef.current.delete(callback)
    }
  }, [])
  
  // 当 formData 变化时，通知所有可复制单元格更新
  // 使用防抖来避免输入时频繁重新渲染导致输入框失去焦点
  useEffect(() => {
    console.log("DocumentPreviewForm: formData changed, scheduling update callbacks")
    console.log("DocumentPreviewForm: formData keys:", Object.keys(formData || {}))
    
    // 检查是否有输入框处于焦点状态
    const activeElement = document.activeElement
    const hasFocusedInput = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.closest('input, textarea')
    )
    
    // 使用防抖延迟更新，避免输入时频繁重新渲染
    // 如果有输入框处于焦点状态，使用更长的延迟
    const delay = hasFocusedInput ? 1500 : 800
    const timeoutId = setTimeout(() => {
      // 再次检查是否有输入框处于焦点状态
      const currentActiveElement = document.activeElement
      const stillHasFocusedInput = currentActiveElement && (
        currentActiveElement.tagName === 'INPUT' || 
        currentActiveElement.tagName === 'TEXTAREA' ||
        currentActiveElement.closest('input, textarea')
      )
      
      // 如果仍然有输入框处于焦点状态，再延迟一次
      if (stillHasFocusedInput) {
        setTimeout(() => {
          console.log("DocumentPreviewForm: calling", replicableCellUpdateCallbacksRef.current.size, "callbacks")
          replicableCellUpdateCallbacksRef.current.forEach(callback => {
            try {
              callback()
            } catch (error) {
              console.error("Error calling replicable cell update callback:", error)
            }
          })
        }, 500)
      } else {
        console.log("DocumentPreviewForm: calling", replicableCellUpdateCallbacksRef.current.size, "callbacks")
        replicableCellUpdateCallbacksRef.current.forEach(callback => {
          try {
            callback()
          } catch (error) {
            console.error("Error calling replicable cell update callback:", error)
          }
        })
      }
    }, delay)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [formData])
  
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
        HTMLAttributes: {
          class: templateCategory && (templateCategory.includes("要素") || templateCategory === "要素式")
            ? "custom-table form-table"
            : "custom-table narrative-table",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {},
      }),
      TableHeader.configure({
        HTMLAttributes: {},
      }),
      ReplicableTableCellWithAttrs.configure({
        HTMLAttributes: {},
        getPlaceholderInfos: () => placeholders,
        getFormData: () => {
          // 使用 ref 获取最新的 formData，避免闭包问题
          return formDataRef.current || {}
        },
        onFormDataChange: (newFormData: Record<string, any>) => {
          console.log("ReplicableCell onFormDataChange called:", newFormData)
          if (onFormDataChange) {
            onFormDataChange(newFormData)
          }
        },
        templateCategory,
        registerUpdateCallback: registerReplicableCellUpdateCallback,
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
        /* 判断是否是要素式模板的函数式CSS类 */
        ${templateCategory && (templateCategory.includes("要素") || templateCategory === "要素式") ? `
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
        ` : `
          /* 陈述式模板：表格保持原有的文档结构，不强制表单布局 */
          .template-doc table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
          }

          .template-doc table td,
          .template-doc table th {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
            position: relative;
          }

          /* 陈述式模板：表格中的占位符字段保持自然布局 */
          .template-doc table td .placeholder-form-field,
          .template-doc table th .placeholder-form-field {
            display: inline-block;
            width: auto;
            min-width: 120px;
            vertical-align: baseline;
          }

          /* 陈述式模板：表格中的输入框样式 */
          .template-doc table td .placeholder-form-field input,
          .template-doc table td .placeholder-form-field textarea,
          .template-doc table td .placeholder-form-field [role="combobox"],
          .template-doc table th .placeholder-form-field input,
          .template-doc table th .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field [role="combobox"] {
            width: 100%;
            min-width: 120px;
            height: 32px;
            padding: 4px 8px;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background-color: #ffffff;
          }

          .template-doc table td .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field textarea {
            height: auto;
            min-height: 60px;
            resize: vertical;
          }
        `}

        /* 通用样式：所有模板类型的输入框基础样式 */
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
          background-color: #ffffff;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .template-doc .placeholder-form-field textarea {
          height: auto;
          min-height: 60px;
          resize: vertical;
        }

        /* 输入框焦点状态 */
        .template-doc .placeholder-form-field input:focus,
        .template-doc .placeholder-form-field textarea:focus,
        .template-doc .placeholder-form-field [role="combobox"]:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
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

