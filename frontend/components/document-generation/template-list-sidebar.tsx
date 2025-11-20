"use client"

import React, { useState, useEffect } from "react"
import { FileText, Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { documentGenerationApi, type TemplateInfo } from "@/lib/document-generation-api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export interface TemplateListSidebarProps {
  selectedTemplateId?: number
  onSelectTemplate: (template: TemplateInfo) => void
  className?: string
}

/**
 * 模板列表侧边栏
 * 显示已发布的模板列表，支持搜索和分类过滤
 */
export function TemplateListSidebar({
  selectedTemplateId,
  onSelectTemplate,
  className = "",
}: TemplateListSidebarProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [categories, setCategories] = useState<string[]>([])

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await documentGenerationApi.getPublishedTemplates({
        skip: 0,
        limit: 100,
        category: category === "all" ? undefined : category,
        search: searchQuery || undefined,
      })

      setTemplates(response.data || [])
      
      // 提取所有分类
      const uniqueCategories = Array.from(
        new Set(
          response.data
            .map((t) => t.category)
            .filter((c): c is string => !!c)
        )
      )
      setCategories(uniqueCategories)
    } catch (err) {
      console.error("加载模板列表失败:", err)
      setError(err instanceof Error ? err.message : "加载失败")
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadTemplates()
  }, [])

  // 搜索和分类变化时重新加载
  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, category])

  return (
    <div className={cn("flex flex-col h-full border-r bg-background", className)}>
      {/* 头部：搜索和筛选 */}
      <div className="p-4 space-y-3 border-b">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          文书模板
        </h2>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 分类过滤 */}
        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="选择分类" />
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
        )}
      </div>

      {/* 模板列表 */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTemplates}
              className="mt-2 w-full"
            >
              重试
            </Button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || category !== "all"
                ? "未找到匹配的模板"
                : "暂无已发布的模板"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-2 transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  selectedTemplateId === template.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-background"
                )}
              >
                <div className="space-y-1">
                  <div className="font-medium flex items-center justify-between">
                    <span className="truncate">{template.name}</span>
                    {selectedTemplateId === template.id && (
                      <Badge variant="default" className="ml-2 shrink-0">
                        已选
                      </Badge>
                    )}
                  </div>
                  
                  {template.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {template.category && (
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    )}
                    {template.placeholders && template.placeholders.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {template.placeholders.length} 个字段
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 底部统计 */}
      {!loading && !error && templates.length > 0 && (
        <div className="p-4 border-t text-sm text-muted-foreground text-center">
          共 {templates.length} 个模板
        </div>
      )}
    </div>
  )
}

