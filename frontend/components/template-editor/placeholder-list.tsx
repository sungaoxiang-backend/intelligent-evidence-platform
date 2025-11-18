"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  Hash,
} from "lucide-react"
import { templateApi } from "@/lib/template-api"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

interface Placeholder {
  id: number
  placeholder_name: string
  type: string
  required: boolean
  hint?: string
  options?: Array<{ label: string; value: string }>
  created_at: string
  updated_at: string
}

interface PlaceholderListProps {
  templateId: number
}

export function PlaceholderList({ templateId }: PlaceholderListProps) {
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingPlaceholder, setEditingPlaceholder] = useState<Placeholder | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [placeholderToDelete, setPlaceholderToDelete] = useState<Placeholder | null>(null)
  const { toast } = useToast()

  // 表单状态
  const [formData, setFormData] = useState({
    placeholder_name: "",
    type: "text",
    required: false,
    hint: "",
    options: [] as Array<{ label: string; value: string }>,
  })

  // 加载占位符列表
  const loadPlaceholders = useCallback(async () => {
    if (!templateId) return
    
    setIsLoading(true)
    try {
      const response = await templateApi.getPlaceholders({ template_id: templateId })
      setPlaceholders(response.data || [])
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message || "无法加载占位符列表",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [templateId, toast])

  useEffect(() => {
    loadPlaceholders()
  }, [loadPlaceholders])

  // 打开创建对话框
  const handleOpenCreate = () => {
    setFormData({
      placeholder_name: "",
      type: "text",
      required: false,
      hint: "",
      options: [],
    })
    setCreateDialogOpen(true)
  }

  // 打开编辑对话框
  const handleOpenEdit = (placeholder: Placeholder) => {
    setEditingPlaceholder(placeholder)
    setFormData({
      placeholder_name: placeholder.placeholder_name,
      type: placeholder.type,
      required: placeholder.required,
      hint: placeholder.hint || "",
      options: placeholder.options || [],
    })
    setCreateDialogOpen(true)
  }

  // 关闭对话框
  const handleCloseDialog = () => {
    setCreateDialogOpen(false)
    setEditingPlaceholder(null)
    setFormData({
      placeholder_name: "",
      type: "text",
      required: false,
      hint: "",
      options: [],
    })
  }

  // 提交表单（创建或更新）
  const handleSubmit = async () => {
    if (!formData.placeholder_name.trim()) {
      toast({
        title: "请输入占位符名称",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      if (editingPlaceholder) {
        // 更新占位符（包括名称）
        await templateApi.updatePlaceholder(editingPlaceholder.placeholder_name, {
          placeholder_name: formData.placeholder_name !== editingPlaceholder.placeholder_name 
            ? formData.placeholder_name 
            : undefined,
          type: formData.type,
          required: formData.required,
          hint: formData.hint || undefined,
          options: formData.options.length > 0 ? formData.options : undefined,
        })
        toast({
          title: "更新成功",
          description: "占位符已更新",
        })
      } else {
        // 创建占位符并关联到模板
        await templateApi.createOrUpdatePlaceholder({
          placeholder_name: formData.placeholder_name,
          type: formData.type,
          required: formData.required,
          hint: formData.hint || undefined,
          options: formData.options.length > 0 ? formData.options : undefined,
        })
        // 关联到模板
        await templateApi.associatePlaceholderToTemplate(templateId, formData.placeholder_name)
        toast({
          title: "创建成功",
          description: "占位符已创建并关联到模板",
        })
      }
      handleCloseDialog()
      await loadPlaceholders()
    } catch (error: any) {
      toast({
        title: editingPlaceholder ? "更新失败" : "创建失败",
        description: error.message || "操作失败",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 删除占位符（从模板中移除关联）
  const handleDeleteClick = (placeholder: Placeholder) => {
    setPlaceholderToDelete(placeholder)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!placeholderToDelete) return

    setIsLoading(true)
    try {
      await templateApi.disassociatePlaceholderFromTemplate(templateId, placeholderToDelete.placeholder_name)
      toast({
        title: "删除成功",
        description: "占位符已从模板中移除",
      })
      setDeleteDialogOpen(false)
      setPlaceholderToDelete(null)
      await loadPlaceholders()
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message || "无法删除占位符",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 添加选项
  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { label: "", value: "" }],
    })
  }

  // 更新选项
  const handleUpdateOption = (index: number, field: "label" | "value", value: string) => {
    const newOptions = [...formData.options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    setFormData({ ...formData, options: newOptions })
  }

  // 删除选项
  const handleRemoveOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    })
  }

  const needsOptions = ["select", "radio", "checkbox"].includes(formData.type)

  return (
    <>
      <Card className="col-span-4">
        <CardHeader className="pb-1.5 pt-2 px-2">
          <div className="flex items-center justify-between w-full gap-1.5">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {placeholders.length}
              </Badge>
            </div>
            <Button
              onClick={handleOpenCreate}
              size="sm"
              className="h-6 px-2 text-[10px] font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex-shrink-0"
            >
              <Plus className="h-3 w-3 mr-1" />
              新建
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading && placeholders.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : placeholders.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Hash className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无占位符</p>
                <p className="text-xs mt-1">点击"新建"按钮添加占位符</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {placeholders.map((placeholder) => (
                  <div
                    key={placeholder.id}
                    className="w-full p-3 rounded-lg border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30 hover:shadow-md transition-all duration-200 group relative"
                  >
                    <div className="flex items-start justify-between gap-3 pr-20">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[9px] text-slate-500 font-medium">ID</span>
                          <span className="text-[10px] font-mono text-blue-600 font-semibold">#{placeholder.id}</span>
                          <span className="text-[9px] text-slate-400 mx-1">•</span>
                          <span className="text-[9px] text-slate-500 font-medium">名称</span>
                          <span className="text-[10px] font-mono text-blue-600 font-semibold">
                            {placeholder.placeholder_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            {placeholder.type}
                          </Badge>
                          {placeholder.required && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                              必填
                            </Badge>
                          )}
                          {placeholder.hint && (
                            <span className="text-slate-400 truncate">{placeholder.hint}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
                        onClick={() => handleOpenEdit(placeholder)}
                        title="编辑"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteClick(placeholder)}
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 创建/编辑对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlaceholder ? "编辑占位符" : "新建占位符"}</DialogTitle>
            <DialogDescription>
              {editingPlaceholder
                ? "修改占位符的配置信息"
                : "创建一个新的占位符并关联到当前模板"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>占位符名称</Label>
              <Input
                value={formData.placeholder_name}
                onChange={(e) => setFormData({ ...formData, placeholder_name: e.target.value })}
                placeholder="例如: plaintiff_name"
                className="mt-2"
              />
            </div>

            <div>
              <Label>类型</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value, options: [] })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">文本 (text)</SelectItem>
                  <SelectItem value="textarea">多行文本 (textarea)</SelectItem>
                  <SelectItem value="select">下拉选择 (select)</SelectItem>
                  <SelectItem value="radio">单选 (radio)</SelectItem>
                  <SelectItem value="checkbox">复选框 (checkbox)</SelectItem>
                  <SelectItem value="date">日期 (date)</SelectItem>
                  <SelectItem value="number">数字 (number)</SelectItem>
                  <SelectItem value="file">文件 (file)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="required"
                checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="required" className="cursor-pointer">
                必填
              </Label>
            </div>

            <div>
              <Label>提示文本（可选）</Label>
              <Input
                value={formData.hint}
                onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                placeholder="例如: 请输入原告姓名"
                className="mt-2"
              />
            </div>

            {needsOptions && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>选项列表</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加选项
                  </Button>
                </div>
                <div className="space-y-2 mt-2">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="标签"
                        value={option.label}
                        onChange={(e) => handleUpdateOption(index, "label", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="值"
                        value={option.value}
                        onChange={(e) => handleUpdateOption(index, "value", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {formData.options.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      点击"添加选项"按钮添加选项
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
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

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要从模板中移除占位符 "{placeholderToDelete?.placeholder_name}" 吗？
              此操作只会移除关联关系，不会删除占位符本身。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

