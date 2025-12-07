"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, FileText, Search } from "lucide-react"
import { documentsApi, type Document } from "@/lib/documents-api"
import { cn } from "@/lib/utils"

interface TemplateSelectorProps {
  selectedTemplateId?: number
  onSelectTemplate: (template: Document) => void
  className?: string
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  className,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await documentsApi.getPublishedDocuments({
        search: searchQuery || undefined,
      })
      // 按创建时间倒序排序
      const sortedTemplates = (response.data || []).sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA // 倒序
      })
      setTemplates(sortedTemplates)
    } catch (error) {
      console.error("Failed to load templates:", error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      template.name.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query) ||
      template.category?.toLowerCase().includes(query)
    )
  })

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 搜索框 */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* 模板列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          {searchQuery ? "没有找到匹配的模板" : "暂无已发布的模板"}
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "cursor-pointer transition-colors hover:bg-accent h-[100px]",
                selectedTemplateId === template.id && "bg-accent"
              )}
              onClick={() => onSelectTemplate(template)}
            >
              <CardContent className="p-4 h-full flex flex-col">
                {/* 顶部：名称（左）+ 留白（右） */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium truncate flex-1 min-w-0">{template.name}</h3>
                  <div className="w-8 shrink-0"></div>
                </div>
                
                {/* 中间：描述（左）+ 分类（右） */}
                <div className="flex items-center justify-between gap-2 flex-1 min-h-0 mb-2">
                  <div className="flex-1 min-w-0">
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  {template.category && (
                    <span className="text-xs px-2 py-1 bg-secondary rounded truncate max-w-[100px] shrink-0">
                      {template.category}
                    </span>
                  )}
                </div>
                
                {/* 底部：时间（左）+ 状态（右） */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">
                    {new Date(template.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </span>
                  {template.status && (
                    <Badge
                      className={cn(
                        "text-xs font-medium shrink-0",
                        template.status === "published"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-200"
                      )}
                    >
                      {template.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

