"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, FileText, Calendar, Eye } from "lucide-react"
import { lexDocxApi, type DocumentTemplate } from "@/lib/api/lex-docx"
import { usePaginatedSWR } from "@/hooks/use-paginated-swr"
import { TemplatePreview } from "./TemplatePreview"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface TemplateSelectorProps {
  onTemplateSelect?: (template: DocumentTemplate) => void
  selectedTemplateId?: number | null
  showPreview?: boolean
  className?: string
}

export function TemplateSelector({
  onTemplateSelect,
  selectedTemplateId,
  showPreview = true,
  className,
}: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplate | null>(null)

  // 使用 SWR 获取已发布模板列表
  const {
    data: templates,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate,
  } = usePaginatedSWR<DocumentTemplate>(
    "/lex-docx/published-templates",
    async (params) => {
      const result = await lexDocxApi.getPublishedTemplates({
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
      })
      return result
    },
    [],
    20,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 10000,
    }
  )

  // 获取所有分类（用于筛选下拉框）
  const categories = Array.from(
    new Set(templates?.map((t) => t.category).filter(Boolean) || [])
  ).sort()

  // 过滤模板（客户端过滤，因为后端只返回已发布的模板）
  const filteredTemplates = templates?.filter((template) => {
    // 搜索过滤
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesName = template.name.toLowerCase().includes(searchLower)
      const matchesDescription = template.description
        ?.toLowerCase()
        .includes(searchLower)
      if (!matchesName && !matchesDescription) {
        return false
      }
    }

    // 分类过滤
    if (categoryFilter !== "all") {
      if (template.category !== categoryFilter) {
        return false
      }
    }

    return true
  })

  // 处理模板选择
  const handleTemplateClick = (template: DocumentTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template)
    }
    if (showPreview) {
      setPreviewTemplate(template)
    }
  }

  // 处理搜索
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setPage(1) // 重置到第一页
  }

  // 处理分类筛选
  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value)
    setPage(1)
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 搜索和筛选栏 */}
      <div className="p-4 border-b space-y-3 bg-background">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="搜索模板名称或描述..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* 左侧：模板列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32 text-destructive">
              <p>{error.message || "加载失败"}</p>
            </div>
          ) : !filteredTemplates || filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p>暂无已发布的模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedTemplateId === template.id &&
                      "ring-2 ring-primary"
                  )}
                  onClick={() => handleTemplateClick(template)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.description && (
                          <CardDescription className="mt-1 line-clamp-2">
                            {template.description}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant="default" className="shrink-0 ml-2">
                        已发布
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {template.category && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">分类:</span>
                          <span>{template.category}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          创建于 {format(new Date(template.created_at), "yyyy-MM-dd")}
                        </span>
                      </div>
                      {template.placeholder_metadata && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">占位符:</span>
                          <span>
                            {Object.keys(template.placeholder_metadata).length} 个
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 分页 */}
          {filteredTemplates && filteredTemplates.length > 0 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                共 {total} 条记录
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">每页</span>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => setPageSize(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm px-2">
                    {page} / {Math.ceil(total / pageSize) || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= Math.ceil(total / pageSize)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：预览区域（可选） */}
        {showPreview && previewTemplate && (
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-background flex flex-col">
            <div className="p-4 border-b flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">模板预览</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <TemplatePreview template={previewTemplate} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

