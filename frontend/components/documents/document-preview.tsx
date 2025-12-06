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
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PlayCircle } from "lucide-react"
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
  status?: "draft" | "published"
  onEdit?: () => void
  onGenerate?: () => void
  onStatusChange?: (status: "draft" | "published") => void
  className?: string
}

export function DocumentPreview({
  content,
  status,
  onEdit,
  onGenerate,
  onStatusChange,
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
      {/* 工具栏 - 统一布局，避免抖动 */}
      {(onEdit || onGenerate || onStatusChange) && (
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">预览</h2>
          <div className="flex items-center gap-3">
            {onStatusChange && (
              <div className="flex items-center gap-2.5">
                <Label 
                  htmlFor="status-switch" 
                  className={cn(
                    "text-sm font-medium transition-colors cursor-pointer",
                    status === "draft" ? "text-gray-700" : "text-gray-400"
                  )}
                >
                  草稿
                </Label>
                <Switch
                  id="status-switch"
                  checked={status === "published"}
                  onCheckedChange={(checked) => {
                    onStatusChange(checked ? "published" : "draft")
                  }}
                  className={cn(
                    "data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                  )}
                />
                <Label 
                  htmlFor="status-switch" 
                  className={cn(
                    "text-sm font-medium transition-colors cursor-pointer",
                    status === "published" ? "text-green-700" : "text-gray-400"
                  )}
                >
                  已发布
                </Label>
              </div>
            )}
            {/* 草稿状态：模板编辑按钮 */}
            {onEdit && (
              <Button 
                size="sm" 
                onClick={onEdit} 
                className="min-w-[110px] flex items-center justify-center"
              >
                <PlayCircle className="h-4 w-4 mr-1.5" />
                <span>进入编辑模式</span>
              </Button>
            )}
            {/* 已发布状态：文书生成按钮 */}
            {onGenerate && (
              <Button 
                size="sm" 
                onClick={onGenerate} 
                className="min-w-[110px] flex items-center justify-center"
              >
                <PlayCircle className="h-4 w-4 mr-1.5" />
                <span>进入表单模式</span>
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

