"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Eye, Edit, FileText } from "lucide-react"
import { type DocumentTemplate } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"

interface TemplatePreviewProps {
  template: DocumentTemplate | null
  onEditClick?: () => void
  className?: string
}

export function TemplatePreview({
  template,
  onEditClick,
  className,
}: TemplatePreviewProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(true)

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

  // 判断是否为草稿状态
  const isDraft = template?.status === "draft"

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
        <p>该模板暂无内容</p>
        {isDraft && onEditClick && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onEditClick}
          >
            <Edit className="h-4 w-4 mr-2" />
            开始编辑
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{template.name}</h3>
          {isDraft && (
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
              草稿
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 预览/编辑模式切换（仅草稿状态显示） */}
          {isDraft && (
            <>
              <Button
                variant={isPreviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreviewMode(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                预览
              </Button>
              {onEditClick && (
                <Button
                  variant={!isPreviewMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsPreviewMode(false)
                    onEditClick()
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </Button>
              )}
            </>
          )}

          {/* 已发布状态只显示预览 */}
          {!isDraft && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>只读预览</span>
            </div>
          )}
        </div>
      </div>

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

      {/* 占位符说明（如果有占位符） */}
      {processedHtml.includes("lex-docx-placeholder") && (
        <div className="p-4 border-t bg-muted/50">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <div
              className="w-4 h-4 rounded mt-0.5"
              style={{
                backgroundColor: "#fef3c7",
                border: "1px solid #fbbf24",
              }}
            />
            <div>
              <p className="font-medium mb-1">占位符说明</p>
              <p>
                黄色高亮显示的是占位符，将在生成文档时被替换为实际内容。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

