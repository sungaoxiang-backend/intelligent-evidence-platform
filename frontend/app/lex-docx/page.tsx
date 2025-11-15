"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Trash2, FileText, Loader2, Upload, Download } from "lucide-react"
import { TemplateList } from "@/components/lex-docx/TemplateList"
import { TemplatePreview } from "@/components/lex-docx/TemplatePreview"
import { TemplateEditor } from "@/components/lex-docx/TemplateEditor"
import {
  lexDocxApi,
  type DocumentTemplate,
  type PlaceholderMetadata,
} from "@/lib/api/lex-docx"
import { useToast } from "@/hooks/use-toast"
import { handleApiError, handleSuccess } from "@/lib/utils/error-handler"
import { cn } from "@/lib/utils"

export default function LexDocxPage() {
  const router = useRouter()
  const { toast } = useToast()

  // 状态管理
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplate | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState(0)

  // 新建模板表单
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: "",
    description: "",
    category: "",
  })

  // 获取当前用户信息（用于权限检查）
  const [isSuperuser, setIsSuperuser] = useState(false)

  useEffect(() => {
    // 从 localStorage 或 API 获取用户信息
    // 这里简化处理，实际应该从认证服务获取
    const checkSuperuser = async () => {
      try {
        // 假设有获取当前用户信息的 API
        // const user = await getUserInfo()
        // setIsSuperuser(user?.is_superuser || false)
        setIsSuperuser(false) // 临时设置，实际应从 API 获取
      } catch (error) {
        console.error("获取用户信息失败:", error)
      }
    }
    checkSuperuser()
  }, [])

  // 处理模板选择
  const handleTemplateSelect = (template: DocumentTemplate | null) => {
    setSelectedTemplate(template)
    setIsEditMode(false) // 切换到预览模式
  }

  // 处理编辑按钮点击
  const handleEditClick = () => {
    if (selectedTemplate?.status === "draft") {
      setIsEditMode(true)
    }
  }

  // 处理保存
  const handleSave = async (
    content: string,
    placeholderMetadata: Record<string, PlaceholderMetadata>
  ) => {
    if (!selectedTemplate) return

    setIsSaving(true)
    try {
      await lexDocxApi.updateTemplate(selectedTemplate.id, {
        content_html: content,
        placeholder_metadata: placeholderMetadata,
      })

      // 刷新模板数据
      const updated = await lexDocxApi.getTemplate(selectedTemplate.id)
      if (updated) {
        setSelectedTemplate(updated)
      }

      toast({
        title: "保存成功",
        description: "模板内容已保存",
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 处理内容变化（用于预览同步）
  const handleContentChange = (content: string) => {
    // 可以在这里实现实时预览更新
    // 目前预览组件会从 selectedTemplate 读取内容
  }

  // 处理新建模板
  const handleCreateTemplate = async () => {
    if (!newTemplateForm.name.trim()) {
      toast({
        title: "创建失败",
        description: "模板名称不能为空",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const newTemplate = await lexDocxApi.createTemplate({
        name: newTemplateForm.name.trim(),
        description: newTemplateForm.description.trim() || undefined,
        category: newTemplateForm.category.trim() || undefined,
        status: "draft",
      })

      // 选择新创建的模板
      setSelectedTemplate(newTemplate)
      setIsEditMode(true) // 自动进入编辑模式

      // 重置表单
      setNewTemplateForm({ name: "", description: "", category: "" })
      setShowCreateDialog(false)

      handleSuccess("模板已创建，可以开始编辑")
    } catch (error) {
      handleApiError(error, "模板创建失败")
    } finally {
      setIsCreating(false)
    }
  }

  // 处理删除模板
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return

    setIsDeleting(true)
    try {
      await lexDocxApi.deleteTemplate(selectedTemplate.id)

      // 清除选择
      setSelectedTemplate(null)
      setShowDeleteDialog(false)

      handleSuccess("模板已删除")
    } catch (error) {
      handleApiError(error, "模板删除失败")
    } finally {
      setIsDeleting(false)
    }
  }

  // 处理状态切换
  const handleStatusChange = async (newStatus: "draft" | "published") => {
    if (!selectedTemplate) return

    setIsUpdatingStatus(true)
    try {
      await lexDocxApi.updateTemplateStatus(selectedTemplate.id, newStatus)

      // 刷新模板数据
      const updated = await lexDocxApi.getTemplate(selectedTemplate.id)
      if (updated) {
        setSelectedTemplate(updated)
        setIsEditMode(false) // 切换到预览模式
      }

      setShowStatusDialog(false)

      handleSuccess(`模板已${newStatus === "published" ? "发布" : "设为草稿"}`)
    } catch (error) {
      handleApiError(error, "状态更新失败")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // 处理模板导入
  const handleImportTemplate = async () => {
    if (!importFile) {
      toast({
        title: "导入失败",
        description: "请选择要导入的文件",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const importedTemplate = await lexDocxApi.importTemplate(importFile)

      clearInterval(progressInterval)
      setImportProgress(100)

      // 选择新导入的模板
      setSelectedTemplate(importedTemplate)
      setIsEditMode(true) // 自动进入编辑模式

      // 重置表单
      setImportFile(null)
      setShowImportDialog(false)
      setImportProgress(0)

      toast({
        title: "导入成功",
        description: "模板已导入，可以开始编辑",
      })
    } catch (error) {
      handleApiError(error, "模板导入失败")
    } finally {
      setIsImporting(false)
      setImportProgress(0)
    }
  }

  // 处理模板导出
  const handleExportTemplate = async () => {
    if (!selectedTemplate) return

    setIsExporting(true)
    try {
      const blob = await lexDocxApi.exportTemplate(selectedTemplate.id)

      // 创建下载链接
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${selectedTemplate.name}.docx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      handleSuccess("模板已导出")
    } catch (error) {
      handleApiError(error, "模板导出失败")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3rem)]">
      {/* 左侧边栏：模板列表 */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-background flex flex-col">
        {/* 顶部操作栏 */}
        <div className="p-4 border-b space-y-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="w-full"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
          <Button
            onClick={() => setShowImportDialog(true)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            导入模板
          </Button>
        </div>

        {/* 模板列表 */}
        <div className="flex-1 overflow-hidden">
          <TemplateList
            onTemplateSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?.id}
          />
        </div>
      </div>

      {/* 右侧内容区：预览/编辑 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        {selectedTemplate && (
          <div className="p-4 border-b bg-background flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  selectedTemplate.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                )}
              >
                {selectedTemplate.status === "published" ? "已发布" : "草稿"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 编辑/预览切换（仅草稿状态） */}
              {selectedTemplate.status === "draft" && (
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? "预览" : "编辑"}
                </Button>
              )}

              {/* 状态切换（仅超级用户） */}
              {isSuperuser && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusDialog(true)}
                >
                  {selectedTemplate.status === "published"
                    ? "设为草稿"
                    : "发布模板"}
                </Button>
              )}

              {/* 导出按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTemplate}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    导出
                  </>
                )}
              </Button>

              {/* 删除按钮 */}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </Button>
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {selectedTemplate ? (
            isEditMode && selectedTemplate.status === "draft" ? (
              <TemplateEditor
                template={selectedTemplate}
                onSave={handleSave}
                onContentChange={handleContentChange}
              />
            ) : (
              <TemplatePreview
                template={selectedTemplate}
                onEditClick={handleEditClick}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>请从左侧选择一个模板</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新建模板对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建模板</DialogTitle>
            <DialogDescription>
              创建一个新的文档模板，创建后可以开始编辑内容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="template-name">模板名称 *</Label>
              <Input
                id="template-name"
                value={newTemplateForm.name}
                onChange={(e) =>
                  setNewTemplateForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="请输入模板名称"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="template-description">模板描述</Label>
              <Input
                id="template-description"
                value={newTemplateForm.description}
                onChange={(e) =>
                  setNewTemplateForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="请输入模板描述（可选）"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="template-category">模板分类</Label>
              <Input
                id="template-category"
                value={newTemplateForm.category}
                onChange={(e) =>
                  setNewTemplateForm((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                placeholder="请输入模板分类（可选）"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              取消
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板 "{selectedTemplate?.name}" 吗？此操作无法撤销。
              {selectedTemplate?.status === "published" && (
                <span className="block mt-2 text-destructive">
                  注意：该模板已发布，删除后可能影响已生成的文档。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 状态切换对话框 */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>切换模板状态</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTemplate?.status === "published" ? (
                <>
                  确定要将模板 "{selectedTemplate?.name}" 设为草稿吗？
                  <span className="block mt-2">
                    设为草稿后，该模板将无法用于生成文档。
                  </span>
                </>
              ) : (
                <>
                  确定要发布模板 "{selectedTemplate?.name}" 吗？
                  <span className="block mt-2">
                    发布后，该模板将可用于生成文档。请确保模板内容完整且占位符已正确配置。
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                handleStatusChange(
                  selectedTemplate?.status === "published" ? "draft" : "published"
                )
              }
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : selectedTemplate?.status === "published" ? (
                "设为草稿"
              ) : (
                "发布模板"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 导入模板对话框 */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入模板</DialogTitle>
            <DialogDescription>
              上传 DOCX 格式的模板文件，系统将自动提取占位符并创建模板
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="import-file">选择文件 *</Label>
              <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {importFile ? importFile.name : "点击上传或拖拽文件到此处"}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  支持 DOCX 格式，最大 10MB
                </p>
                <Input
                  type="file"
                  id="import-file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // 验证文件类型
                      if (!file.name.endsWith(".docx")) {
                        toast({
                          title: "文件格式错误",
                          description: "只支持 DOCX 格式的文件",
                          variant: "destructive",
                        })
                        return
                      }
                      // 验证文件大小（10MB）
                      if (file.size > 10 * 1024 * 1024) {
                        toast({
                          title: "文件过大",
                          description: "文件大小不能超过 10MB",
                          variant: "destructive",
                        })
                        return
                      }
                      setImportFile(file)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => document.getElementById("import-file")?.click()}
                >
                  选择文件
                </Button>
              </div>
              {importFile && (
                <div className="mt-2 text-sm text-muted-foreground">
                  已选择: {importFile.name} ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            {/* 上传进度 */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>上传中...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setImportFile(null)
                setImportProgress(0)
              }}
              disabled={isImporting}
            >
              取消
            </Button>
            <Button
              onClick={handleImportTemplate}
              disabled={isImporting || !importFile}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  导入中...
                </>
              ) : (
                "导入"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

