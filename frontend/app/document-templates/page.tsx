"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  FileText,
  Edit,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
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
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    category: "",
  })
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
    // 自动填充名称（去除扩展名）
    const nameWithoutExt = file.name.replace(/\.docx?$/i, "")
    setUploadForm(prev => ({ ...prev, name: nameWithoutExt }))
  }, [])

  // 提交上传
  const handleUploadSubmit = useCallback(async () => {
    if (!uploadFile || !uploadForm.name.trim()) {
      toast({
        title: "请填写模板名称",
        description: "模板名称不能为空",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await templateApi.parseAndSave(uploadFile, {
        name: uploadForm.name.trim(),
        description: uploadForm.description || undefined,
        category: uploadForm.category || undefined,
        status: "draft",
        save_to_cos: true,
      })
      toast({
        title: "上传成功",
        description: "模板已创建",
      })
      setUploadDialogOpen(false)
      setUploadFile(null)
      setUploadForm({ name: "", description: "", category: "" })
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
  }, [uploadFile, uploadForm, toast, loadTemplates])

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 左侧侧栏 - 模板列表 */}
      <div className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              文书模板
            </h2>
            <Button
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              新建
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && templates.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无模板</p>
              <p className="text-sm mt-1">点击"新建"按钮上传模板</p>
            </div>
          ) : (
            <div className="p-2">
              {templates.map((template) => (
                <TemplateListItem
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate?.id === template.id}
                  onSelect={() => handleSelectTemplate(template)}
                  onDelete={(e) => handleDeleteClick(template, e)}
                  onToggleStatus={(e) => handleToggleStatus(template, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTemplate ? (
          <>
            {/* 预览/编辑头部 */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                {selectedTemplate.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTemplate.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      selectedTemplate.status === "published"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    )}
                  >
                    {selectedTemplate.status === "published" ? "已发布" : "草稿"}
                  </span>
                  {selectedTemplate.category && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTemplate.category}
                    </span>
                  )}
                  {selectedTemplate.placeholders?.placeholders.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      占位符: {selectedTemplate.placeholders.placeholders.length} 个
                    </span>
                  )}
                </div>
              </div>
              {!isEditing && (
                <Button onClick={handleStartEdit} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleCancelEdit} variant="outline">
                    取消
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    保存
                  </Button>
                </div>
              )}
            </div>

            {/* 预览/编辑内容 */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              {isEditing ? (
                <DocumentEditor
                  initialContent={editedContent || selectedTemplate.prosemirror_json}
                  onChange={setEditedContent}
                  isLoading={isLoading}
                />
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <DocumentPreview 
                      key={`preview-${selectedTemplate.id}-${selectedTemplate.updated_at}`}
                      content={selectedTemplate.prosemirror_json} 
                    />
                  </CardContent>
                </Card>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>上传新模板</DialogTitle>
            <DialogDescription>
              上传 DOCX 文件并填写模板信息
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
                <p className="text-sm text-muted-foreground mt-2">
                  已选择: {uploadFile.name}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="name">模板名称 *</Label>
              <Input
                id="name"
                value={uploadForm.name}
                onChange={(e) =>
                  setUploadForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="请输入模板名称"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">模板描述</Label>
              <Input
                id="description"
                value={uploadForm.description}
                onChange={(e) =>
                  setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="请输入模板描述（可选）"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={uploadForm.category}
                onChange={(e) =>
                  setUploadForm((prev) => ({ ...prev, category: e.target.value }))
                }
                placeholder="请输入分类（可选）"
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false)
                setUploadFile(null)
                setUploadForm({ name: "", description: "", category: "" })
              }}
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
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onToggleStatus: (e: React.MouseEvent) => void
}

function TemplateListItem({
  template,
  isSelected,
  onSelect,
  onDelete,
  onToggleStatus,
}: TemplateListItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={cn(
        "relative p-3 mb-2 rounded-lg cursor-pointer transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-white hover:bg-gray-100"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-medium truncate", isSelected && "text-primary-foreground")}>
            {template.name}
          </h4>
          {template.description && (
            <p
              className={cn(
                "text-sm mt-1 line-clamp-2",
                isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded",
                isSelected
                  ? template.status === "published"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary-foreground/10 text-primary-foreground"
                  : template.status === "published"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              )}
            >
              {template.status === "published" ? "已发布" : "草稿"}
            </span>
            {template.category && (
              <span
                className={cn(
                  "text-xs",
                  isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {template.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 悬浮操作按钮 */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0",
              isSelected && "text-primary-foreground hover:bg-primary-foreground/20"
            )}
            onClick={onToggleStatus}
            title={template.status === "published" ? "撤回" : "发布"}
          >
            {template.status === "published" ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-7 w-7 p-0 text-destructive",
              isSelected && "text-destructive hover:bg-primary-foreground/20"
            )}
            onClick={onDelete}
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
