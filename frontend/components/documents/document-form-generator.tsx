"use client"

import React, { useState, useEffect, useMemo } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
} from "@/components/template-editor/extensions"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { Download, X } from "lucide-react"
import type { Document } from "@/lib/documents-api"
import { cn } from "@/lib/utils"

interface DocumentFormGeneratorProps {
  template: Document
  onCancel: () => void
  onDownload: (formData: Record<string, any>) => void
}

export function DocumentFormGenerator({
  template,
  onCancel,
  onDownload,
}: DocumentFormGeneratorProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [previewContent, setPreviewContent] = useState<JSONContent | null>(null)

  // 获取占位符元数据
  const placeholderMetadata = template.placeholder_metadata || {}

  // 初始化表单数据
  useEffect(() => {
    const initialData: Record<string, any> = {}
    Object.keys(placeholderMetadata).forEach((key) => {
      const meta = placeholderMetadata[key]
      if (meta.type === "checkbox") {
        initialData[key] = []
      } else {
        initialData[key] = ""
      }
    })
    setFormData(initialData)
  }, [placeholderMetadata])

  // 实时更新预览内容
  useEffect(() => {
    if (!template.content_json) return

    // 替换占位符
    const replacePlaceholders = (node: any): any => {
      if (node.type === "text") {
        let text = node.text || ""
        // 替换 {{placeholder}} 格式
        Object.keys(formData).forEach((key) => {
          const value = formData[key]
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value || "")
          text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), displayValue)
        })
        return { ...node, text }
      }

      if (node.type === "placeholder") {
        const fieldKey = node.attrs?.fieldKey || node.attrs?.field_key
        if (fieldKey && fieldKey in formData) {
          const value = formData[fieldKey]
          const displayValue = Array.isArray(value) ? value.join(", ") : String(value || "")
          return {
            type: "text",
            text: displayValue,
          }
        }
        return {
          type: "text",
          text: "",
        }
      }

      if (node.content && Array.isArray(node.content)) {
        return {
          ...node,
          content: node.content.map(replacePlaceholders),
        }
      }

      return node
    }

    const updatedContent = replacePlaceholders(template.content_json)
    setPreviewContent(updatedContent)
  }, [formData, template.content_json])

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
    content: normalizeHardBreaks(previewContent) || { type: "doc", content: [] },
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
    if (!editor || !previewContent) return
    const normalized = normalizeHardBreaks(previewContent)
    if (normalized) {
      editor.commands.setContent(normalized)
    }
  }, [editor, previewContent])

  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleCheckboxChange = (key: string, option: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev[key] || []
      const newValue = checked
        ? [...current, option]
        : current.filter((v: string) => v !== option)
      return { ...prev, [key]: newValue }
    })
  }

  const handleDownload = () => {
    onDownload(formData)
  }

  const placeholderEntries = Object.entries(placeholderMetadata)

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">填写表单</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            返回
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            下载文书
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧表单 */}
        <div className="w-80 border-r overflow-y-auto p-4 space-y-4">
          <h3 className="font-medium mb-4">填写表单</h3>
          {placeholderEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">该模板没有占位符</p>
          ) : (
            placeholderEntries.map(([key, meta]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{meta.name || key}</Label>
                {meta.type === "text" || !meta.type ? (
                  <Input
                    id={key}
                    value={formData[key] || ""}
                    onChange={(e) => handleFormChange(key, e.target.value)}
                    placeholder={`请输入${meta.name || key}`}
                  />
                ) : meta.type === "radio" ? (
                  <RadioGroup
                    value={formData[key] || ""}
                    onValueChange={(value) => handleFormChange(key, value)}
                  >
                    {meta.options && meta.options.length > 0 ? (
                      meta.options.map((option: string) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`${key}-${option}`} />
                          <Label htmlFor={`${key}-${option}`} className="font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无选项</p>
                    )}
                  </RadioGroup>
                ) : meta.type === "checkbox" ? (
                  <div className="space-y-2">
                    {meta.options && meta.options.length > 0 ? (
                      meta.options.map((option: string) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${key}-${option}`}
                            checked={(formData[key] || []).includes(option)}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(key, option, checked as boolean)
                            }
                          />
                          <Label htmlFor={`${key}-${option}`} className="font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无选项</p>
                    )}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* 右侧预览 */}
        <div className="flex-1 overflow-y-auto">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="p-4">加载中...</div>
          )}
        </div>
      </div>
    </div>
  )
}

