"use client"

import { useState, useEffect, useRef } from "react"
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
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, FileText, Loader2, Upload, Send, RotateCcw, CheckSquare, Sparkles } from "lucide-react"
import { TemplateList, type TemplateListRef } from "@/components/lex-docx/TemplateList"
import { TemplatePreview } from "@/components/lex-docx/TemplatePreview"
import { InteractiveTemplatePreview, type InteractiveTemplatePreviewRef } from "@/components/lex-docx/InteractiveTemplatePreview"
import { SimpleTemplateEditor, type SimpleTemplateEditorRef } from "@/components/lex-docx/SimpleTemplateEditor"
import { FileUploadZone } from "@/components/lex-docx/FileUploadZone"
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
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const editorRef = useRef<SimpleTemplateEditorRef>(null)
  const interactivePreviewRef = useRef<InteractiveTemplatePreviewRef>(null)
  const templateListRef = useRef<TemplateListRef>(null)
  
  // 多选模式
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set())
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [templateTotal, setTemplateTotal] = useState(0)

  // 新建模板表单
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: "",
    description: "",
    category: "",
  })
  const [smartImport, setSmartImport] = useState(false)

  // 重置新建模板表单
  const resetCreateForm = () => {
    setNewTemplateForm({ name: "", description: "", category: "" })
    setTemplateFile(null)
    setSmartImport(false)
  }

  // 模板管理不需要复杂的权限管理，所有用户都可以发布模板
  const isSuperuser = true

  // 处理模板选择
  const handleTemplateSelect = (template: DocumentTemplate | null) => {
    setSelectedTemplate(template)
    setIsEditMode(false) // 默认切换到预览模式
  }

  // 处理编辑按钮点击
  const handleEditClick = async () => {
    if (!selectedTemplate) return
    
    // 进入编辑模式前，重新从DOCX加载HTML（确保格式完整）
    try {
      const templateForEditing = await lexDocxApi.getTemplate(selectedTemplate.id, true)
      setSelectedTemplate(templateForEditing)
    setIsEditMode(true)
    } catch (error) {
      handleApiError(error, "加载模板失败")
    }
  }

  // 处理取消编辑
  const handleCancelEdit = async () => {
    // 取消编辑时，重新加载模板（恢复原始内容）
    if (selectedTemplate) {
      try {
        const originalTemplate = await lexDocxApi.getTemplate(selectedTemplate.id)
        if (originalTemplate) {
          setSelectedTemplate(originalTemplate)
        }
      } catch (error) {
        handleApiError(error, "加载模板失败")
      }
    }
    setIsEditMode(false)
  }

  // 处理保存编辑
  const handleSaveEdit = async (
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

      // 保存成功后切换到预览模式
      setIsEditMode(false)

      handleSuccess("模板内容已保存")
    } catch (error) {
      handleApiError(error, "模板保存失败")
    } finally {
      setIsSaving(false)
    }
  }

  // 处理内容变化（用于预览同步）
  const handleContentChange = (content: string) => {
    // 可以在这里实现实时预览更新
    // 目前预览组件会从 selectedTemplate 读取内容
  }

  // 处理新建模板（支持文件上传或创建空模板）
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
      let newTemplate: DocumentTemplate

      if (templateFile) {
        // 如果有文件，使用导入API
        newTemplate = await lexDocxApi.importTemplate(templateFile, {
          name: newTemplateForm.name.trim(),
          description: newTemplateForm.description.trim() || undefined,
          category: newTemplateForm.category.trim() || undefined,
          smartImport: smartImport,
        })
        handleSuccess(smartImport ? "模板已智能导入，占位符已自动识别和配置" : "模板已导入，可以开始编辑")
      } else {
        // 如果没有文件，创建空模板
        newTemplate = await lexDocxApi.createTemplate({
        name: newTemplateForm.name.trim(),
        description: newTemplateForm.description.trim() || undefined,
        category: newTemplateForm.category.trim() || undefined,
        status: "draft",
      })
        handleSuccess("模板已创建，可以开始编辑")
      }

      // 不自动选择新创建的模板，让用户手动选择
      // 清除当前选择，确保显示"请选择一个模板"的提示
      setSelectedTemplate(null)
      setIsEditMode(false)

      // 重置表单
      resetCreateForm()
      setShowCreateDialog(false)

      // 刷新模板列表
      templateListRef.current?.refresh()
      
      // 更新模板总数（延迟一下，等待列表刷新）
      setTimeout(() => {
        const total = templateListRef.current?.getTotal() || 0
        setTemplateTotal(total)
      }, 100)
    } catch (error) {
      handleApiError(error, templateFile ? "模板导入失败" : "模板创建失败")
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
      
      // 刷新模板列表
      templateListRef.current?.refresh()
    } catch (error) {
      handleApiError(error, "模板删除失败")
    } finally {
      setIsDeleting(false)
    }
  }

  // 批量操作处理器
  const handleBatchAction = async (
    action: "publish" | "unpublish" | "delete",
    templateIds: number[],
    onSuccess?: () => void
  ) => {
    if (templateIds.length === 0) {
      toast({
        title: "提示",
        description: "请先选择模板",
        variant: "destructive",
      })
      return
    }

    setIsBatchProcessing(true)
    try {
      if (action === "delete") {
        // 确认删除
        if (!confirm(`确定要删除选中的 ${templateIds.length} 个模板吗？此操作无法撤销。`)) {
          setIsBatchProcessing(false)
          return
        }

        const result = await lexDocxApi.batchDeleteTemplates(templateIds)
        handleSuccess(`成功删除 ${result.deleted_count} 个模板`)
        
        // 如果当前选中的模板被删除，清空选择
        if (selectedTemplate && templateIds.includes(selectedTemplate.id)) {
          setSelectedTemplate(null)
        }
      } else {
        const newStatus = action === "publish" ? "published" : "draft"
        const result = await lexDocxApi.batchUpdateTemplateStatus(templateIds, newStatus)
        
        // 检查是否有失败的模板
        if (result.failed_templates && result.failed_templates.length > 0) {
          const failedNames = result.failed_templates.map((f: any) => f.name || `ID:${f.id}`).join("、")
          const reasons = result.failed_templates.map((f: any) => f.reason).join("、")
          toast({
            title: "部分模板操作失败",
            description: `${failedNames}：${reasons}`,
            variant: "destructive",
          })
        }
        
        if (result.updated_count > 0) {
          handleSuccess(
            `成功${action === "publish" ? "发布" : "撤销"} ${result.updated_count} 个模板`
          )
        } else {
          toast({
            title: "操作失败",
            description: "没有模板被更新，请检查模板是否符合发布条件（需要内容、占位符和元数据）",
            variant: "destructive",
          })
        }

        // 如果当前选中的模板状态改变，刷新数据
        if (selectedTemplate && templateIds.includes(selectedTemplate.id)) {
          const updated = await lexDocxApi.getTemplate(selectedTemplate.id)
          if (updated) {
            setSelectedTemplate(updated)
          }
        }
      }

      // 清空选择
      setSelectedTemplateIds(new Set())
      
      // 自动退出多选模式
      setIsMultiSelect(false)
      
      // 强制刷新模板列表（确保状态更新）
      templateListRef.current?.refresh()
      
      // 调用成功回调（用于额外的刷新逻辑）
      onSuccess?.()
    } catch (error) {
      handleApiError(error, "批量操作失败")
    } finally {
      setIsBatchProcessing(false)
    }
  }

  // 切换多选模式
  const handleToggleMultiSelect = () => {
    setIsMultiSelect(!isMultiSelect)
    if (!isMultiSelect) {
      setSelectedTemplateIds(new Set())
    }
  }

  // 定期更新模板总数（用于控制多选按钮的显示）
  useEffect(() => {
    const updateTotal = () => {
      const total = templateListRef.current?.getTotal() || 0
      setTemplateTotal(total)
    }
    
    // 初始更新
    updateTotal()
    
    // 定期更新（每2秒检查一次）
    const interval = setInterval(updateTotal, 2000)
    
    return () => clearInterval(interval)
  }, [])

  // 处理文档生成
  const handleGenerateDocument = async (formData: Record<string, any>) => {
    if (!selectedTemplate) return

    setIsGenerating(true)
    try {
      const result = await lexDocxApi.generateDocument({
        template_id: selectedTemplate.id,
        form_data: formData,
      })

      // 创建下载链接
      const response = await fetch(result.document_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = result.document_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      handleSuccess("文书已生成并下载")
    } catch (error) {
      handleApiError(error, "文书生成失败")
    } finally {
      setIsGenerating(false)
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

      handleSuccess("模板文件已下载")
    } catch (error) {
      handleApiError(error, "模板导出失败")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3rem)]">
      {/* 左侧边栏：模板列表 */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-background flex flex-col shadow-sm">
        {/* 顶部操作栏 */}
        <div className="p-4 border-b bg-muted/30 space-y-2">
          <Button
            onClick={() => {
              resetCreateForm()
              setShowCreateDialog(true)
            }}
            className="w-full shadow-sm"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建模板
          </Button>
          {/* 只有在有模板时才显示多选按钮 */}
          {templateTotal > 0 && (
          <Button
              onClick={handleToggleMultiSelect}
              variant={isMultiSelect ? "default" : "outline"}
            className="w-full"
            size="sm"
          >
              <CheckSquare className="h-4 w-4 mr-2" />
              {isMultiSelect ? "退出多选" : "多选"}
          </Button>
          )}
        </div>

        {/* 模板列表 */}
        <div className="flex-1 overflow-hidden">
          <TemplateList
            ref={templateListRef}
            onTemplateSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?.id}
            isMultiSelect={isMultiSelect}
            selectedTemplateIds={selectedTemplateIds}
            onSelectionChange={setSelectedTemplateIds}
            onBatchAction={handleBatchAction}
          />
        </div>
      </div>

      {/* 右侧内容区：预览/编辑 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        {selectedTemplate && !isEditMode && (
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
              <span
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  selectedTemplate.status === "published"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                )}
              >
                {selectedTemplate.status === "published" ? "已发布" : "草稿"}
              </span>
            </div>
          </div>
        )}

        {/* 编辑模式工具栏 */}
        {isEditMode && selectedTemplate && selectedTemplate.status === "draft" && (
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                草稿
              </span>
            </div>

            <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    取消
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      editorRef.current?.save()
                    }}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      "保存"
                    )}
                  </Button>
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {selectedTemplate ? (
            isEditMode && selectedTemplate.status === "draft" ? (
              <SimpleTemplateEditor
                ref={editorRef}
                template={selectedTemplate}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                onContentChange={handleContentChange}
                isSaving={isSaving}
              />
            ) : selectedTemplate.status === "published" ? (
              <InteractiveTemplatePreview
                ref={interactivePreviewRef}
                template={selectedTemplate}
                onSubmit={handleGenerateDocument}
                isGenerating={isGenerating}
              />
            ) : (
              <TemplatePreview
                template={selectedTemplate}
                onEdit={selectedTemplate.status === "draft" ? handleEditClick : undefined}
                onDownloadTemplate={handleExportTemplate}
                isExporting={isExporting}
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
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            resetCreateForm()
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">新建模板</DialogTitle>
            <DialogDescription className="text-sm">
              创建一个新的文档模板。可以选择上传 DOCX 文件，或创建空白模板后编辑内容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 文件上传区域 */}
            <div>
              <Label>模板文件（可选）</Label>
              <div className="mt-2">
                <FileUploadZone
                  accept=".docx"
                  maxSize={10}
                  onFileSelect={setTemplateFile}
                  selectedFile={templateFile}
                  onRemove={() => setTemplateFile(null)}
                  disabled={isCreating}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                上传 DOCX 文件将自动提取占位符。如果不上传文件，将创建空白模板。
              </p>
            </div>

            {/* 智能导入选项 */}
            {templateFile && (
              <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="smart-import" className="text-base font-medium cursor-pointer">
                      智能导入
                    </Label>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    启用后，系统将自动识别文档中的占位符位置，并智能配置字段类型和元数据
                  </p>
                </div>
                <Switch
                  id="smart-import"
                  checked={smartImport}
                  onCheckedChange={setSmartImport}
                  disabled={isCreating}
                />
              </div>
            )}

            {/* 模板元信息 */}
            <div className="space-y-4">
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
                  disabled={isCreating}
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
                  disabled={isCreating}
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
                  disabled={isCreating}
              />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetCreateForm()
              }}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {templateFile ? "导入中..." : "创建中..."}
                </>
              ) : (
                templateFile ? "导入模板" : "创建模板"
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


    </div>
  )
}

