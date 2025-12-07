"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
      setTemplates(response.data || [])
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          选择模板
        </CardTitle>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索模板..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "没有找到匹配的模板" : "暂无已发布的模板"}
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
                <div className="font-medium">{template.name}</div>
                {template.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {template.description}
                  </div>
                )}
                {template.category && (
                  <div className="text-xs text-muted-foreground mt-1">
                    分类: {template.category}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

