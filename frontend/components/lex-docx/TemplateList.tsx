"use client"

import { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Search, FileText, Loader2, CheckCircle2, Circle } from "lucide-react"
import { lexDocxApi, type DocumentTemplate } from "@/lib/api/lex-docx"
import { usePaginatedSWR } from "@/hooks/use-paginated-swr"
import { cn } from "@/lib/utils"

interface TemplateListProps {
  onTemplateSelect?: (template: DocumentTemplate | null) => void
  selectedTemplateId?: number | null
  showFilters?: boolean
  className?: string
  // 多选相关
  isMultiSelect?: boolean
  selectedTemplateIds?: Set<number>
  onSelectionChange?: (selectedIds: Set<number>) => void
  onBatchAction?: (
    action: "publish" | "unpublish" | "delete",
    templateIds: number[],
    onSuccess?: () => void
  ) => void
}

export interface TemplateListRef {
  refresh: () => void
  getTotal: () => number
}

export const TemplateList = forwardRef<TemplateListRef, TemplateListProps>(({
  onTemplateSelect,
  selectedTemplateId,
  showFilters = true,
  className,
  isMultiSelect = false,
  selectedTemplateIds = new Set(),
  onSelectionChange,
  onBatchAction,
}, ref) => {
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
  const handleTemplateClick = (template: DocumentTemplate, e?: React.MouseEvent) => {
    if (isMultiSelect) {
      // 多选模式：切换选中状态
      e?.stopPropagation()
      const newSelected = new Set(selectedTemplateIds)
      if (newSelected.has(template.id)) {
        newSelected.delete(template.id)
      } else {
        newSelected.add(template.id)
      }
      onSelectionChange?.(newSelected)
    } else {
      // 单选模式：选择模板
      if (onTemplateSelect) {
        onTemplateSelect(template)
      }
    }
  }

  // 处理复选框点击
  const handleCheckboxClick = (templateId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedTemplateIds)
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId)
    } else {
      newSelected.add(templateId)
    }
    onSelectionChange?.(newSelected)
  }

  // 全选
  const handleSelectAll = () => {
    if (!templates) return
    const allIds = new Set(templates.map((t) => t.id))
    onSelectionChange?.(allIds)
  }

  // 反选
  const handleInvertSelection = () => {
    if (!templates) return
    const allIds = templates.map((t) => t.id)
    const inverted = new Set(
      allIds.filter((id) => !selectedTemplateIds.has(id))
    )
    onSelectionChange?.(inverted)
  }

  // 批量操作
  const handleBatchPublish = () => {
    const selectedIds = Array.from(selectedTemplateIds)
    if (selectedIds.length === 0) return
    onBatchAction?.("publish", selectedIds, () => {
      mutate() // 刷新列表
    })
  }

  const handleBatchUnpublish = () => {
    const selectedIds = Array.from(selectedTemplateIds)
    if (selectedIds.length === 0) return
    onBatchAction?.("unpublish", selectedIds, () => {
      mutate() // 刷新列表
    })
  }

  const handleBatchDelete = () => {
    const selectedIds = Array.from(selectedTemplateIds)
    if (selectedIds.length === 0) return
    onBatchAction?.("delete", selectedIds, () => {
      mutate() // 刷新列表
    })
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

  const selectedCount = selectedTemplateIds.size

  // 暴露刷新方法和总数给父组件
  useImperativeHandle(ref, () => ({
    refresh: () => mutate(),
    getTotal: () => total || 0,
  }))

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

      {/* 多选操作栏 */}
      {isMultiSelect && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 shrink-0"
              onClick={handleSelectAll}
            >
              全选
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 shrink-0"
              onClick={handleInvertSelection}
            >
              反选
            </Button>
            {selectedCount > 0 && (
              <>
                <div className="h-4 w-px bg-border mx-1 shrink-0" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 shrink-0 whitespace-nowrap"
                  onClick={handleBatchPublish}
                  disabled={selectedCount === 0}
                >
                  发布({selectedCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-50 shrink-0 whitespace-nowrap"
                  onClick={handleBatchUnpublish}
                  disabled={selectedCount === 0}
                >
                  撤销({selectedCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 shrink-0 whitespace-nowrap"
                  onClick={handleBatchDelete}
                  disabled={selectedCount === 0}
                >
                  删除({selectedCount})
                </Button>
              </>
            )}
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
          <div className="p-2 space-y-2">
            {templates.map((template) => {
              const isSelected = isMultiSelect
                ? selectedTemplateIds.has(template.id)
                : selectedTemplateId === template.id

              return (
                <div
                  key={template.id}
                  onClick={() => handleTemplateClick(template)}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-all duration-200 cursor-pointer relative overflow-hidden",
                    isSelected
                      ? "border-blue-400 shadow-md ring-1 ring-blue-200 bg-blue-50/50"
                      : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30 hover:shadow-md"
                  )}
                >
                  {/* 选中指示条 */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-blue-600" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* 多选复选框 */}
                    {isMultiSelect && (
                      <div
                        onClick={(e) => handleCheckboxClick(template.id, e)}
                        className="mt-0.5 shrink-0"
                      >
                        {isSelected ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate text-sm">{template.name}</h3>
                        <Badge
                          variant={getStatusBadgeVariant(template.status)}
                          className="shrink-0 text-xs"
                        >
                          {getStatusLabel(template.status)}
                        </Badge>
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                          {template.description}
                        </p>
                      )}
                      {template.category && (
                        <p className="text-xs text-muted-foreground">
                          分类: {template.category}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      {templates && templates.length > 0 && (
        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            共<span className="mx-1">{total}</span>条记录
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
})
