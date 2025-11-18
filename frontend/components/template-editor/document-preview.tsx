"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import { useEffect, useRef } from "react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"

interface DocumentPreviewProps {
  content: any
}

export function DocumentPreview({ content }: DocumentPreviewProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        table: {
          resizable: false,
          handleWidth: 5,
          cellMinWidth: 100,
          lastColumnResizable: false,
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "border-collapse border border-gray-300 w-full my-4",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "border-b border-gray-300",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-gray-300 bg-gray-100 font-bold p-2",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-300 p-2",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: 'left',
      }),
      Underline,
    ],
    content: { type: "doc", content: [] },
    editable: false, // 预览模式，不可编辑
    autofocus: false,
    editorProps: {
      attributes: {
        style: "font-family: 'Times New Roman', serif; line-height: 1.6; padding: 16px;",
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
        editor.commands.setContent(content)
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
      <div
        ref={editorRef}
        className="relative"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

