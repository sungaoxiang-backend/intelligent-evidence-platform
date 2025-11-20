"use client"

import React, { useMemo } from "react"
import { DocumentPreview } from "../template-editor/document-preview"
import type { JSONContent } from "@tiptap/core"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export interface GenerationPreviewProps {
  template?: {
    prosemirror_json: JSONContent
  } | null
  formData: Record<string, any>
  className?: string
}

/**
 * 文书生成预览组件
 * 在本地替换占位符，实时显示预览
 */
export function GenerationPreview({
  template,
  formData,
  className = "",
}: GenerationPreviewProps) {
  /**
   * 深拷贝并替换 ProseMirror JSON 中的占位符
   */
  const previewContent = useMemo(() => {
    if (!template || !template.prosemirror_json) {
      return null
    }

    // 深拷贝，避免修改原始数据
    const clonedJson = JSON.parse(JSON.stringify(template.prosemirror_json))

    /**
     * 递归遍历并替换占位符
     */
    function traverseAndReplace(node: any): any {
      if (!node) return node

      // 如果是文本节点，替换占位符
      if (node.type === "text" && node.text) {
        // 使用正则表达式替换 {{placeholder_name}} 格式的占位符
        node.text = node.text.replace(/\{\{([^}]+)\}\}/g, (match: string, placeholderName: string) => {
          const key = placeholderName.trim()
          
          // 如果表单数据中有值，则替换
          if (key in formData && formData[key] !== undefined && formData[key] !== null) {
            const value = formData[key]
            
            // 处理不同类型的值
            if (Array.isArray(value)) {
              // 数组转换为逗号分隔的字符串
              return value.join("、")
            } else if (typeof value === "number") {
              return String(value)
            } else if (typeof value === "string") {
              if (value === "") {
                // 空字符串保留占位符
                return match
              }
              return value
            } else {
              return String(value)
            }
          }
          
          // 如果没有值，保留原占位符
          return match
        })
      }

      // 递归处理子节点
      if (node.content && Array.isArray(node.content)) {
        node.content = node.content.map((child: any) => traverseAndReplace(child))
      }

      return node
    }

    return traverseAndReplace(clonedJson)
  }, [template, formData])

  // 如果没有模板，显示空状态
  if (!template || !template.prosemirror_json) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            请先选择一个模板。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>文书预览</CardTitle>
          <CardDescription>
            实时预览生成的文书内容，未填写的字段将显示为占位符。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="h-full border rounded-md bg-white">
            <DocumentPreview content={previewContent} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

