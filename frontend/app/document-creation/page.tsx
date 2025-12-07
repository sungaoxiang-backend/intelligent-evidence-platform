"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CaseSelector } from "@/components/document-generation/case-selector"
import { TemplateSelector } from "@/components/document-creation/template-selector"
import { DocumentForm } from "@/components/document-creation/document-form"
import { DocumentPreview } from "@/components/document-creation/document-preview"
import { 
  documentsApi, 
  documentDraftsApi, 
  documentCreationApi,
  type Document 
} from "@/lib/documents-api"
import type { JSONContent } from "@tiptap/core"
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
} from "@/components/template-editor/extensions"
import { FontSize } from "@/components/documents/font-size-extension"
import { normalizeContent } from "@/components/template-editor/utils"

type Step = "case" | "template" | "form"

export default function DocumentCreationPage() {
  const [step, setStep] = useState<Step>("case")
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>()
  const [selectedTemplate, setSelectedTemplate] = useState<Document | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [savedFormData, setSavedFormData] = useState<Record<string, any>>({})
  const [filledPreviewContent, setFilledPreviewContent] = useState<JSONContent | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  // 加载草稿并初始化表单数据
  const loadDraft = useCallback(async () => {
    if (!selectedCaseId || !selectedTemplate?.placeholder_metadata) return

    try {
      // 先尝试加载草稿
      const response = await documentDraftsApi.getDraft(selectedCaseId, selectedTemplate.id)
      console.log("草稿API响应:", response)
      if (response.data && response.data.form_data) {
        // 确保form_data是对象，如果是字符串则解析
        let draftFormData = response.data.form_data
        console.log("草稿form_data类型:", typeof draftFormData, "值:", draftFormData)
        if (typeof draftFormData === 'string') {
          try {
            draftFormData = JSON.parse(draftFormData)
            console.log("解析后的form_data:", draftFormData)
          } catch (e) {
            console.error("解析草稿数据失败:", e)
            draftFormData = {}
          }
        }
        
        // 合并草稿数据和模板的占位符元数据，确保所有占位符都有值
        const mergedData: Record<string, any> = {}
        Object.keys(selectedTemplate.placeholder_metadata || {}).forEach((key) => {
          const meta = selectedTemplate.placeholder_metadata![key]
          if (key in draftFormData) {
            // 使用草稿中的值
            mergedData[key] = draftFormData[key]
          } else {
            // 使用默认值
            if (meta.type === "checkbox") {
              mergedData[key] = []
            } else {
              mergedData[key] = ""
            }
          }
        })
        
        setFormData(mergedData)
        setSavedFormData(mergedData)
        setHasChanges(false)
        toast({
          title: "已加载草稿",
          description: "已自动加载之前保存的草稿",
        })
        return
      }
    } catch (error) {
      // 草稿不存在是正常的，不显示错误
      if (error instanceof Error && !error.message.includes("404") && !error.message.includes("草稿不存在")) {
        console.error("加载草稿失败:", error)
      }
    }
    
    // 如果没有草稿，初始化空表单数据
    const initialData: Record<string, any> = {}
    Object.keys(selectedTemplate.placeholder_metadata || {}).forEach((key) => {
      const meta = selectedTemplate.placeholder_metadata![key]
      if (meta.type === "checkbox") {
        initialData[key] = []
      } else {
        initialData[key] = ""
      }
    })
    setFormData(initialData)
    setSavedFormData(initialData)
  }, [selectedCaseId, selectedTemplate, toast])

  // 选择案件后进入模板选择
  const handleCaseSelect = (caseId: number) => {
    setSelectedCaseId(caseId)
    setStep("template")
  }

  // 选择模板后进入表单填写
  const handleTemplateSelect = async (template: Document) => {
    setSelectedTemplate(template)
    setStep("form")
  }

  // 当案件和模板都选择后，自动加载草稿
  useEffect(() => {
    if (step === "form" && selectedCaseId && selectedTemplate?.placeholder_metadata) {
      loadDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedCaseId, selectedTemplate?.id])

  // 处理表单数据变化
  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // 处理复选框变化
  const handleCheckboxChange = (key: string, option: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev[key] || []
      const newValue = checked
        ? [...(Array.isArray(current) ? current : []), option]
        : (Array.isArray(current) ? current : []).filter((v) => v !== option)
      return { ...prev, [key]: newValue }
    })
  }

  // 检测表单数据变化
  const handleDataChange = (hasChanges: boolean) => {
    setHasChanges(hasChanges)
  }

  // 实时更新预览内容
  useEffect(() => {
    if (!selectedTemplate?.content_json) return

    const replacePlaceholders = (node: any): any => {
      if (node.type === "text") {
        let text = node.text || ""
        Object.keys(formData).forEach((key) => {
          const value = formData[key]
          const meta = selectedTemplate.placeholder_metadata?.[key]
          
          let displayValue = ""
          if (meta && (meta.type === "radio" || meta.type === "checkbox") && meta.options) {
            const selectedValues = meta.type === "radio" 
              ? (value ? [value] : [])
              : (Array.isArray(value) ? value : [])
            
            const formattedOptions = meta.options.map((option: string) => {
              const isSelected = selectedValues.includes(option)
              return isSelected ? `☑ ${option}` : `☐ ${option}`
            })
            displayValue = formattedOptions.join("  ")
          } else {
            displayValue = Array.isArray(value) ? value.join(", ") : String(value || "")
          }
          
          text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), displayValue)
        })
        return { ...node, text }
      }

      if (node.type === "placeholder") {
        const fieldKey = node.attrs?.fieldKey || node.attrs?.field_key
        if (fieldKey && fieldKey in formData) {
          const value = formData[fieldKey]
          const meta = selectedTemplate.placeholder_metadata?.[fieldKey]
          
          let displayValue = ""
          if (meta && (meta.type === "radio" || meta.type === "checkbox") && meta.options) {
            const selectedValues = meta.type === "radio" 
              ? (value ? [value] : [])
              : (Array.isArray(value) ? value : [])
            
            const formattedOptions = meta.options.map((option: string) => {
              const isSelected = selectedValues.includes(option)
              return isSelected ? `☑ ${option}` : `☐ ${option}`
            })
            displayValue = formattedOptions.join("  ")
          } else {
            displayValue = Array.isArray(value) ? value.join(", ") : String(value || "")
          }
          
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

    const updatedContent = replacePlaceholders(selectedTemplate.content_json)
    setFilledPreviewContent(updatedContent)
  }, [formData, selectedTemplate])

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!selectedCaseId || !selectedTemplate) return

    try {
      setIsSaving(true)
      await documentDraftsApi.createOrUpdateDraft({
        case_id: selectedCaseId,
        document_id: selectedTemplate.id,
        form_data: formData,
      })
      
      setSavedFormData({ ...formData })
      setHasChanges(false)
      
      toast({
        title: "保存成功",
        description: "草稿已保存",
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "保存草稿失败",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 下载文档
  const handleDownload = async () => {
    if (!selectedCaseId || !selectedTemplate) return

    try {
      setIsLoading(true)
      
      // 生成填充后的文档
      const generateResponse = await documentCreationApi.generateDocument({
        case_id: selectedCaseId,
        document_id: selectedTemplate.id,
        form_data: formData,
      })

      const filledContent = generateResponse.data

      // 使用与预览完全相同的扩展配置和渲染逻辑
      // 关键：使用 Editor 实例的 getHTML() 方法，而不是 generateHTML
      // 这样可以确保扩展的 renderHTML 方法被正确调用
      const { Editor } = await import("@tiptap/core")
      
      // 使用与预览完全相同的扩展配置（与 DocumentPreview 组件一致）
      const extensions = [
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
        FontSize,
      ]

      // 创建临时编辑器实例，使用与预览相同的配置
      const normalizedContent = normalizeContent(filledContent)
      const tempEditor = new Editor({
        extensions,
        content: normalizedContent || { type: "doc", content: [] },
      })

      // 关键：使用 editor.getHTML() 而不是 generateHTML()
      // editor.getHTML() 会正确调用所有扩展的 renderHTML 方法
      // 这与预览时 Tiptap 编辑器内部使用的渲染逻辑完全一致
      const htmlContent = tempEditor.getHTML()
      
      // 清理临时编辑器
      tempEditor.destroy()

      // 将 HTML 内容包装在完整的 HTML 文档中，并注入 CSS 样式
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedTemplate.name}</title>
  <style>
    ${templateBaseStyles}
    /* PDF 导出专用样式优化 */
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
    .template-doc-container {
      box-shadow: none !important;
    }
  </style>
</head>
<body>
  <div class="template-doc-container">
    <div class="template-doc">
      ${htmlContent}
    </div>
  </div>
</body>
</html>`

      // 导出 PDF
      const filename = `${selectedTemplate.name}_${new Date().toISOString().split('T')[0]}.pdf`
      const blob = await documentCreationApi.exportDocumentToPdf({
        html_content: fullHtml,
        filename,
      })

      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "下载成功",
        description: "文档已下载",
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: error instanceof Error ? error.message : "下载文档失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col pt-12">
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：步骤内容 */}
        <div className="w-80 border-r flex flex-col">
          {step === "case" && (
            <div className="flex-1 overflow-y-auto p-4">
              <CaseSelector
                selectedCaseId={selectedCaseId}
                onSelectCase={handleCaseSelect}
              />
            </div>
          )}

          {step === "template" && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep("case")
                    setSelectedTemplate(null)
                  }}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回选择案件
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TemplateSelector
                  selectedTemplateId={selectedTemplate?.id}
                  onSelectTemplate={handleTemplateSelect}
                />
              </div>
            </div>
          )}

          {step === "form" && selectedTemplate && (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep("template")
                    setSelectedTemplate(null)
                    setFormData({})
                    setSavedFormData({})
                    setHasChanges(false)
                  }}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回选择模板
                </Button>
                <h3 className="font-semibold">填写表单</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <DocumentForm
                  placeholderMetadata={selectedTemplate.placeholder_metadata || {}}
                  formData={formData}
                  onFormChange={handleFormChange}
                  onCheckboxChange={handleCheckboxChange}
                  onDataChange={handleDataChange}
                  savedFormData={savedFormData}
                />
              </div>
            </div>
          )}
        </div>

        {/* 右侧：预览区域 */}
        <div className="flex-1 flex flex-col">
          {step === "form" && selectedTemplate ? (
            <DocumentPreview
              content={filledPreviewContent}
              onSave={handleSaveDraft}
              onDownload={handleDownload}
              canSave={hasChanges && !isSaving}
              canDownload={!hasChanges}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                {step === "case" && (
                  <>
                    <p className="text-lg mb-2">请先选择案件</p>
                    <p className="text-sm">选择案件后，将进入模板选择步骤</p>
                  </>
                )}
                {step === "template" && (
                  <>
                    <p className="text-lg mb-2">请先选择模板</p>
                    <p className="text-sm">选择模板后，将进入表单填写步骤</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

