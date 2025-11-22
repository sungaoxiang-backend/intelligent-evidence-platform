"use client"

import React, { useState, useMemo, useId, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  RefreshCw,
  Hash,
  Search,
  CheckCircle2,
  Circle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  SidebarLayout,
} from "@/components/common/sidebar-layout"
import {
  SidebarItem,
} from "@/components/common/sidebar-item"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  usePlaceholderManager,
  type PlaceholderMeta,
  type PlaceholderPayload,
} from "./placeholder-manager"
import {
  PlaceholderFormFields,
  PlaceholderFormState,
  createEmptyPlaceholderForm,
  isValidFieldKey,
  normalizePlaceholderOptions,
  buildFormStateFromMeta,
  buildPayloadFromFormState,
} from "./placeholder-form"

export function PlaceholderList() {
  const {
    orderedPlaceholders,
    allSystemPlaceholders,
    associatedPlaceholders,
    unassociatedPlaceholders,
    selectedId,
    highlightedId,
    selectPlaceholder,
    highlightPlaceholder,
    loadBackendPlaceholders,
    loadAllSystemPlaceholders,
    createPlaceholder,
    updatePlaceholder,
    deletePlaceholder,
    isSyncing,
    isMutating,
    templateCategory,
  } = usePlaceholderManager()

  const { toast } = useToast()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingPlaceholder, setEditingPlaceholder] = useState<PlaceholderMeta | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [placeholderToDelete, setPlaceholderToDelete] = useState<PlaceholderMeta | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [formData, setFormData] = useState<PlaceholderFormState>(createEmptyPlaceholderForm(templateCategory))

  // 合并所有占位符，关联的靠前
  const sortedPlaceholders = useMemo(() => {
    // 关联的在前，未关联的在后
    const sorted = [...allSystemPlaceholders].sort((a, b) => {
      const aIsAssociated = associatedPlaceholders.some(p => p.fieldKey === a.fieldKey)
      const bIsAssociated = associatedPlaceholders.some(p => p.fieldKey === b.fieldKey)
      if (aIsAssociated && !bIsAssociated) return -1
      if (!aIsAssociated && bIsAssociated) return 1
      return 0
    })
    return sorted
  }, [allSystemPlaceholders, associatedPlaceholders])

  // 筛选占位符
  const filteredPlaceholders = useMemo(() => {
    if (!searchQuery.trim()) return sortedPlaceholders
    const keyword = searchQuery.trim().toLowerCase()
    return sortedPlaceholders.filter((p) => {
      const label = (p.label || "").toLowerCase()
      const fieldKey = (p.fieldKey || "").toLowerCase()
      return label.includes(keyword) || fieldKey.includes(keyword)
    })
  }, [sortedPlaceholders, searchQuery])

  const totalCount = allSystemPlaceholders.length
  const formId = useId()
  const fieldIds = useMemo(
    () => ({
      fieldKey: `${formId}-field-key`,
      type: `${formId}-type`,
    }),
    [formId]
  )

  const handleRefresh = async () => {
    try {
      await Promise.all([
        loadBackendPlaceholders(),
        loadAllSystemPlaceholders(),
      ])
      toast({
        title: "已刷新",
        description: "占位符列表已同步最新状态",
      })
    } catch (error: any) {
      toast({
        title: "刷新失败",
        description: error.message || "无法刷新占位符列表",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData(createEmptyPlaceholderForm(templateCategory))
  }

  const handleOpenCreate = () => {
    // 确保重置所有状态，防止遮罩层残留
    setEditingPlaceholder(null)
    resetForm()
    setIsSubmitting(false) // 确保提交状态已重置
    setCreateDialogOpen(true)
  }

  const handleOpenEdit = (placeholder: PlaceholderMeta) => {
    // 确保重置所有状态，防止遮罩层残留
    setEditingPlaceholder(placeholder)
    setFormData(buildFormStateFromMeta(placeholder, templateCategory))
    setIsSubmitting(false) // 确保提交状态已重置
    setCreateDialogOpen(true)
  }

  const handleCloseDialog = () => {
    // 确保在关闭时重置所有状态，防止遮罩层残留
    // 即使 isSubmitting 为 true，也允许关闭（用户可能想取消操作）
    setCreateDialogOpen(false)
    setEditingPlaceholder(null)
    resetForm()
    // 如果正在提交，不重置 isSubmitting，让 finally 块处理
    // 如果不在提交，确保重置
    if (!isSubmitting) {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.fieldKey.trim()) {
      toast({
        title: "请输入字段标识",
        variant: "destructive",
      })
      return
    }

    if (!isValidFieldKey(formData.fieldKey.trim())) {
      toast({
        title: "字段标识格式错误",
        description: "占位符名称不能为空，且不能包含花括号 { }",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = buildPayloadFromFormState(formData)

      if (editingPlaceholder) {
        await updatePlaceholder(editingPlaceholder.fieldKey, payload)
        toast({
          title: "更新成功",
          description: `已更新占位符 ${payload.name}`,
        })
      } else {
        await createPlaceholder(payload)
        toast({
          title: "创建成功",
          description: `占位符 ${payload.name} 已添加`,
        })
      }
      handleCloseDialog()
    } catch (error: any) {
      toast({
        title: editingPlaceholder ? "更新失败" : "创建失败",
        description: error.message || "请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (placeholder: PlaceholderMeta) => {
    setPlaceholderToDelete(placeholder)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!placeholderToDelete) return
    setIsSubmitting(true)
    try {
      // 检查占位符是否在文档中
      const isInDocument = orderedPlaceholders.some(
        p => p.fieldKey === placeholderToDelete.fieldKey && p.source === "document"
      )
      
      await deletePlaceholder(placeholderToDelete.fieldKey)
      
      toast({
        title: "删除成功",
        description: isInDocument 
          ? `已移除占位符 ${placeholderToDelete.label ?? placeholderToDelete.fieldKey}。请记得保存模板以应用更改。`
          : `已移除占位符 ${placeholderToDelete.label ?? placeholderToDelete.fieldKey}`,
        duration: isInDocument ? 5000 : 3000, // 如果在文档中，显示更长时间
      })
      setDeleteDialogOpen(false)
      setPlaceholderToDelete(null)
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message || "无法删除占位符",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 检查占位符是否已关联
  const isAssociated = useCallback((fieldKey: string) => {
    return associatedPlaceholders.some(p => p.fieldKey === fieldKey)
  }, [associatedPlaceholders])

  const renderPlaceholderItem = (placeholder: PlaceholderMeta) => {
    const backend = placeholder.backendMeta
    const associated = isAssociated(placeholder.fieldKey)
    // 查找对应的关联占位符 ID（如果存在）
    const associatedPlaceholder = associatedPlaceholders.find(p => p.fieldKey === placeholder.fieldKey)
    const displayId = associatedPlaceholder?.id || placeholder.id
    const isSelected = selectedId === displayId || selectedId === placeholder.id
    return (
      <SidebarItem
        key={placeholder.id}
        selected={isSelected}
        onClick={() => selectPlaceholder(displayId)}
        onMouseEnter={() => highlightPlaceholder(displayId)}
        onMouseLeave={() => highlightPlaceholder(null)}
        title={placeholder.label}
        meta={
          <>
            <span className="text-[9px] text-slate-500 font-medium flex-shrink-0">字段</span>
            <span className="text-[10px] font-mono text-blue-600 font-semibold truncate min-w-0 mr-2">{"{{"}{placeholder.fieldKey}{"}}"}</span>
            
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0">
              {backend?.type || placeholder.dataType || "text"}
            </Badge>
            
            <Badge 
              variant="outline" 
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 flex-shrink-0",
                backend?.applicable_template_category === "要素式" && "border-blue-500 text-blue-600 bg-blue-50",
                backend?.applicable_template_category === "陈述式" && "border-purple-500 text-purple-600 bg-purple-50",
                (!backend?.applicable_template_category || backend.applicable_template_category === null) && "border-gray-400 text-gray-600 bg-gray-50"
              )}
            >
              {backend?.applicable_template_category === "要素式" ? "要素式" : 
               backend?.applicable_template_category === "陈述式" ? "陈述式" : "通用"}
            </Badge>
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-6 w-6 p-0",
                isSelected && "text-blue-700 hover:bg-blue-100"
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenEdit(placeholder)
              }}
              title="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "h-6 w-6 p-0 text-red-600",
                isSelected && "text-red-600 hover:bg-red-50"
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteClick(placeholder)
              }}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        }
        status={
          <Badge
            variant={associated ? "default" : "secondary"}
            className={cn(
              "text-[9px] flex-shrink-0 font-medium px-1.5 py-0 h-4 flex items-center gap-1",
              associated
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-slate-200 text-slate-600"
            )}
          >
            {associated ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                已关联
              </>
            ) : (
              <>
                <Circle className="h-3 w-3" />
                未关联
              </>
            )}
          </Badge>
        }
      />
    )
  }

  return (
    <>
      <SidebarLayout
        className="col-span-4 h-[calc(100vh-200px)]"
        title={
          <>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {totalCount}
            </Badge>
            {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
          </>
        }
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isSyncing}
              className="h-6 w-6 p-0 text-slate-500 hover:text-blue-600"
              title="刷新占位符"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
            </Button>
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="h-6 px-2 text-[10px] font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex-shrink-0"
            >
              <Plus className="h-3 w-3 mr-1" />
              新占位符
            </Button>
          </div>
        }
        subheader={
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="搜索占位符..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 text-xs"
            />
          </div>
        }
        isLoading={isSyncing}
        isEmpty={totalCount === 0 && !searchQuery}
        emptyState={
          <div className="p-8 text-center text-muted-foreground">
            <Hash className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无占位符</p>
            <p className="text-xs mt-1">点击"新占位符"按钮添加占位符</p>
          </div>
        }
      >
        {filteredPlaceholders.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {searchQuery ? "没有匹配的占位符" : "暂无占位符"}
          </div>
        ) : (
          filteredPlaceholders.map(renderPlaceholderItem)
        )}
      </SidebarLayout>

      <Dialog 
        open={createDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlaceholder ? "编辑占位符" : "新建占位符"}</DialogTitle>
            <DialogDescription>
              {editingPlaceholder ? "修改占位符配置信息" : "创建新的占位符"}
            </DialogDescription>
          </DialogHeader>
          <PlaceholderFormFields
            formId={formId}
            formData={formData}
            onChange={setFormData}
            disabled={isSubmitting}
            templateCategory={templateCategory}
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要移除占位符 "
              {placeholderToDelete?.label ?? placeholderToDelete?.fieldKey}
              " 吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

