"use client"

import React, { useEffect, useRef } from "react"
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
} from "../template-editor/extensions"
import { normalizeHardBreaks } from "../template-editor/utils"
import { PlaceholderFieldExtension, requestPlaceholderFieldRefresh } from "./placeholder-field-extension"
import { InlineFieldRenderer } from "./inline-field-renderer"
import type { PlaceholderInfo } from "@/lib/document-generation-api"
import { createPortal } from "react-dom"

export interface DocumentGenerationViewerProps {
  content?: JSONContent | null
  placeholders: PlaceholderInfo[]
  formData: Record<string, any>
  onFieldChange: (fieldName: string, value: any) => void
  readOnly?: boolean
}

/**
 * 文书生成查看器
 * 复用文书模板预览的所有扩展，但使用特殊的占位符扩展来渲染表单字段
 */
export function DocumentGenerationViewer({
  content,
  placeholders,
  formData,
  onFieldChange,
  readOnly = false,
}: DocumentGenerationViewerProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)
  const [fieldMounts, setFieldMounts] = React.useState<HTMLElement[]>([])

  const normalizeContent = (value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
  }

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
        defaultAlignment: 'left',
      }),
      Underline,
      TextStyle,
      Color,
      // 使用专门的占位符字段扩展
      PlaceholderFieldExtension.configure({
        placeholders,
        formData,
        onFieldChange,
        readOnly,
      }),
    ],
    content: { type: "doc", content: [] },
    editable: false, // 文档本身不可编辑，只有占位符字段可编辑
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px;",
      },
    },
  })

  // 当内容变化时更新编辑器内容
  useEffect(() => {
    if (editor && content) {
      const contentKey = JSON.stringify(content)
      
      if (previousContentRef.current === contentKey) {
        return
      }
      
      previousContentRef.current = contentKey

      try {
        editor.commands.setContent(normalizeContent(content) || content)
      } catch (error) {
        console.error("Failed to set content:", error)
        try {
          editor.view.updateState(
            editor.view.state.apply(
              editor.view.state.tr.replaceWith(
                0,
                editor.view.state.doc.content.size,
                editor.view.state.schema.nodeFromJSON(normalizeContent(content) || content)
              )
            )
          )
        } catch (fallbackError) {
          console.error("Fallback content update also failed:", fallbackError)
        }
      }
    }
  }, [editor, content])

  // 只在 placeholders 变化时刷新占位符显示
  // 不要在 formData 变化时刷新，否则会导致输入框失焦
  useEffect(() => {
    if (editor) {
      requestPlaceholderFieldRefresh(editor)
    }
  }, [editor, placeholders])

  // 扫描并收集所有占位符挂载点
  useEffect(() => {
    if (!editorRef.current) return

    const updateMounts = () => {
      const mounts = Array.from(
        editorRef.current?.querySelectorAll?.(".placeholder-field-mount") || []
      ) as HTMLElement[]
      setFieldMounts(mounts)
    }

    // 初始扫描
    updateMounts()

    // 监听 DOM 变化
    const observer = new MutationObserver(updateMounts)
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [editor?.state.doc])

  // 创建占位符映射表
  const placeholderMap = React.useMemo(() => {
    const map = new Map<string, PlaceholderInfo>()
    placeholders.forEach((p) => map.set(p.placeholder_name, p))
    return map
  }, [placeholders])

  return (
    <div ref={editorRef} className="document-generation-viewer">
      <style jsx global>{templateBaseStyles}</style>
      <style jsx global>{`
        /* 隐藏原始占位符文本 */
        .template-placeholder-hidden {
          display: none !important;
        }

        /* 错误的占位符显示为红色 */
        .template-placeholder-field--error {
          color: #ef4444;
          background-color: #fee2e2;
          padding: 2px 4px;
          border-radius: 2px;
          font-size: inherit;
        }

        /* 占位符挂载点 */
        .template-placeholder-widget {
          display: inline;
          vertical-align: baseline;
        }

        .placeholder-field-mount {
          display: inline;
          vertical-align: baseline;
        }

        /* 确保表单字段继承文档样式 */
        .placeholder-field-mount input,
        .placeholder-field-mount select,
        .placeholder-field-mount textarea {
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
        }
      `}</style>
      
      <EditorContent editor={editor} />

      {/* 通过 Portal 将 React 表单组件渲染到占位符位置 */}
      {fieldMounts.map((mount, index) => {
        const fieldName = mount.getAttribute("data-field-name")
        if (!fieldName) return null

        const placeholder = placeholderMap.get(fieldName)
        if (!placeholder) return null

        return createPortal(
          <InlineFieldRenderer
            key={`${fieldName}-${index}`}
            placeholder={placeholder}
            value={formData[fieldName]}
            onChange={(value) => onFieldChange(fieldName, value)}
            disabled={readOnly}
          />,
          mount
        )
      })}
    </div>
  )
}

