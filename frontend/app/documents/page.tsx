"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
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
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
} from "@/components/template-editor/extensions"

type ViewMode = "list" | "preview" | "edit" | "create"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchTerm, setSearchTerm] = useState("")
  const [category, setCategory] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [draftContent, setDraftContent] = useState<JSONContent | null>(null)
  const { toast } = useToast()

  // 加载文书列表
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await documentsApi.getDocuments({
        search: searchTerm || undefined,
        category: category || undefined,
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
  }, [searchTerm, category, toast])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // 选择文书
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

    try {
      setIsLoading(true)
      if (viewMode === "create") {
        // 创建新文书
        const response = await documentsApi.createDocument({
          name: "新文书",
          content_json: draftContent,
        })
        toast({
          title: "成功",
          description: "文书创建成功",
        })
        setSelectedDocument(response.data)
        setViewMode("preview")
      } else if (viewMode === "edit" && selectedDocument) {
        // 更新文书
        const response = await documentsApi.updateDocument(selectedDocument.id, {
          content_json: draftContent,
        })
        toast({
          title: "成功",
          description: "文书更新成功",
        })
        setSelectedDocument(response.data)
        setViewMode("preview")
      }
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

  // 取消编辑
  const handleCancel = () => {
    setDraftContent(null)
    if (selectedDocument) {
      setViewMode("preview")
    } else {
      setViewMode("list")
    }
  }

  // 导出 PDF
  const handleExport = async () => {
    if (!selectedDocument) return

    try {
      setIsLoading(true)
      // 将 ProseMirror JSON 转换为 HTML
      const html = generateHTML(selectedDocument.content_json, [
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
        TableWithAttrs,
        TableRow,
        TableHeader,
        TableCellWithAttrs,
        TextAlign,
        Underline,
        TextStyle,
        Color,
      ])

      const blob = await documentsApi.exportDocumentToPdf(selectedDocument.id, {
        html_content: html,
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
        {/* 左侧列表 */}
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
              selectedDocumentId={selectedDocument?.id}
              onSearchChange={setSearchTerm}
              onCategoryChange={setCategory}
              onDocumentSelect={handleDocumentSelect}
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
            <DocumentPreview
              content={selectedDocument.content_json}
              onEdit={handleEdit}
              onExport={handleExport}
            />
          )}

          {(viewMode === "edit" || viewMode === "create") && (
            <DocumentEditor
              initialContent={draftContent}
              onChange={setDraftContent}
              onSave={handleSave}
              onCancel={handleCancel}
              onExport={viewMode === "edit" && selectedDocument ? handleExport : undefined}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>
    </div>
  )
}

