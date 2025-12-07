"use client"

import React, { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import { Button } from "@/components/ui/button"
import { normalizeContent as normalizeContentUtil } from "@/components/template-editor/utils"
import { createDocumentExtensions } from "@/components/documents/document-extensions"
import { templateBaseStyles } from "@/components/template-editor/extensions"
import { Save, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentPreviewProps {
  content: JSONContent | null
  onSave?: () => void
  onDownload?: () => void
  canSave?: boolean
  canDownload?: boolean
  className?: string
}

export function DocumentPreview({
  content,
  onSave,
  onDownload,
  canSave = false,
  canDownload = false,
  className,
}: DocumentPreviewProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createDocumentExtensions({
      resizable: false, // 预览模式，表格不可调整大小
    }),
    content: normalizeContentUtil(content) || { type: "doc", content: [] },
    editable: false,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "outline: none;",
      },
    },
  })

  useEffect(() => {
    if (!editor || !content) return
    
    const normalized = normalizeContentUtil(content)
    if (normalized) {
      editor.commands.setContent(normalized)
    }
  }, [editor, content])

  if (!editor) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <>
      <style jsx global>{templateBaseStyles}</style>
      <div className={cn("flex flex-col h-full bg-background", className)}>
        {/* 工具栏 */}
        {(onSave || onDownload) && (
          <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground">文档预览</h2>
            <div className="flex items-center gap-2">
              {onSave && (
                <Button 
                  size="sm" 
                  onClick={onSave}
                  disabled={!canSave}
                  variant={canSave ? "default" : "outline"}
                  className={cn(
                    "h-7 px-3 text-xs flex items-center justify-center",
                    !canSave && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Save className="h-3 w-3 mr-1.5" />
                  <span>保存草稿</span>
                </Button>
              )}
              {onDownload && (
                <Button 
                  size="sm" 
                  onClick={onDownload}
                  disabled={!canDownload}
                  variant={canDownload ? "default" : "outline"}
                  className={cn(
                    "h-7 px-3 text-xs flex items-center justify-center",
                    !canDownload && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  <span>下载文书</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 预览内容 */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
          <div className="template-doc-container">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </>
  )
}

