"use client"

import { useMemo } from "react"
import { FileText, Pencil, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { type DocumentTemplate } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"
import "@/app/lex-docx/docx-styles.css"

interface TemplatePreviewProps {
  template: DocumentTemplate | null
  className?: string
  onEdit?: () => void
  onDownloadTemplate?: () => void
  isExporting?: boolean
}

export function TemplatePreview({
  template,
  className,
  onEdit,
  onDownloadTemplate,
  isExporting = false,
}: TemplatePreviewProps) {

  // 处理 HTML 内容，高亮显示占位符
  const processedHtml = useMemo(() => {
    if (!template?.content_html) {
      return ""
    }

    // 使用正则表达式匹配占位符 {{field_name}}
    // 注意：这个正则表达式会匹配所有 {{...}} 格式，包括在 HTML 标签中的
    const placeholderRegex = /\{\{([^}]+)\}\}/g

    // 转义 HTML 特殊字符（仅用于占位符内容）
    const escapeHtml = (text: string) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }
      return text.replace(/[&<>"']/g, (m) => map[m])
    }

    // 将 HTML 内容中的占位符替换为高亮版本
    let processed = template.content_html
    const matches = Array.from(template.content_html.matchAll(placeholderRegex))

    if (matches.length === 0) {
      return template.content_html
    }

    // 从后往前替换，避免索引偏移问题
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      const fullMatch = match[0] // {{field_name}}
      const fieldName = match[1].trim() // field_name（去除首尾空格）
      const startIndex = match.index!
      const endIndex = startIndex + fullMatch.length

      // 提取占位符前后的内容
      const before = processed.substring(0, startIndex)
      const after = processed.substring(endIndex)

      // 创建高亮的占位符 HTML
      // 使用转义确保占位符名称中的特殊字符不会破坏 HTML 结构
      const highlightedPlaceholder = `<span class="lex-docx-placeholder" data-placeholder="${escapeHtml(fieldName)}" style="background-color: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 500; font-family: 'Courier New', monospace; display: inline-block;">${escapeHtml(fullMatch)}</span>`

      // 重新组合
      processed = before + highlightedPlaceholder + after
    }

    return processed
  }, [template?.content_html])

  // 如果没有模板，显示空状态
  if (!template) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>请选择一个模板进行预览</p>
      </div>
    )
  }

  // 如果没有内容，显示提示
  if (!template.content_html) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>该模板暂无内容，点击编辑按钮开始编辑</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {/* 操作按钮（仅在草稿状态时显示） */}
      {template?.status === "draft" && (onEdit || onDownloadTemplate) && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {onDownloadTemplate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadTemplate}
              disabled={isExporting}
              className="shadow-md bg-white hover:bg-gray-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </>
              )}
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="shadow-md bg-white hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4 mr-2" />
              编辑模板
            </Button>
          )}
        </div>
      )}

      {/* 预览内容区域 */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div
          className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 min-h-full"
          style={{
            // 模拟 Word 文档样式
            fontFamily: "Times New Roman, serif",
            fontSize: "12pt",
            lineHeight: "1.5",
            color: "#000",
          }}
        >
          {/* 使用 dangerouslySetInnerHTML 渲染处理后的 HTML */}
          <div
            dangerouslySetInnerHTML={{ __html: processedHtml }}
            className="lex-docx-preview-content"
            style={{
              // 确保占位符样式生效
              wordBreak: "break-word",
            }}
          />
        </div>
      </div>

      {/* 占位符说明（简洁版，仅在预览区域底部） */}
      {processedHtml.includes("lex-docx-placeholder") && (
        <div className="px-6 py-2 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            黄色高亮显示的是占位符，将在生成文档时被替换为实际内容
          </p>
        </div>
      )}
    </div>
  )
}

