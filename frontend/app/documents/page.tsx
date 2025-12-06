"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Download, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DocumentList } from "@/components/documents/document-list"
import { DocumentPreview } from "@/components/documents/document-preview"
import { DocumentEditor } from "@/components/documents/document-editor"
import { DocumentFormFields } from "@/components/documents/document-form-fields"
import { documentsApi, type Document } from "@/lib/documents-api"
import type { JSONContent } from "@tiptap/core"
import { generateHTML } from "@tiptap/html"
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

type ViewMode = "list" | "preview" | "edit" | "create" | "generate"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchTerm, setSearchTerm] = useState("")
  const [category, setCategory] = useState("")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [draftContent, setDraftContent] = useState<JSONContent | null>(null)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [documentName, setDocumentName] = useState("")
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [metadataForm, setMetadataForm] = useState({
    name: "",
    description: "",
    category: "",
  })
  // 表单填写相关状态（用于已发布模板）
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [filledPreviewContent, setFilledPreviewContent] = useState<JSONContent | null>(null)
  const { toast } = useToast()

  // 加载文书列表
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await documentsApi.getDocuments({
        search: searchTerm || undefined,
        category: category || undefined,
        status: (status && status !== "all") ? (status as "draft" | "published") : undefined,
      })
      setDocuments(response.data)
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "加载文书列表失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, category, status, toast])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // 选择文书 - 统一进入预览模式
  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document)
    setViewMode("preview")
    // 清空表单数据（只在进入生成模式时初始化）
    setFormData({})
    setFilledPreviewContent(null)
  }

  // 进入生成模式
  const handleGenerate = () => {
    if (!selectedDocument || selectedDocument.status !== "published") return
    
    // 初始化表单数据
    const initialData: Record<string, any> = {}
    const placeholderMetadata = selectedDocument.placeholder_metadata || {}
    Object.keys(placeholderMetadata).forEach((key) => {
      const meta = placeholderMetadata[key]
      if (meta.type === "checkbox") {
        initialData[key] = []
      } else {
        initialData[key] = ""
      }
    })
    setFormData(initialData)
    setFilledPreviewContent(selectedDocument.content_json)
    setViewMode("generate")
  }

  // 新增文书
  const handleCreateNew = () => {
    setSelectedDocument(null)
    setDraftContent({ type: "doc", content: [] })
    setViewMode("create")
  }

  // 编辑文书
  const handleEdit = () => {
    if (selectedDocument) {
      setDraftContent(selectedDocument.content_json)
      setViewMode("edit")
    }
  }

  // 保存文书
  const handleSave = async () => {
    if (!draftContent) return

    // 如果是新建模式，弹出命名对话框
    if (viewMode === "create") {
      setDocumentName("")
      setIsSaveDialogOpen(true)
      return
    }

    // 如果是编辑模式，直接保存（不更新名称，只更新内容）
    if (viewMode === "edit" && selectedDocument) {
      try {
        setIsLoading(true)
        const response = await documentsApi.updateDocument(selectedDocument.id, {
          content_json: draftContent,
          // 不传递 name，保持原有名称
        })
        toast({
          title: "成功",
          description: "文书更新成功",
        })
        setSelectedDocument(response.data)
        setViewMode("preview")
        await loadDocuments()
      } catch (error) {
        toast({
          title: "错误",
          description: error instanceof Error ? error.message : "保存失败",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
  }

  // 确认保存（仅用于新建模式）
  const handleConfirmSave = async () => {
    if (!draftContent) return

    const nameToSave = documentName.trim() || "新文书"
    
    if (!documentName.trim()) {
      toast({
        title: "错误",
        description: "请输入文书名称",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      // 创建新文书
      const response = await documentsApi.createDocument({
        name: nameToSave,
        content_json: draftContent,
      })
      toast({
        title: "成功",
        description: "文书创建成功",
      })
      setSelectedDocument(response.data)
      setViewMode("preview")
      await loadDocuments()
      setIsSaveDialogOpen(false)
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "保存失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 取消编辑
  const handleCancel = () => {
    setDraftContent(null)
    if (selectedDocument) {
      setViewMode("preview")
    } else {
      setViewMode("list")
    }
  }

  // 从列表编辑文书元数据
  const handleEditFromList = (document: Document) => {
    setEditingDocument(document)
    setMetadataForm({
      name: document.name,
      description: document.description || "",
      category: document.category || "",
    })
    setIsMetadataDialogOpen(true)
  }

  // 保存元数据
  const handleSaveMetadata = async () => {
    if (!editingDocument) return

    if (!metadataForm.name.trim()) {
      toast({
        title: "错误",
        description: "请输入文书名称",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const response = await documentsApi.updateDocument(editingDocument.id, {
        name: metadataForm.name.trim(),
        description: metadataForm.description.trim() || undefined,
        category: metadataForm.category.trim() || undefined,
      })
      toast({
        title: "成功",
        description: "文书信息更新成功",
      })
      // 如果当前选中的是正在编辑的文书，更新选中状态
      if (selectedDocument?.id === editingDocument.id) {
        setSelectedDocument(response.data)
      }
      await loadDocuments()
      setIsMetadataDialogOpen(false)
      setEditingDocument(null)
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "更新失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 删除文书
  const handleDelete = async (document: Document) => {
    try {
      setIsLoading(true)
      await documentsApi.deleteDocument(document.id)
      toast({
        title: "成功",
        description: "文书删除成功",
      })
      // 如果删除的是当前选中的文书，返回列表视图
      if (selectedDocument?.id === document.id) {
        setSelectedDocument(null)
        setViewMode("list")
      }
      await loadDocuments()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "删除失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 更新状态
  const handleStatusChange = async (newStatus: "draft" | "published") => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)
      const response = await documentsApi.updateDocumentStatus(selectedDocument.id, {
        status: newStatus,
      })
      toast({
        title: "成功",
        description: `状态已更新为${newStatus === "published" ? "已发布" : "草稿"}`,
      })
      setSelectedDocument(response.data)
      await loadDocuments()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "状态更新失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }


  // 更新占位符元数据
  const handlePlaceholderMetadataUpdate = async (metadata: Record<string, any>) => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)
      const response = await documentsApi.updatePlaceholderMetadata(selectedDocument.id, {
        placeholder_metadata: metadata,
      })
      toast({
        title: "成功",
        description: "占位符元数据更新成功",
      })
      setSelectedDocument(response.data)
      await loadDocuments()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "更新失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 处理表单数据变化（实时更新预览）- 仅在生成模式下
  useEffect(() => {
    if (viewMode !== "generate" || !selectedDocument) return
    if (!selectedDocument.content_json) return

    // 替换占位符
    const replacePlaceholders = (node: any): any => {
      if (node.type === "text") {
        let text = node.text || ""
        // 替换 {{placeholder}} 格式
        Object.keys(formData).forEach((key) => {
          const value = formData[key]
          const meta = selectedDocument.placeholder_metadata?.[key]
          
          // 格式化显示值
          let displayValue = ""
          if (meta && (meta.type === "radio" || meta.type === "checkbox") && meta.options) {
            // 单选/复选：显示所有选项及其勾选状态
            const selectedValues = meta.type === "radio" 
              ? (value ? [value] : [])
              : (Array.isArray(value) ? value : [])
            
            const formattedOptions = meta.options.map((option: string) => {
              const isSelected = selectedValues.includes(option)
              return isSelected ? `☑ ${option}` : `☐ ${option}`
            })
            displayValue = formattedOptions.join("  ")
          } else {
            // 普通文本或未配置类型
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
          const meta = selectedDocument.placeholder_metadata?.[fieldKey]
          
          // 格式化显示值
          let displayValue = ""
          if (meta && (meta.type === "radio" || meta.type === "checkbox") && meta.options) {
            // 单选/复选：显示所有选项及其勾选状态
            const selectedValues = meta.type === "radio" 
              ? (value ? [value] : [])
              : (Array.isArray(value) ? value : [])
            
            const formattedOptions = meta.options.map((option: string) => {
              const isSelected = selectedValues.includes(option)
              return isSelected ? `☑ ${option}` : `☐ ${option}`
            })
            displayValue = formattedOptions.join("  ")
          } else {
            // 普通文本或未配置类型
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

    const updatedContent = replacePlaceholders(selectedDocument.content_json)
    setFilledPreviewContent(updatedContent)
  }, [formData, selectedDocument, viewMode])

  // 处理表单字段变化
  const handleFormChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // 处理复选框变化
  const handleCheckboxChange = (key: string, option: string, checked: boolean) => {
    setFormData((prev) => {
      const current = prev[key] || []
      const newValue = checked
        ? [...current, option]
        : current.filter((v: string) => v !== option)
      return { ...prev, [key]: newValue }
    })
  }

  // 下载生成的文档
  const handleDownloadGeneratedDocument = async () => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)
      // 生成文档
      const generateResponse = await documentsApi.generateDocument(selectedDocument.id, {
        form_data: formData,
      })

      // 使用与导出 PDF 完全相同的扩展配置和渲染逻辑
      const { Editor } = await import("@tiptap/core")
      const { normalizeHardBreaks } = await import("@/components/template-editor/utils")
      
      // 使用与 handleExport 完全相同的扩展配置（包含 FontSize）
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

      // 创建临时编辑器实例，使用与导出相同的配置
      const normalizedContent = normalizeHardBreaks(generateResponse.data.content_json)
      const tempEditor = new Editor({
        extensions,
        content: normalizedContent || { type: "doc", content: [] },
      })

      // 关键：使用 editor.getHTML() 而不是 generateHTML()
      // editor.getHTML() 会正确调用所有扩展的 renderHTML 方法
      const htmlContent = tempEditor.getHTML()
      
      // 清理临时编辑器
      tempEditor.destroy()

      // 将 HTML 内容包装在完整的 HTML 文档中，并注入 CSS 样式（与 handleExport 保持一致）
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${selectedDocument.name}</title>
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
      const blob = await documentsApi.exportDocumentToPdf(selectedDocument.id, {
        html_content: fullHtml,
        filename: `${selectedDocument.name}_生成.pdf`,
      })

      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selectedDocument.name}_生成.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "成功",
        description: "文档生成并下载成功",
      })
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "生成文档失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 导出 PDF
  const handleExport = async () => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)
      
      // 使用与预览完全相同的扩展配置和渲染逻辑
      // 关键：使用 Editor 实例的 getHTML() 方法，而不是 generateHTML
      // 这样可以确保扩展的 renderHTML 方法被正确调用
      const { Editor } = await import("@tiptap/core")
      const { normalizeHardBreaks } = await import("@/components/template-editor/utils")
      
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
      const normalizedContent = normalizeHardBreaks(selectedDocument.content_json)
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
  <title>${selectedDocument.name}</title>
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

      const blob = await documentsApi.exportDocumentToPdf(selectedDocument.id, {
        html_content: fullHtml,
        filename: `${selectedDocument.name}.pdf`,
      })

      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${selectedDocument.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "成功",
        description: "PDF 导出成功",
      })
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "导出失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col pt-12">
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：列表或表单 */}
        {(viewMode === "list" || viewMode === "preview" || viewMode === "edit" || viewMode === "generate") && (
          <div className="w-80 border-r flex flex-col">
            {viewMode === "generate" ? (
              // 生成模式：显示表单
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">填写表单</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {selectedDocument && (
                    <DocumentFormFields
                      placeholderMetadata={selectedDocument.placeholder_metadata || {}}
                      formData={formData}
                      onFormChange={handleFormChange}
                      onCheckboxChange={handleCheckboxChange}
                    />
                  )}
                </div>
              </div>
            ) : (
              // 其他情况：显示列表
              <>
                <div className="p-4 border-b">
                  <Button onClick={handleCreateNew} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    新增文书
                  </Button>
                </div>
                <DocumentList
                  documents={documents}
                  searchTerm={searchTerm}
                  category={category}
                  status={status}
                  selectedDocumentId={selectedDocument?.id}
                  onSearchChange={setSearchTerm}
                  onCategoryChange={setCategory}
                  onStatusChange={setStatus}
                  onDocumentSelect={handleDocumentSelect}
                  onEdit={handleEditFromList}
                  onDelete={handleDelete}
                />
              </>
            )}
          </div>
        )}

        {/* 右侧内容区域 */}
        <div className="flex-1 flex flex-col">
          {viewMode === "list" && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">选择一个文书进行预览</p>
                <p className="text-sm">或点击"新增文书"创建新文书</p>
              </div>
            </div>
          )}

          {viewMode === "preview" && selectedDocument && (
            // 统一预览模式：根据状态显示不同的操作按钮
            <DocumentPreview
              content={selectedDocument.content_json}
              status={selectedDocument.status}
              onEdit={selectedDocument.status === "draft" ? handleEdit : undefined}
              onGenerate={selectedDocument.status === "published" ? handleGenerate : undefined}
              onStatusChange={handleStatusChange}
            />
          )}

          {viewMode === "generate" && selectedDocument && (
            // 生成模式：右侧显示实时预览
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold">文档预览</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => {
                      setViewMode("preview")
                    }}
                    title="返回"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleDownloadGeneratedDocument}
                    disabled={isLoading}
                    title={isLoading ? "生成中..." : "下载"}
                  >
                    {isLoading ? (
                      <span className="text-xs">生成中...</span>
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentPreview
                  content={filledPreviewContent || selectedDocument.content_json}
                  status={selectedDocument.status}
                />
              </div>
            </div>
          )}

          {(viewMode === "edit" || viewMode === "create") && (
            <DocumentEditor
              initialContent={draftContent}
              onChange={setDraftContent}
              onSave={handleSave}
              onCancel={handleCancel}
              isLoading={isLoading}
              placeholderMetadata={selectedDocument?.placeholder_metadata}
              onPlaceholderMetadataUpdate={handlePlaceholderMetadataUpdate}
            />
          )}
        </div>
      </div>

      {/* 保存命名对话框 */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewMode === "create" ? "创建文书" : "保存文书"}</DialogTitle>
            <DialogDescription>请输入文书的名称</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="document-name">文书名称</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="请输入文书名称"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirmSave()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmSave} disabled={isLoading}>
              {isLoading ? "保存中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 元数据编辑对话框 */}
      <Dialog open={isMetadataDialogOpen} onOpenChange={setIsMetadataDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑文书信息</DialogTitle>
            <DialogDescription>修改文书的名称、描述和分类</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="metadata-name">文书名称</Label>
              <Input
                id="metadata-name"
                value={metadataForm.name}
                onChange={(e) => setMetadataForm({ ...metadataForm, name: e.target.value })}
                placeholder="请输入文书名称"
                className="mt-2"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="metadata-description">描述</Label>
              <Textarea
                id="metadata-description"
                value={metadataForm.description}
                onChange={(e) => setMetadataForm({ ...metadataForm, description: e.target.value })}
                placeholder="请输入文书描述（可选）"
                className="mt-2"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="metadata-category">分类</Label>
              <Input
                id="metadata-category"
                value={metadataForm.category}
                onChange={(e) => setMetadataForm({ ...metadataForm, category: e.target.value })}
                placeholder="请输入分类（可选）"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMetadataDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveMetadata} disabled={isLoading}>
              {isLoading ? "保存中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

