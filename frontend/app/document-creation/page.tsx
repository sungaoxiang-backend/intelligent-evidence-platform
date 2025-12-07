"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { TemplateSelector } from "@/components/document-creation/template-selector"
import { DocumentForm } from "@/components/document-creation/document-form"
import { DocumentPreview } from "@/components/document-creation/document-preview"
import { EvidenceCardsList } from "@/components/document-generation/evidence-cards-list"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { caseApi } from "@/lib/api"
import useSWR from "swr"
import type { Case } from "@/lib/types"
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

export default function DocumentCreationPage() {
  const searchParams = useSearchParams()
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>()
  const [selectedTemplate, setSelectedTemplate] = useState<Document | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [savedFormData, setSavedFormData] = useState<Record<string, any>>({})
  const [filledPreviewContent, setFilledPreviewContent] = useState<JSONContent | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const { toast } = useToast()

  // 获取案件列表
  useEffect(() => {
    const loadCases = async () => {
      try {
        const response = await caseApi.getCases({
          page: 1,
          pageSize: 100,
        })
        setCases(response.data || [])
      } catch (error) {
        console.error("Failed to load cases:", error)
        setCases([])
      }
    }
    loadCases()
  }, [])

  // 从URL参数读取caseId并自动选择案件
  useEffect(() => {
    const caseIdParam = searchParams.get('caseId')
    if (caseIdParam) {
      const caseId = Number(caseIdParam)
      if (!isNaN(caseId) && caseId > 0) {
        // 等待案件列表加载完成后再设置
        if (cases.length > 0) {
          const caseExists = cases.some(c => c.id === caseId)
          if (caseExists) {
            setSelectedCaseId(caseId)
          }
        } else if (cases.length === 0) {
          // 如果案件列表为空，也尝试设置（可能正在加载）
          setSelectedCaseId(caseId)
        }
      }
    }
  }, [searchParams, cases])

  // 获取选中的案件详情
  const caseFetcher = async ([_key, caseId]: [string, number]) => {
    const response = await caseApi.getCaseById(caseId)
    return response.data
  }

  const { data: caseData } = useSWR(
    selectedCaseId ? ['/api/case', selectedCaseId] : null,
    caseFetcher,
    {
      revalidateOnFocus: false,
    }
  )

  const getCaseDisplayName = (caseItem: Case) => {
    if (caseItem.creditor_name && caseItem.debtor_name) {
      return `${caseItem.creditor_name} vs ${caseItem.debtor_name}`
    }
    if (caseItem.description) {
      return caseItem.description
    }
    return `案件 #${caseItem.id}`
  }

  const getCaseCause = (caseItem: Case) => {
    return caseItem.case_type === 'debt' ? '民间借贷纠纷' : 
           caseItem.case_type === 'contract' ? '买卖合同纠纷' : 
           caseItem.case_type || "未设置"
  }

  const getPartyTypeLabel = (partyType: string | null | undefined): string => {
    if (partyType === 'person') return '个人'
    if (partyType === 'company') return '公司'
    if (partyType === 'individual') return '个体工商户'
    return 'N/A'
  }

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

  // 选择模板后进入表单填写
  const handleTemplateSelect = async (template: Document) => {
    setSelectedTemplate(template)
  }

  // 当案件和模板都选择后，自动加载草稿
  useEffect(() => {
    if (selectedCaseId && selectedTemplate?.placeholder_metadata) {
      loadDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId, selectedTemplate?.id])

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
    if (!selectedCaseId || !selectedTemplate) {
      toast({
        title: "保存失败",
        description: "请先选择案件和模板",
        variant: "destructive",
      })
      return
    }

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
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden">
      {/* 左侧：案件信息 + 证据卡片列表 (25%) */}
      <div className="w-1/4 border-r bg-background flex flex-col flex-shrink-0">
        {/* 紧凑的案件信息 */}
        <div className="border-b bg-muted/30 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-foreground">案件信息</h3>
            {/* 案件选择器 */}
            <div className="w-44">
              <Select
                value={selectedCaseId?.toString() || ""}
                onValueChange={(value) => {
                  const newCaseId = Number(value)
                  setSelectedCaseId(newCaseId)
                  // 切换案件时重置模板和表单
                  setSelectedTemplate(null)
                  setFormData({})
                  setSavedFormData({})
                  setHasChanges(false)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="选择案件" />
                </SelectTrigger>
                <SelectContent>
                  {cases.map((caseItem) => (
                    <SelectItem key={caseItem.id} value={caseItem.id.toString()}>
                      {getCaseDisplayName(caseItem)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 紧凑的案件基本信息 */}
          {selectedCaseId && caseData ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <label className="text-[10px] text-muted-foreground">案件ID</label>
                <div className="text-xs font-semibold text-foreground">#{caseData.id}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">案由</label>
                <div className="text-xs font-medium text-foreground truncate">{getCaseCause(caseData)}</div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">关联用户</label>
                <div className="text-xs font-medium text-foreground truncate">
                  {caseData.user?.name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">欠款金额</label>
                <div className="text-xs font-semibold text-destructive">
                  {caseData.loan_amount !== null && caseData.loan_amount !== undefined
                    ? `¥${caseData.loan_amount.toLocaleString()}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              请选择案件查看详情
            </div>
          )}
        </div>

        {/* 证据卡片列表 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
            <h4 className="text-sm font-semibold text-foreground">证据卡片</h4>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            {selectedCaseId ? (
              <EvidenceCardsList caseId={selectedCaseId} className="h-full" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs text-center px-2">
                请先选择案件
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 中间：模板列表/表单字段列表 (25%) */}
      <div className="w-1/4 border-r bg-background flex flex-col flex-shrink-0">
        {!selectedCaseId ? (
          // 未选择案件
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">选择模板</h3>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center px-4">
                <p className="text-sm font-medium mb-1">请先选择案件</p>
                <p className="text-xs">选择案件后，将显示模板列表</p>
              </div>
            </div>
          </div>
        ) : !selectedTemplate ? (
          // 模板选择
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">选择模板</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <TemplateSelector
                selectedTemplateId={selectedTemplate?.id}
                onSelectTemplate={handleTemplateSelect}
              />
            </div>
          </div>
        ) : (
          // 表单填写
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">填写表单</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setSelectedTemplate(null)
                    setFormData({})
                    setSavedFormData({})
                    setHasChanges(false)
                  }}
                >
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  返回
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
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

      {/* 右侧：文档预览 (50%) */}
      <div className="flex-1 flex flex-col bg-background">
        {!selectedCaseId ? (
          <>
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">文档预览</h2>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">请先选择案件</p>
                <p className="text-xs">选择案件后，将显示文档预览</p>
              </div>
            </div>
          </>
        ) : !selectedTemplate ? (
          <>
            <div className="px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">文档预览</h2>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">请先选择模板</p>
                <p className="text-xs">选择模板后，将显示文档预览</p>
              </div>
            </div>
          </>
        ) : (
          <DocumentPreview
            content={filledPreviewContent}
            onSave={handleSaveDraft}
            onDownload={handleDownload}
            canSave={hasChanges && !isSaving && !!selectedCaseId}
            canDownload={!hasChanges && !!selectedCaseId}
          />
        )}
      </div>
    </div>
  )
}

