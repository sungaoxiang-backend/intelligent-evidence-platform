"use client"

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
import { normalizeHardBreaks } from "./utils"

interface DocumentPreviewProps {
  content?: JSONContent | null
}

export function DocumentPreview({ content }: DocumentPreviewProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)

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
        // 使用 setContent 方法更新内容，这会正确处理内容变化
        editor.commands.setContent(normalizeContent(content) || content)
      } catch (error) {
        console.error("Failed to set content:", error)
        // 如果 setContent 失败，尝试使用 transaction
        try {
          const tr = editor.state.tr
          const newDoc = editor.schema.nodeFromJSON(content)
          if (newDoc.content) {
            tr.replaceWith(0, editor.state.doc.content.size, newDoc.content)
            editor.view.dispatch(tr)
          }
        } catch (e) {
          console.error("Failed to set content with transaction:", e)
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

