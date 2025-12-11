"use client"

import React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import { useEffect, useRef } from "react"
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

interface DocumentPreviewProps {
  content?: JSONContent | null
  pageLayout?: {
    margins?: { top: number; bottom: number; left: number; right: number }
    lineSpacing?: number
  }
}

export function DocumentPreview({ content, pageLayout }: DocumentPreviewProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)

  // Apply layout CSS custom properties when pageLayout changes
  useEffect(() => {
    const container = document.querySelector('.template-doc-container') as HTMLElement
    if (container && pageLayout) {
      const defaultLayout = {
        margins: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
        lineSpacing: 1.5
      }
      const layout = { ...defaultLayout, ...pageLayout }

      // Convert mm to px (96 DPI: 1mm = 3.7795px)
      const mmToPx = (mm: number) => mm * 3.7795

      container.style.setProperty('--page-margin-top', `${mmToPx(layout.margins.top)}px`)
      container.style.setProperty('--page-margin-bottom', `${mmToPx(layout.margins.bottom)}px`)
      container.style.setProperty('--page-margin-left', `${mmToPx(layout.margins.left)}px`)
      container.style.setProperty('--page-margin-right', `${mmToPx(layout.margins.right)}px`)
      container.style.setProperty('--content-line-height', layout.lineSpacing.toString())
    }
  }, [pageLayout])

  const normalizeContent = (value?: JSONContent | null) => {
    if (!value) return value
    return normalizeContentUtil(JSON.parse(JSON.stringify(value)))
  }

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
        defaultAlignment: 'left',
      }),
      Underline,
      TextStyle,
      Color,
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

  // 当内容变化时更新编辑器内容
  useEffect(() => {
    if (editor && content) {
      // 使用 JSON.stringify 来比较内容是否真的变化了
      const contentKey = JSON.stringify(content)
      
      // 如果内容没有变化，跳过更新
      if (previousContentRef.current === contentKey) {
        return
      }
      
      previousContentRef.current = contentKey

      try {
        // 规范化内容（清理空文本节点和处理硬换行）
        const normalized = normalizeContent(content)
        
        // 如果规范化后内容为空，使用空文档
        if (!normalized || (normalized.type === "doc" && (!normalized.content || normalized.content.length === 0))) {
          editor.commands.setContent({ type: "doc", content: [] })
          return
        }
        
        // 使用 setContent 方法更新内容
        editor.commands.setContent(normalized)
      } catch (error) {
        console.error("Failed to set content:", error)
        // 如果 setContent 失败，尝试使用规范化后的内容创建 transaction
        try {
          const normalized = normalizeContent(content)
          if (normalized) {
            const tr = editor.state.tr
            const newDoc = editor.schema.nodeFromJSON(normalized)
            if (newDoc.content) {
              tr.replaceWith(0, editor.state.doc.content.size, newDoc.content)
              editor.view.dispatch(tr)
            }
          } else {
            // 如果规范化失败，设置为空文档
            editor.commands.setContent({ type: "doc", content: [] })
          }
        } catch (e) {
          console.error("Failed to set content with transaction:", e)
          // 最后的 fallback：设置为空文档，避免页面空白
          try {
            editor.commands.setContent({ type: "doc", content: [] })
          } catch (finalError) {
            console.error("Failed to set empty content:", finalError)
          }
        }
      }
    }
  }, [editor, content])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div ref={editorRef} className="relative">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{templateBaseStyles}</style>
    </div>
  )
}

