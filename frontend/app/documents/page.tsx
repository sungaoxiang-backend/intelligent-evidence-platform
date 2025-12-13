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
import Image from "@tiptap/extension-image"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "@/components/documents/shared/editor-extensions"
import { FontSize } from "@/components/documents/font-size-extension"

type ViewMode = "list" | "preview" | "edit" | "create"

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


  // 导出 PDF
  const handleExport = async () => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)

      // 使用与预览完全相同的扩展配置和渲染逻辑
      // 关键：使用 Editor 实例的 getHTML() 方法，而不是 generateHTML
      // 这样可以确保扩展的 renderHTML 方法被正确调用
      const { Editor } = await import("@tiptap/core")
      const { normalizeContent } = await import("@/components/documents/shared/editor-utils")

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
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        FontSize,
      ]

      // 创建临时编辑器实例，使用与预览相同的配置
      const normalizedContent = normalizeContent(selectedDocument.content_json)
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
        {/* 左侧：列表 */}
        {(viewMode === "list" || viewMode === "preview" || viewMode === "edit") && (
          <div className="w-80 border-r flex flex-col">
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
            // 预览模式：根据状态显示不同的操作按钮
            <DocumentPreview
              content={selectedDocument.content_json}
              status={selectedDocument.status}
              onEdit={selectedDocument.status === "draft" ? handleEdit : undefined}
              onStatusChange={handleStatusChange}
            />
          )}

          {(viewMode === "edit" || viewMode === "create") && (
            <DocumentEditor
              initialContent={draftContent}
              onChange={setDraftContent}
              onSave={handleSave}
              onCancel={handleCancel}

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

