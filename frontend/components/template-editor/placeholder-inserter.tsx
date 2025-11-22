"use client"

/**
 * 占位符插入器
 * 
 * 功能：
 * 1. 搜索已有占位符
 * 2. 选择并插入
 * 3. 快速创建新占位符
 */

import React, { useState, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { usePlaceholderManager } from "./placeholder-manager"
import {
  PlaceholderFormFields,
  PlaceholderFormState,
  createEmptyPlaceholderForm,
  buildPayloadFromFormState,
  isValidFieldKey,
} from "./placeholder-form"
import { useToast } from "@/hooks/use-toast"

interface PlaceholderInserterProps {
  /** 是否打开 */
  open: boolean
  
  /** 关闭回调 */
  onClose: () => void
  
  /** 选择占位符回调 */
  onSelect: (fieldKey: string) => void
  
  /** 自定义类名 */
  className?: string
}

/**
 * 占位符插入器组件
 */
export function PlaceholderInserter({
  open,
  onClose,
  onSelect,
  className,
}: PlaceholderInserterProps) {
  const placeholderManager = usePlaceholderManager()
  const { toast } = useToast()
  const templateCategory = placeholderManager.templateCategory
  
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState<PlaceholderFormState>(createEmptyPlaceholderForm(templateCategory))
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 获取所有系统占位符（已配置的）
  const allPlaceholders = useMemo(() => {
    return placeholderManager.allSystemPlaceholders.filter(p => p.backendMeta)
  }, [placeholderManager.allSystemPlaceholders])
  
  // 筛选占位符
  const filteredPlaceholders = useMemo(() => {
    if (!searchQuery.trim()) return allPlaceholders
    
    const keyword = searchQuery.trim().toLowerCase()
    return allPlaceholders.filter(p => {
      const label = (p.label || "").toLowerCase()
      const fieldKey = (p.fieldKey || "").toLowerCase()
      return label.includes(keyword) || fieldKey.includes(keyword)
    })
  }, [allPlaceholders, searchQuery])
  
  // 常用占位符（取前5个）
  const commonPlaceholders = useMemo(() => {
    return allPlaceholders.slice(0, 5)
  }, [allPlaceholders])
  
  // 处理选择占位符
  const handleSelectPlaceholder = useCallback((fieldKey: string) => {
    onSelect(fieldKey)
    onClose()
    setSearchQuery("")
  }, [onSelect, onClose])
  
  // 处理创建新占位符
  const handleCreateNew = useCallback(() => {
    setShowCreateForm(true)
    // 如果有搜索词，作为默认字段名
    if (searchQuery.trim()) {
      const normalized = searchQuery
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
      
      setFormData({
        ...createEmptyPlaceholderForm(templateCategory),
        fieldKey: normalized,
      })
    }
  }, [searchQuery, templateCategory])
  
  // 提交创建
  const handleSubmitCreate = useCallback(async () => {
    if (!formData.fieldKey?.trim()) {
      toast({
        title: "请填写必填字段",
        description: "占位符名称是必填的",
        variant: "destructive",
      })
      return
    }

    const normalizedFieldKey = formData.fieldKey.trim()
    if (!isValidFieldKey(normalizedFieldKey)) {
      toast({
        title: "字段标识格式错误",
        description: "仅允许以字母开头，可包含字母、数字、下划线、横线或点",
        variant: "destructive",
      })
      return
    }
    
    setIsSubmitting(true)
    try {
      const payload = buildPayloadFromFormState({
        ...formData,
        fieldKey: normalizedFieldKey,
      })
      await placeholderManager.createPlaceholder(payload, { insertIntoDocument: false })
      
      toast({
        title: "创建成功",
        description: "占位符已创建，正在插入...",
      })
      
      // 插入新创建的占位符
      onSelect(normalizedFieldKey)
      onClose()
      setShowCreateForm(false)
      setSearchQuery("")
      setFormData(createEmptyPlaceholderForm(templateCategory))
    } catch (error: any) {
      toast({
        title: "创建失败",
        description: error.message || "无法创建占位符",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, placeholderManager, onSelect, onClose, toast, templateCategory])
  
  // 取消创建
  const handleCancelCreate = useCallback(() => {
    setShowCreateForm(false)
    setFormData(createEmptyPlaceholderForm(templateCategory))
  }, [templateCategory])
  
  // 关闭对话框
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose()
      setSearchQuery("")
      setShowCreateForm(false)
      setFormData(createEmptyPlaceholderForm(templateCategory))
    }
  }, [onClose, isSubmitting, templateCategory])
  
  // 获取占位符图标
  const getFieldIcon = (fieldType?: string) => {
    const icons: Record<string, string> = {
      text: "📝",
      date: "📅",
      number: "🔢",
      select: "📋",
      multiline: "📄",
      boolean: "☑️",
      list: "📑",
    }
    return icons[fieldType || "text"] || "📝"
  }
  
  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={cn("max-w-lg", className)}>
        {showCreateForm ? (
          /* 创建新占位符表单 */
          <>
            <DialogHeader>
              <DialogTitle>创建新占位符</DialogTitle>
              <DialogDescription>
                配置占位符信息，创建后将自动插入到文档
              </DialogDescription>
            </DialogHeader>
            
            <PlaceholderFormFields
              formId="inserter-create"
              formData={formData}
              onChange={setFormData}
              disabled={isSubmitting}
              templateCategory={templateCategory}
            />
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleCancelCreate}
                disabled={isSubmitting}
              >
                返回
              </Button>
              <Button onClick={handleSubmitCreate} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "创建并插入"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* 选择已有占位符 */
          <>
            <DialogHeader>
              <DialogTitle>插入占位符</DialogTitle>
              <DialogDescription>
                选择已有占位符或创建新的占位符
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="搜索占位符（字段名或标签）..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              
              {/* 常用占位符 */}
              {!searchQuery && commonPlaceholders.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">常用占位符</div>
                  <div className="space-y-1">
                    {commonPlaceholders.map((p) => {
                      const category = p.backendMeta?.applicable_template_category
                      return (
                        <button
                          key={`${p.id}-${category || 'null'}`}
                          onClick={() => handleSelectPlaceholder(p.fieldKey)}
                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 transition-colors text-left"
                        >
                          <span className="text-lg">{getFieldIcon(p.backendMeta?.field_type)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{p.label}</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[9px] px-1.5 py-0 h-4 flex-shrink-0",
                                  category === "要素式" && "border-blue-500 text-blue-600 bg-blue-50",
                                  category === "陈述式" && "border-purple-500 text-purple-600 bg-purple-50",
                                  (!category || category === null) && "border-gray-400 text-gray-600 bg-gray-50"
                                )}
                              >
                                {category === "要素式" ? "要素式" : 
                                 category === "陈述式" ? "陈述式" : "通用"}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-500 font-mono truncate">
                              {`{{${p.fieldKey}}}`}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* 所有占位符 */}
              {filteredPlaceholders.length > (searchQuery ? 0 : commonPlaceholders.length) && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    {searchQuery ? "搜索结果" : "所有占位符"}
                  </div>
                  <ScrollArea className="h-64">
                    <div className="space-y-1 pr-4">
                      {filteredPlaceholders
                        .filter(p => !searchQuery || !commonPlaceholders.find(c => c.fieldKey === p.fieldKey))
                        .map((p) => {
                          const category = p.backendMeta?.applicable_template_category
                          return (
                            <button
                              key={`${p.id}-${category || 'null'}`}
                              onClick={() => handleSelectPlaceholder(p.fieldKey)}
                              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 transition-colors text-left"
                            >
                              <span className="text-lg">{getFieldIcon(p.backendMeta?.field_type)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{p.label}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[9px] px-1.5 py-0 h-4 flex-shrink-0",
                                      category === "要素式" && "border-blue-500 text-blue-600 bg-blue-50",
                                      category === "陈述式" && "border-purple-500 text-purple-600 bg-purple-50",
                                      (!category || category === null) && "border-gray-400 text-gray-600 bg-gray-50"
                                    )}
                                  >
                                    {category === "要素式" ? "要素式" : 
                                     category === "陈述式" ? "陈述式" : "通用"}
                                  </Badge>
                                </div>
                                <div className="text-xs text-gray-500 font-mono truncate">
                                  {`{{${p.fieldKey}}}`}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {/* 无结果 */}
              {filteredPlaceholders.length === 0 && searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-sm mb-2">未找到匹配的占位符</div>
                  <div className="text-xs">点击下方按钮创建新占位符</div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleCreateNew} className="gap-2">
                <Plus className="h-4 w-4" />
                创建新占位符
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

