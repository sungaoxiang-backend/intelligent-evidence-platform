"use client"

import React, { useEffect } from "react"
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
import { Button } from "@/components/ui/button"
import { Edit, Download } from "lucide-react"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
} from "@/components/template-editor/extensions"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { cn } from "@/lib/utils"

interface DocumentPreviewProps {
  content: JSONContent | null
  onEdit?: () => void
  onExport?: () => void
  className?: string
}

export function DocumentPreview({
  content,
  onEdit,
  onExport,
  className,
}: DocumentPreviewProps) {
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
    ],
    content: normalizeHardBreaks(content) || { type: "doc", content: [] },
    editable: false,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px;",
      },
    },
  })

  useEffect(() => {
    if (!editor || !content) return
    const normalized = normalizeHardBreaks(content)
    if (normalized) {
      editor.commands.setContent(normalized)
    }
  }, [editor, content])

  if (!editor) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 工具栏 */}
      {(onEdit || onExport) && (
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">预览</h2>
          <div className="flex gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                导出 PDF
              </Button>
            )}
            {onEdit && (
              <Button size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                编辑
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 预览内容 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

