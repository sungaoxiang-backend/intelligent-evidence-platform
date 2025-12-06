"use client"

import React from "react"
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
import { FileText, Search } from "lucide-react"
import type { Document } from "@/lib/documents-api"
import { cn } from "@/lib/utils"

interface DocumentListProps {
  documents: Document[]
  searchTerm: string
  category: string
  selectedDocumentId?: number
  onSearchChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onDocumentSelect: (document: Document) => void
}

export function DocumentList({
  documents,
  searchTerm,
  category,
  selectedDocumentId,
  onSearchChange,
  onCategoryChange,
  onDocumentSelect,
}: DocumentListProps) {
  // 提取所有分类（过滤掉空值和空字符串）
  const categories = Array.from(
    new Set(documents.map((doc) => doc.category).filter((cat) => cat && cat.trim() !== ""))
  )

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
                "cursor-pointer transition-colors hover:bg-accent",
                selectedDocumentId === document.id && "bg-accent"
              )}
              onClick={() => onDocumentSelect(document)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{document.name}</h3>
                    {document.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {document.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

