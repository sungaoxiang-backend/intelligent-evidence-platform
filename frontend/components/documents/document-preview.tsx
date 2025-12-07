"use client"

import React, { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PlayCircle } from "lucide-react"
import { normalizeContent as normalizeContentUtil } from "@/components/template-editor/utils"
import { createDocumentExtensions } from "./document-extensions"
import { templateBaseStyles } from "@/components/template-editor/extensions"
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
      
      // 调试：检查渲染后的 HTML 和 JSON 结构
      if (process.env.NODE_ENV === "development") {
        setTimeout(() => {
          const editorElement = editor.view.dom
          
          // 检查字体大小
          const spansWithFontSize = editorElement.querySelectorAll('span[style*="font-size"], span[style*="fontSize"]')
          let fontSizeCount = 0
          const checkFontSize = (node: any): void => {
            if (node.type === "text" && node.marks) {
              const fontSizeMark = node.marks.find((m: any) => m.type === "textStyle" && m.attrs?.fontSize)
              if (fontSizeMark) fontSizeCount++
            }
            if (node.content && Array.isArray(node.content)) {
              node.content.forEach(checkFontSize)
            }
          }
          checkFontSize(normalized)
          
          // 检查表格属性
          let tableCount = 0
          let tablesWithColWidths = 0
          let tablesWithTableWidth = 0
          const checkTables = (node: any): void => {
            if (node.type === "table") {
              tableCount++
              if (node.attrs?.colWidths && Array.isArray(node.attrs.colWidths) && node.attrs.colWidths.length > 0) {
                tablesWithColWidths++
              }
              if (node.attrs?.tableWidth) {
                tablesWithTableWidth++
              }
            }
            if (node.content && Array.isArray(node.content)) {
              node.content.forEach(checkTables)
            }
          }
          checkTables(normalized)
          
          // 检查渲染后的表格
          const renderedTables = editorElement.querySelectorAll('table')
          let tablesWithColgroup = 0
          let tablesWithStyle = 0
          renderedTables.forEach((table) => {
            if (table.querySelector('colgroup')) tablesWithColgroup++
            if (table.getAttribute('style')) tablesWithStyle++
          })
          
          console.log(`[DocumentPreview] 📊 格式检查:`)
          console.log(`  - 字体大小: JSON=${fontSizeCount}, HTML=${spansWithFontSize.length} spans`)
          console.log(`  - 表格: JSON=${tableCount}, HTML=${renderedTables.length}`)
          console.log(`  - 表格列宽: JSON中有colWidths=${tablesWithColWidths}, HTML中有colgroup=${tablesWithColgroup}`)
          console.log(`  - 表格宽度: JSON中有tableWidth=${tablesWithTableWidth}, HTML中有style=${tablesWithStyle}`)
          
          // 如果有表格但列宽不一致，显示警告
          if (tableCount > 0) {
            if (tablesWithColWidths !== tablesWithColgroup) {
              console.warn(`[DocumentPreview] ⚠️ 表格列宽不一致！JSON中有${tablesWithColWidths}个表格有colWidths，但HTML中只有${tablesWithColgroup}个表格有colgroup`)
            }
            if (tablesWithTableWidth !== tablesWithStyle) {
              console.warn(`[DocumentPreview] ⚠️ 表格宽度不一致！JSON中有${tablesWithTableWidth}个表格有tableWidth，但HTML中只有${tablesWithStyle}个表格有style`)
            }
            
            // 显示表格示例
            if (renderedTables.length > 0) {
              const firstTable = renderedTables[0] as HTMLElement
              const colgroup = firstTable.querySelector('colgroup')
              const tableStyle = firstTable.getAttribute('style')
              console.log(`[DocumentPreview] 第一个表格:`, {
                hasColgroup: !!colgroup,
                colCount: colgroup?.querySelectorAll('col').length || 0,
                style: tableStyle,
                width: firstTable.style.width || 'none'
              })
            }
          }
        }, 100)
      }
    }
  }, [editor, content])

  if (!editor) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <>
      <style jsx global>{templateBaseStyles}</style>
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

      {/* 预览内容 - 与编辑器保持一致的样式 */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
        <div className="template-doc-container">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
    </>
  )
}

