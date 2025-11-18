"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Edit,
  Trash2,
  Upload,
  Loader2,
  Plus,
  Save,
  Download,
  Send,
  Undo,
  Pencil,
  Check,
  X,
} from "lucide-react"
import { DocumentEditor } from "@/components/template-editor/document-editor"
import { DocumentPreview } from "@/components/template-editor/document-preview"
import { FileUploadZone } from "@/components/template-editor/file-upload-zone"
import {
  templateApi,
  type DocumentTemplate,
} from "@/lib/template-api"
import { cn } from "@/lib/utils"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [placeholderCounts, setPlaceholderCounts] = useState<Record<number, number>>({})
  const { toast } = useToast()

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await templateApi.getTemplates()
      setTemplates(response.data)
      // 如果当前选中的模板被删除，清除选中状态
      if (selectedTemplate && !response.data.find(t => t.id === selectedTemplate.id)) {
        setSelectedTemplate(null)
        setIsEditing(false)
      }
      
      // 为每个模板加载占位符数量
      const counts: Record<number, number> = {}
      for (const template of response.data) {
        try {
          const placeholderResponse = await templateApi.getPlaceholders({ template_id: template.id })
          counts[template.id] = placeholderResponse.total || 0
        } catch (error) {
          // 如果获取占位符失败，设置为 0
          counts[template.id] = 0
        }
      }
      setPlaceholderCounts(counts)
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message || "无法加载模板列表",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedTemplate, toast])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // 选择模板
  const handleSelectTemplate = useCallback((template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setIsEditing(false)
    setEditedContent(null)
  }, [])

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    if (selectedTemplate) {
      setIsEditing(true)
      setEditedContent(selectedTemplate.prosemirror_json)
    }
  }, [selectedTemplate])

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditedContent(null)
  }, [])

  // 导出模板
  const handleExport = useCallback(async () => {
    if (!selectedTemplate) return

    setIsLoading(true)
    try {
      const blob = await templateApi.exportDocx(
        selectedTemplate.prosemirror_json,
        `${selectedTemplate.name}.docx`
      )
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${selectedTemplate.name}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "导出成功",
        description: "模板已导出为 DOCX",
      })
    } catch (error: any) {
      toast({
        title: "导出失败",
        description: error.message || "无法导出模板",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedTemplate, toast])

  // 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!selectedTemplate || !editedContent) return

    setIsLoading(true)
    try {
      await templateApi.updateTemplate(selectedTemplate.id, {
        prosemirror_json: editedContent,
      })
      
      // 先更新本地状态，立即退出编辑模式并显示预览
      setIsEditing(false)
      setEditedContent(null)
      
      // 重新加载模板列表
      await loadTemplates()
      
      // 获取最新的模板数据并更新选中状态
      const updated = await templateApi.getTemplate(selectedTemplate.id)
      setSelectedTemplate(updated.data)
          
          toast({
        title: "保存成功",
        description: "模板已更新",
          })
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "无法保存模板",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedTemplate, editedContent, toast, loadTemplates])

  // 切换状态（发布/撤回）
  const handleToggleStatus = useCallback(async (template: DocumentTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLoading(true)
    try {
      const newStatus = template.status === "draft" ? "published" : "draft"
      await templateApi.updateTemplate(template.id, {
        status: newStatus,
      })
      toast({
        title: "状态已更新",
        description: `模板已${newStatus === "published" ? "发布" : "撤回"}`,
      })
      await loadTemplates()
      // 如果更新的是当前选中的模板，更新选中状态
      if (selectedTemplate?.id === template.id) {
        const updated = await templateApi.getTemplate(template.id)
        setSelectedTemplate(updated.data)
      }
    } catch (error: any) {
    toast({
        title: "操作失败",
        description: error.message || "无法更新模板状态",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, loadTemplates, selectedTemplate])

  // 重命名模板
  const handleRename = useCallback(async (id: number, newName: string) => {
    try {
      await templateApi.updateTemplate(id, {
        name: newName,
      })
    toast({
        title: "重命名成功",
        description: "模板名称已更新",
      })
      await loadTemplates()
      // 如果重命名的是当前选中的模板，更新选中状态
      if (selectedTemplate?.id === id) {
        const updated = await templateApi.getTemplate(id)
        setSelectedTemplate(updated.data)
      }
    } catch (error: any) {
      toast({
        title: "重命名失败",
        description: error.message || "无法重命名模板",
        variant: "destructive",
      })
      throw error
    }
  }, [toast, loadTemplates, selectedTemplate])

  // 删除模板
  const handleDeleteClick = useCallback((template: DocumentTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
    setTemplateToDelete(template)
    setDeleteDialogOpen(true)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!templateToDelete) return

    setIsLoading(true)
    try {
      await templateApi.deleteTemplate(templateToDelete.id)
      toast({
        title: "删除成功",
        description: "模板已删除",
      })
      setDeleteDialogOpen(false)
      setTemplateToDelete(null)
      // 如果删除的是当前选中的模板，清除选中状态
      if (selectedTemplate?.id === templateToDelete.id) {
        setSelectedTemplate(null)
        setIsEditing(false)
      }
      await loadTemplates()
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message || "无法删除模板",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [templateToDelete, selectedTemplate, toast, loadTemplates])

  // 上传文件
  const handleFileSelect = useCallback((file: File) => {
    setUploadFile(file)
  }, [])

  // 提交上传
  const handleUploadSubmit = useCallback(async () => {
    if (!uploadFile) {
      toast({
        title: "请选择文件",
        description: "请先选择要上传的 DOCX 文件",
        variant: "destructive",
      })
      return
    }

    // 检查文件格式
    if (!uploadFile.name.toLowerCase().endsWith('.docx')) {
      toast({
        title: "文件格式错误",
        description: "只支持 .docx 格式的文件",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 自动使用文件名（去除扩展名）作为模板名称
      const nameWithoutExt = uploadFile.name.replace(/\.docx?$/i, "")
      
      const response = await templateApi.parseAndSave(uploadFile, {
        name: nameWithoutExt,
        status: "draft",
        save_to_cos: true,
      })
      toast({
        title: "上传成功",
        description: "模板已创建",
      })
      setUploadDialogOpen(false)
      setUploadFile(null)
      await loadTemplates()
      // 自动选中新创建的模板
      setSelectedTemplate(response.data)
    } catch (error: any) {
      toast({
        title: "上传失败",
        description: error.message || "无法上传模板",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [uploadFile, toast, loadTemplates])
    
        return (
    <div className="w-full space-y-4">
      {/* 页面头部 - 面包屑导航 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>文书模板</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 左侧侧栏 - 模板列表（参照卡片工厂样式） */}
        <Card className="col-span-4">
          <CardHeader className="pb-1.5 pt-2 px-2">
            <div className="flex items-center justify-between w-full gap-1.5">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {templates.length}
                </Badge>
              </div>
              <Button
                onClick={() => setUploadDialogOpen(true)}
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
              {isLoading && templates.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无模板</p>
                  <p className="text-xs mt-1">点击"新建"按钮上传模板</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {templates.map((template) => (
                  <TemplateListItem
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate?.id === template.id}
                    placeholderCount={placeholderCounts[template.id] || 0}
                    onSelect={() => handleSelectTemplate(template)}
                    onDelete={(e) => handleDeleteClick(template, e)}
                    onToggleStatus={(e) => handleToggleStatus(template, e)}
                    onRename={handleRename}
                  />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 右侧内容区域 */}
        <div className="col-span-8 flex flex-col overflow-hidden">
          {selectedTemplate ? (
            <>
              {/* 预览/编辑内容 */}
              <div className="flex-1 overflow-auto relative" style={{ backgroundColor: '#f5f5f5' }}>
              {isEditing ? (
                <>
                  {/* 编辑模式头部 */}
                  <div className="sticky top-0 z-10 p-4 border-b bg-white flex items-center justify-end gap-2">
                    <Button onClick={handleCancelEdit} variant="outline">
                      取消
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={isLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      保存
                    </Button>
                  </div>
                  <div className="p-6">
                    <DocumentEditor
                      initialContent={editedContent || selectedTemplate.prosemirror_json}
                      onChange={setEditedContent}
                      isLoading={isLoading}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* A4纸样式的预览区域 */}
                  <div className="flex-1 overflow-auto p-8">
                    <div 
                      className="mx-auto bg-white shadow-lg relative"
                      style={{ 
                        width: '210mm',
                        minHeight: '297mm',
                        maxWidth: '100%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* 操作按钮 - 放在A4纸右上角 */}
                      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                        <Button 
                          onClick={handleExport} 
                          variant="outline"
                          size="sm"
                          disabled={isLoading}
                          className="h-8 px-3 text-xs shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          导出
                        </Button>
                        <Button 
                          onClick={handleStartEdit} 
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs shadow-sm"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          编辑
                        </Button>
              </div>
                      <div style={{ padding: '25mm' }}>
                        <DocumentPreview 
                          key={`preview-${selectedTemplate.id}-${selectedTemplate.updated_at}`}
                          content={selectedTemplate.prosemirror_json} 
                        />
                      </div>
                    </div>
                  </div>
                </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">请选择一个模板</p>
                <p className="text-sm mt-2">从左侧列表中选择模板进行预览或编辑</p>
              </div>
            </div>
          )}
        </div>
          </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板 "{templateToDelete?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 上传对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>上传新模板</DialogTitle>
            <DialogDescription>
              选择 DOCX 文件，模板名称将自动使用文件名
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>模板文件</Label>
              <div className="mt-2">
                <FileUploadZone
                  onFileSelect={handleFileSelect}
                  isLoading={isLoading}
                />
              </div>
              {uploadFile && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm font-medium text-blue-900">已选择文件</p>
                  <p className="text-sm text-blue-700 mt-1">{uploadFile.name}</p>
                  <p className="text-xs text-blue-600 mt-1">
                    模板名称将自动设置为: {uploadFile.name.replace(/\.docx?$/i, "")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false)
                setUploadFile(null)
              }}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button onClick={handleUploadSubmit} disabled={isLoading || !uploadFile}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  上传
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
  )
}

// 模板列表项组件
interface TemplateListItemProps {
  template: DocumentTemplate
  isSelected: boolean
  placeholderCount: number
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onToggleStatus: (e: React.MouseEvent) => void
  onRename: (id: number, newName: string) => Promise<void>
}

function TemplateListItem({
  template,
  isSelected,
  placeholderCount,
  onSelect,
  onDelete,
  onToggleStatus,
  onRename,
}: TemplateListItemProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(template.name)
  const [isRenaming, setIsRenaming] = useState(false)

  // 当模板名称变化时，同步更新编辑状态
  useEffect(() => {
    if (!isEditingName) {
      setEditedName(template.name)
    }
  }, [template.name, isEditingName])

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditedName(template.name)
    setIsEditingName(true)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditedName(template.name)
    setIsEditingName(false)
  }

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editedName.trim()) {
      return
    }
    if (editedName.trim() === template.name) {
      setIsEditingName(false)
      return
    }
    setIsRenaming(true)
    try {
      await onRename(template.id, editedName.trim())
      setIsEditingName(false)
    } catch (error) {
      setEditedName(template.name)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit(e as any)
    } else if (e.key === 'Escape') {
      handleCancelEdit(e as any)
    }
  }

  return (
    <div
      className={cn(
        "w-full p-3 rounded-lg border text-left transition-all duration-200 hover:shadow-md group relative",
        isSelected
          ? "border-blue-500 shadow-md ring-2 ring-blue-200 bg-blue-50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3 pr-28">
        <div className="flex-1 min-w-0">
          {/* ID */}
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] text-slate-500 font-medium">ID</span>
            <span className="text-[10px] font-mono text-blue-600 font-semibold">#{template.id}</span>
      </div>

          {/* 模板名称 */}
          <div className="mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "flex-1 min-w-0 text-[11px] font-medium px-1.5 py-0.5 border rounded",
                    "focus:outline-none focus:ring-1 focus:ring-blue-500",
                    isSelected ? "text-blue-700 border-blue-300 bg-blue-50" : "text-slate-700 border-slate-300 bg-white"
                  )}
                  autoFocus
                  disabled={isRenaming}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 flex-shrink-0"
                  onClick={handleSaveEdit}
                  disabled={isRenaming || !editedName.trim()}
                  title="保存"
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0 flex-shrink-0"
                  onClick={handleCancelEdit}
                  disabled={isRenaming}
                  title="取消"
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <h4 className={cn(
                "text-[11px] font-medium truncate",
                isSelected ? "text-blue-700" : "text-slate-700"
              )}>
                {template.name}
              </h4>
            )}
                </div>

          {/* 描述 */}
          {template.description && (
            <div className="mb-1">
              <p className={cn(
                "text-[10px] line-clamp-1",
                isSelected ? "text-blue-600/80" : "text-slate-500"
              )}>
                {template.description}
              </p>
                  </div>
                )}

          {/* 元信息 */}
          <div className="flex items-center gap-1 text-[10px] text-slate-500 flex-wrap">
            {template.category && (
              <>
                <span>{template.category}</span>
                <span>•</span>
              </>
            )}
            {placeholderCount > 0 && (
              <span>占位符: {placeholderCount} 个</span>
            )}
              </div>
                </div>
                    </div>

      {/* 常驻操作按钮 - 右上角 */}
      <div className="absolute top-2 right-2 flex gap-3">
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 w-6 p-0",
            isSelected && "text-blue-700 hover:bg-blue-100"
          )}
          onClick={(e) => {
            e.stopPropagation()
            handleStartEdit(e)
          }}
          title="重命名"
          disabled={isEditingName}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 w-6 p-0",
            isSelected && "text-blue-700 hover:bg-blue-100"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleStatus(e)
          }}
          title={template.status === "published" ? "撤回" : "发布"}
        >
          {template.status === "published" ? (
            <Undo className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
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
            onDelete(e)
          }}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        </div>

      {/* 状态徽章 - 右下角 */}
      <div className="absolute bottom-2 right-2">
        <Badge
          variant={template.status === "published" ? "default" : "secondary"}
          className={cn(
            "text-[9px] flex-shrink-0 font-medium px-1.5 py-0 h-4",
            template.status === "published" 
              ? "bg-green-500 hover:bg-green-600 text-white" 
              : "bg-slate-200 text-slate-600"
          )}
        >
          {template.status === "published" ? "已发布" : "草稿"}
        </Badge>
      </div>
    </div>
  )
}
