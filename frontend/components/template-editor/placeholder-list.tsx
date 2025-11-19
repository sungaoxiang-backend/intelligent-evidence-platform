"use client"

import React, { useState, useMemo, useId } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
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
} from "./placeholder-form"

export function PlaceholderList() {
  const {
    orderedPlaceholders,
    selectedId,
    highlightedId,
    selectPlaceholder,
    highlightPlaceholder,
    loadBackendPlaceholders,
    createPlaceholder,
    updatePlaceholder,
    deletePlaceholder,
    isSyncing,
    isMutating,
  } = usePlaceholderManager()

  const { toast } = useToast()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingPlaceholder, setEditingPlaceholder] = useState<PlaceholderMeta | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [placeholderToDelete, setPlaceholderToDelete] = useState<PlaceholderMeta | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState<PlaceholderFormState>(createEmptyPlaceholderForm())

  const placeholderCount = orderedPlaceholders.length
  const formId = useId()
  const fieldIds = useMemo(
    () => ({
      label: `${formId}-label`,
      fieldKey: `${formId}-field-key`,
      type: `${formId}-type`,
      defaultValue: `${formId}-default`,
      description: `${formId}-description`,
    }),
    [formId]
  )

  const handleRefresh = async () => {
    try {
      await loadBackendPlaceholders()
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
    setFormData(createEmptyPlaceholderForm())
  }

  const handleOpenCreate = () => {
    setEditingPlaceholder(null)
    resetForm()
    setCreateDialogOpen(true)
  }

  const handleOpenEdit = (placeholder: PlaceholderMeta) => {
    setEditingPlaceholder(placeholder)
    const backend = placeholder.backendMeta
    setFormData({
      fieldKey: backend?.placeholder_name || placeholder.fieldKey,
      label: backend?.label || placeholder.label || placeholder.fieldKey,
      type: backend?.type || placeholder.dataType || "text",
      required: backend?.required ?? false,
      description: backend?.hint || placeholder.description || "",
      defaultValue: backend?.default_value || placeholder.defaultValue || "",
      options: backend?.options || [],
    })
    setCreateDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setCreateDialogOpen(false)
    setEditingPlaceholder(null)
    resetForm()
  }

  const normalizedOptions = useMemo(
    () => normalizePlaceholderOptions(formData),
    [formData.options]
  )

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
        description: "仅允许使用字母、数字和下划线，且不能以数字开头",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload: PlaceholderPayload = {
        placeholder_name: formData.fieldKey.trim(),
        label: formData.label.trim() || formData.fieldKey.trim(),
        type: formData.type,
        required: formData.required,
        hint: formData.description?.trim() || undefined,
        default_value: formData.defaultValue?.trim() || undefined,
        options: normalizedOptions.length ? normalizedOptions : undefined,
      }

      if (editingPlaceholder) {
        await updatePlaceholder(editingPlaceholder.fieldKey, payload)
        toast({
          title: "更新成功",
          description: `已更新占位符 ${payload.placeholder_name}`,
        })
      } else {
        await createPlaceholder(payload)
        toast({
          title: "创建成功",
          description: `占位符 ${payload.placeholder_name} 已添加`,
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
      await deletePlaceholder(placeholderToDelete.fieldKey)
      toast({
        title: "删除成功",
        description: `已移除占位符 ${placeholderToDelete.label ?? placeholderToDelete.fieldKey}`,
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

  return (
    <>
      <Card className="col-span-4">
        <CardHeader className="pb-1.5 pt-2 px-2">
          <div className="flex items-center justify-between w-full gap-1.5">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {placeholderCount}
              </Badge>
              {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
            </div>
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
              新建
            </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isSyncing && placeholderCount === 0 ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : placeholderCount === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Hash className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无占位符</p>
                <p className="text-xs mt-1">点击"新建"按钮添加占位符</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {orderedPlaceholders.map((placeholder) => {
                  const backend = placeholder.backendMeta
                  return (
                  <div
                    key={placeholder.id}
                      className={cn(
                        "w-full p-3 rounded-lg border bg-white transition-all duration-200 group relative cursor-pointer",
                        selectedId === placeholder.id
                          ? "border-blue-500 shadow-blue-100 shadow-sm"
                          : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md"
                      )}
                      onMouseEnter={() => highlightPlaceholder(placeholder.id)}
                      onMouseLeave={() => highlightPlaceholder(null)}
                      onClick={() => selectPlaceholder(placeholder.id)}
                    >
                      <div className="flex-1 min-w-0 space-y-2 pr-20">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">
                            {placeholder.label}
                          </span>
                          {placeholder.source === "backend" && (
                            <Badge variant="outline" className="h-4 text-[9px] px-1.5">
                              后端
                            </Badge>
                          )}
                          {placeholder.source === "document" && (
                            <Badge variant="outline" className="h-4 text-[9px] px-1.5">
                              文档
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-blue-600">
                          <span className="text-[10px] text-slate-500">字段</span>
                          {"{{"}
                          {placeholder.fieldKey}
                          {"}}"}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {backend?.type || placeholder.dataType || "text"}
                          </Badge>
                          {backend?.required && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                              必填
                            </Badge>
                          )}
                          {placeholder.defaultValue && (
                            <span className="text-slate-400 truncate">
                              默认值：{placeholder.defaultValue}
                            </span>
                          )}
                        </div>
                        {placeholder.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {placeholder.description}
                          </p>
                        )}
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
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
                        className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick(placeholder)
                          }}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={handleCloseDialog}>
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

