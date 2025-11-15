"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, FileText, Loader2 } from "lucide-react"
import { lexDocxApi, type DocumentTemplate } from "@/lib/api/lex-docx"
import { usePaginatedSWR } from "@/hooks/use-paginated-swr"
import { cn } from "@/lib/utils"

interface TemplateListProps {
  onTemplateSelect?: (template: DocumentTemplate | null) => void
  selectedTemplateId?: number | null
  showFilters?: boolean
  className?: string
}

export function TemplateList({
  onTemplateSelect,
  selectedTemplateId,
  showFilters = true,
  className,
}: TemplateListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  // 使用 SWR 获取模板列表
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
    "/lex-docx/templates",
    async (params) => {
      const result = await lexDocxApi.getTemplates({
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? (statusFilter as "draft" | "published") : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
      })
      return result
    },
    [searchTerm, statusFilter, categoryFilter],
    20,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 10000,
    }
  )

  // 获取所有分类（用于筛选下拉框）
  const categories = useMemo(() => {
    if (!templates) return []
    const categorySet = new Set<string>()
    templates.forEach((template) => {
      if (template.category) {
        categorySet.add(template.category)
      }
    })
    return Array.from(categorySet).sort()
  }, [templates])

  // 处理模板选择
  const handleTemplateClick = (template: DocumentTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template)
    }
  }

  // 处理搜索
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setPage(1) // 重置到第一页
  }

  // 处理状态筛选
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  // 处理分类筛选
  const handleCategoryFilterChange = (value: string) => {
    setCategoryFilter(value)
    setPage(1)
  }

  // 获取状态标签颜色
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default"
      case "draft":
        return "secondary"
      default:
        return "outline"
    }
  }

  // 获取状态标签文本
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return "已发布"
      case "draft":
        return "草稿"
      default:
        return status
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 搜索和筛选栏 */}
      {showFilters && (
        <div className="p-4 border-b space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="搜索模板名称..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 筛选器 */}
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
              <SelectTrigger className="flex-1">
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
      )}

      {/* 模板列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-destructive">
            <p>{error.message || "加载失败"}</p>
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2" />
            <p>暂无模板</p>
          </div>
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                className={cn(
                  "w-full p-4 text-left hover:bg-accent transition-colors",
                  selectedTemplateId === template.id && "bg-accent"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{template.name}</h3>
                      <Badge
                        variant={getStatusBadgeVariant(template.status)}
                        className="shrink-0"
                      >
                        {getStatusLabel(template.status)}
                      </Badge>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    {template.category && (
                      <p className="text-xs text-muted-foreground mt-1">
                        分类: {template.category}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {templates && templates.length > 0 && (
        <div className="p-4 border-t flex items-center justify-between">
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
  )
}

