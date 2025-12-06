"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FileText, Search, Edit, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Document } from "@/lib/documents-api"
import { cn } from "@/lib/utils"

interface DocumentListProps {
  documents: Document[]
  searchTerm: string
  category: string
  status: string
  selectedDocumentId?: number
  onSearchChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onStatusChange: (value: string) => void
  onDocumentSelect: (document: Document) => void
  onEdit?: (document: Document) => void
  onDelete?: (document: Document) => void
}

export function DocumentList({
  documents,
  searchTerm,
  category,
  status,
  selectedDocumentId,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onDocumentSelect,
  onEdit,
  onDelete,
}: DocumentListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)

  // 提取所有分类（过滤掉空值和空字符串）
  const categories = Array.from(
    new Set(documents.map((doc) => doc.category).filter((cat) => cat && cat.trim() !== ""))
  )

  const handleEditClick = (e: React.MouseEvent, document: Document) => {
    e.stopPropagation()
    onEdit?.(document)
  }

  const handleDeleteClick = (e: React.MouseEvent, document: Document) => {
    e.stopPropagation()
    setDocumentToDelete(document)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (documentToDelete) {
      onDelete?.(documentToDelete)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 搜索和筛选 */}
      <div className="p-4 space-y-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文书..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
        <Select value={category || "all"} onValueChange={(value) => onCategoryChange(value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          <Select value={status || "all"} onValueChange={(value) => onStatusChange(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 文书列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {documents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暂无文书</p>
          </div>
        ) : (
          documents.map((document) => (
            <Card
              key={document.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent group",
                selectedDocumentId === document.id && "bg-accent"
              )}
              onClick={() => onDocumentSelect(document)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{document.name}</h3>
                    {document.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {document.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {document.status && (
                        <Badge
                          className={cn(
                            "text-xs font-medium",
                            document.status === "published"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-gray-200 text-gray-800 hover:bg-gray-200"
                          )}
                        >
                          {document.status === "published" ? "已发布" : "草稿"}
                        </Badge>
                      )}
                      {document.category && (
                        <span className="text-xs px-2 py-1 bg-secondary rounded">
                          {document.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(document.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {(onEdit || onDelete) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => handleEditClick(e, document)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => handleDeleteClick(e, document)}
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除文书"{documentToDelete?.name}"（状态：{documentToDelete?.status === "published" ? "已发布" : "草稿"}）吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

