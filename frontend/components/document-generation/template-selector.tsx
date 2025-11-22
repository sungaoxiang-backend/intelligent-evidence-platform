"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, FileText, Search } from "lucide-react"
import { documentGenerationApi, type TemplateInfo } from "@/lib/document-generation-api"
import { cn } from "@/lib/utils"

interface TemplateSelectorProps {
  selectedTemplateId?: number
  onSelectTemplate: (template: TemplateInfo) => void
  className?: string
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  className,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [categoryFilter])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await documentGenerationApi.getPublishedTemplates({
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        limit: 100,
      })
      setTemplates(response.data || [])
    } catch (error) {
      console.error("Failed to load templates:", error)
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const categories = Array.from(
    new Set(templates.map((t) => t.category).filter(Boolean))
  ) as string[]

  const filteredTemplates = templates.filter((template) => {
    if (categoryFilter && template.category !== categoryFilter) {
      return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        template.name.toLowerCase().includes(query) ||
        template.description?.toLowerCase().includes(query) ||
        template.category?.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          选择模板
        </CardTitle>
        <div className="flex flex-col gap-2 mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full border transition-colors",
                  !categoryFilter
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                )}
              >
                全部
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-full border transition-colors",
                    categoryFilter === category
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery || categoryFilter ? "没有找到匹配的模板" : "暂无已发布的模板"}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedTemplateId === template.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {template.category && (
                        <Badge variant="outline" className="text-xs">
                          {template.category}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {template.placeholders?.length || 0} 个占位符
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

