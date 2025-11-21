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
  Circle,
  CheckCircle2,
} from "lucide-react"
// ✅ 使用新的简化编辑器和交互式预览组件
import { DocumentEditorSimple } from "@/components/template-editor/document-editor-simple"
import { DocumentPreviewEnhanced } from "@/components/template-editor/document-preview-enhanced"
import { DocumentPreviewInteractive } from "@/components/template-editor/document-preview-interactive"
import { FileUploadZone } from "@/components/template-editor/file-upload-zone"
import { PlaceholderList } from "@/components/template-editor/placeholder-list"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlaceholderProvider } from "@/components/template-editor/placeholder-manager"
import {
  convertPlaceholderNodesToText,
  convertTextToPlaceholderNodes,
  cloneJsonContent,
} from "@/components/template-editor/placeholder-transform"
import { SidebarLayout } from "@/components/common/sidebar-layout"
import { SidebarItem } from "@/components/common/sidebar-item"

// 定义三种模式
type ViewMode = "preview" | "placeholder-management" | "document-edit"

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all")
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // ✅ 新增：模式状态（替代原来的 isEditing）
  const [viewMode, setViewMode] = useState<ViewMode>("preview")
  
  // ✅ 临时编辑状态（用于两种编辑模式）
  const [draftContent, setDraftContent] = useState<any>(null)
  const [draftContentFormat, setDraftContentFormat] = useState<"nodes" | "text" | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<DocumentTemplate | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [placeholderCounts, setPlaceholderCounts] = useState<Record<number, number>>({})
  const { toast } = useToast()

  const normalizeTemplate = useCallback((template: DocumentTemplate): DocumentTemplate => ({
    ...template,
    prosemirror_json: convertTextToPlaceholderNodes(template.prosemirror_json),
  }), [])

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: any = {}
      if (statusFilter !== "all") {
        params.status = statusFilter
      }
      const response = await templateApi.getTemplates(params)
      const normalizedTemplates = (response.data || []).map(normalizeTemplate)
      setTemplates(normalizedTemplates)
      // 如果当前选中的模板被删除，清除选中状态
      if (selectedTemplate && !normalizedTemplates.find(t => t.id === selectedTemplate.id)) {
        setSelectedTemplate(null)
        setViewMode("preview")
        setDraftContent(null)
        setDraftContentFormat(null)
      }
      
      // 为每个模板加载占位符数量
      const counts: Record<number, number> = {}
      for (const template of normalizedTemplates) {
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
  }, [selectedTemplate, toast, statusFilter, normalizeTemplate])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // 选择模板
  const handleSelectTemplate = useCallback((template: DocumentTemplate) => {
    setSelectedTemplate(template)
    setViewMode("preview") // ✅ 重置为预览模式
    setDraftContent(null) // 清除临时编辑状态
    setDraftContentFormat(null)
  }, [])

  // ✅ 进入占位符管理模式
  // ✅ 进入占位符管理模式（初始化临时状态）
  const handleEnterPlaceholderMode = useCallback(() => {
    if (selectedTemplate) {
      setDraftContent(cloneJsonContent(selectedTemplate.prosemirror_json))
      setDraftContentFormat("nodes")
      setViewMode("placeholder-management")
    }
  }, [selectedTemplate])

  // ✅ 进入文档编辑模式（初始化临时状态）
  const handleEnterDocumentEditMode = useCallback(() => {
    if (selectedTemplate) {
      const textDoc = convertPlaceholderNodesToText(selectedTemplate.prosemirror_json)
      setDraftContent(cloneJsonContent(textDoc))
      setDraftContentFormat("text")
      setViewMode("document-edit")
    }
  }, [selectedTemplate])

  // ✅ 保存占位符管理的更改
  const handleSavePlaceholderChanges = useCallback(async () => {
    if (!selectedTemplate || !draftContent) return
    
    setIsLoading(true)
    try {
      const contentToSave =
        draftContentFormat === "nodes"
          ? draftContent
          : convertTextToPlaceholderNodes(draftContent)
      
      const updated = await templateApi.updateTemplate(selectedTemplate.id, {
        prosemirror_json: contentToSave,
      })
      const normalized = normalizeTemplate(updated.data)
      setSelectedTemplate(normalized)
      setDraftContent(null)
      setDraftContentFormat(null)
      setViewMode("preview")
      toast({
        title: "保存成功",
        description: "占位符更改已保存",
      })
      await loadTemplates()
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "无法保存占位符更改",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedTemplate, draftContent, draftContentFormat, toast, loadTemplates, normalizeTemplate])

  // ✅ 取消占位符管理的更改
  const handleCancelPlaceholderChanges = useCallback(() => {
    setDraftContent(null)
    setDraftContentFormat(null)
    setViewMode("preview")
  }, [])

  // ✅ 保存文档编辑
  const handleSaveDocumentChanges = useCallback(async () => {
    if (!selectedTemplate || !draftContent) return
    
    setIsLoading(true)
    try {
      const contentToSave =
        draftContentFormat === "text"
          ? convertTextToPlaceholderNodes(draftContent)
          : draftContent
      const updated = await templateApi.updateTemplate(selectedTemplate.id, {
        prosemirror_json: contentToSave
      })
      const normalized = normalizeTemplate(updated.data)
      setSelectedTemplate(normalized)
      setDraftContent(null)
      setDraftContentFormat(null)
      setViewMode("preview")
      toast({
        title: "保存成功",
        description: "文档更改已保存",
      })
      await loadTemplates()
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "无法保存文档更改",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedTemplate, draftContent, draftContentFormat, toast, loadTemplates, normalizeTemplate])

  // ✅ 取消文档编辑
  const handleCancelDocumentChanges = useCallback(() => {
    setDraftContent(null)
    setDraftContentFormat(null)
    setViewMode("preview")
  }, [])

  // 导出模板
  const handleExport = useCallback(async () => {
    if (!selectedTemplate) return

    setIsLoading(true)
    try {
      const docToExport = convertPlaceholderNodesToText(selectedTemplate.prosemirror_json)
      const blob = await templateApi.exportDocx(
        docToExport,
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
        setSelectedTemplate(normalizeTemplate(updated.data))
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
  }, [toast, loadTemplates, selectedTemplate, normalizeTemplate])

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
        setSelectedTemplate(normalizeTemplate(updated.data))
      }
    } catch (error: any) {
      toast({
        title: "重命名失败",
        description: error.message || "无法重命名模板",
        variant: "destructive",
      })
      throw error
    }
  }, [toast, loadTemplates, selectedTemplate, normalizeTemplate])

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
        setViewMode("preview")
        setDraftContent(null)
        setDraftContentFormat(null)
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
      
      // 如果当前过滤器不是"全部"或"草稿"，则切换到"草稿"以显示新模板
      if (statusFilter === 'published') {
        setStatusFilter('draft')
        // loadTemplates 将由 useEffect 触发，因为 statusFilter 改变了
      } else {
        await loadTemplates()
      }
      
      // 自动选中新创建的模板
      setSelectedTemplate(normalizeTemplate(response.data))
      setDraftContent(null)
      setDraftContentFormat(null)
    } catch (error: any) {
      toast({
        title: "上传失败",
        description: error.message || "无法上传模板",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [uploadFile, toast, loadTemplates, normalizeTemplate])
    
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
        {/* ============================================
            模式 3: 文档编辑模式
            - 纯富文本编辑
            - 不显示占位符列表
            ============================================ */}
        {viewMode === "document-edit" && selectedTemplate ? (
          <PlaceholderProvider templateId={selectedTemplate.id}>
            <div className="col-span-12 flex flex-col">
              <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                <CardHeader className="pb-2 pt-2 px-4 flex flex-row items-center justify-between border-b flex-shrink-0">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">模式 3</Badge>
                      <CardTitle className="text-base font-semibold">编辑文档</CardTitle>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      📝 富文本编辑 · 占位符使用 <code className="bg-yellow-100 px-1 rounded">{"{{名称}}"}</code> 格式 · 可像普通文本一样编辑
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleCancelDocumentChanges} variant="outline" size="sm" disabled={isLoading}>
                      <X className="h-4 w-4 mr-2" />
                      取消
                    </Button>
                    <Button onClick={handleSaveDocumentChanges} disabled={isLoading} size="sm">
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          保存
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6" style={{ backgroundColor: '#f5f5f5', minHeight: 0 }}>
                  <DocumentEditorSimple
                    key={`editor-${selectedTemplate.id}`}
                    initialContent={
                      draftContent && draftContentFormat === "text"
                        ? draftContent
                        : cloneJsonContent(convertPlaceholderNodesToText(selectedTemplate.prosemirror_json))
                    }
                    onChange={(json) => {
                      setDraftContent(json)
                      setDraftContentFormat("text")
                    }}
                    isLoading={isLoading}
                  />
                </CardContent>
              </Card>
            </div>
          </PlaceholderProvider>
        
        /* ============================================
            模式 2: 占位符管理模式
            - 左侧：占位符列表（增删改查）
            - 右侧：文档预览（chip可点击）
            ============================================ */
        ) : viewMode === "placeholder-management" && selectedTemplate ? (
          <PlaceholderProvider templateId={selectedTemplate.id}>
            <>
              <PlaceholderList />
              <div className="col-span-8 flex flex-col">
                <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                  <CardHeader className="pb-2 pt-2 px-4 flex flex-row items-center justify-between border-b flex-shrink-0">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">模式 2</Badge>
                        <CardTitle className="text-base font-semibold">管理占位符</CardTitle>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        🏷️ 占位符管理模式 · 点击 <span className="inline-flex items-center bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 rounded text-[10px]">chip</span> 快速配置 · 左侧列表管理所有占位符
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={handleCancelPlaceholderChanges} variant="outline" size="sm" disabled={isLoading}>
                        <X className="h-4 w-4 mr-2" />
                        取消
                      </Button>
                      <Button onClick={handleSavePlaceholderChanges} disabled={isLoading} size="sm">
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            保存更改
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-6" style={{ backgroundColor: '#f5f5f5', minHeight: 0 }}>
                    <div className="flex justify-center">
                      <div 
                        className="bg-white shadow-lg"
                        style={{ 
                          width: '210mm',
                          minHeight: '297mm',
                          maxWidth: '100%',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ padding: '25mm' }}>
                          {/* ✅ 使用交互式预览组件，支持双击插入 */}
                          <DocumentPreviewInteractive 
                            key={`interactive-${selectedTemplate.id}`}
                            content={
                              draftContent && draftContentFormat === "nodes"
                                ? draftContent
                                : cloneJsonContent(selectedTemplate.prosemirror_json)
                            }
                            onChange={(json) => {
                              setDraftContent(json)
                              setDraftContentFormat("nodes")
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          </PlaceholderProvider>
        
        /* ============================================
            模式 1: 预览模式（默认）
            - 纯预览，无占位符列表
            - 提供模式切换按钮
            ============================================ */
        ) : (
          <>
          <SidebarLayout
            className="col-span-4 h-[calc(100vh-200px)]"
            title={
              <>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {templates.length}
                </Badge>
                <Select
                  value={statusFilter}
                  onValueChange={(value: "all" | "draft" | "published") => setStatusFilter(value)}
                >
                  <SelectTrigger className="h-6 w-[80px] text-[10px] px-2 border-slate-200">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-[10px]">全部</SelectItem>
                    <SelectItem value="draft" className="text-[10px]">草稿</SelectItem>
                    <SelectItem value="published" className="text-[10px]">已发布</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <Button
                onClick={() => setUploadDialogOpen(true)}
                size="sm"
                className="h-6 px-2 text-[10px] font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex-shrink-0"
              >
                <Plus className="h-3 w-3 mr-1" />
                新建模板
              </Button>
            }
            isLoading={isLoading}
            isEmpty={templates.length === 0}
            emptyState={
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无模板</p>
                <p className="text-xs mt-1">点击"新建"按钮上传模板</p>
              </div>
            }
          >
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
          </SidebarLayout>

        <div className="col-span-8 flex flex-col">
          {selectedTemplate ? (
            /* ✅ 预览模式也需要 PlaceholderProvider，虽然不启用交互 */
            <PlaceholderProvider templateId={selectedTemplate.id}>
              <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
                <CardHeader className="pb-2 pt-2 px-4 flex flex-row items-center justify-between border-b flex-shrink-0">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">模式 1</Badge>
                      <CardTitle className="text-base font-semibold">预览模板</CardTitle>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      👁️ 预览模式 · 只读查看 · 点击下方按钮进入编辑模式
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleExport} 
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      导出
                    </Button>
                    <Button 
                      onClick={handleEnterPlaceholderMode} 
                      variant="outline"
                      size="sm"
                    >
                      🏷️ 管理占位符
                    </Button>
                    <Button 
                      onClick={handleEnterDocumentEditMode} 
                      size="sm"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      编辑文档
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-6" style={{ backgroundColor: '#f5f5f5', minHeight: 0 }}>
                  <div className="flex justify-center">
                    <div 
                      className="bg-white shadow-lg"
                      style={{ 
                        width: '210mm',
                        minHeight: '297mm',
                        maxWidth: '100%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ padding: '25mm' }}>
                        {/* ✅ 预览模式：不启用占位符交互 */}
                        <DocumentPreviewEnhanced 
                          key={`preview-${selectedTemplate.id}-${selectedTemplate.updated_at}`}
                          content={cloneJsonContent(selectedTemplate.prosemirror_json)}
                          enablePlaceholderInteraction={false}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </PlaceholderProvider>
          ) : (
            <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
              <CardContent className="flex-1 flex items-center justify-center text-muted-foreground" style={{ minHeight: 0 }}>
                <div className="text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">请选择一个模板</p>
                  <p className="text-sm mt-2">从左侧列表中选择模板进行预览或编辑</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
          </>
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
    <SidebarItem
      selected={isSelected}
      onClick={onSelect}
      title={
        isEditingName ? (
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
        ) : template.name
      }
      description={template.description}
      meta={
        <>
          <span className="text-[9px] text-slate-500 font-medium">ID</span>
          <span className="text-[10px] font-mono text-blue-600 font-semibold mr-2">#{template.id}</span>
          {template.category && (
            <>
              <span className="truncate min-w-0">{template.category}</span>
              <span className="flex-shrink-0 mx-1">•</span>
            </>
          )}
          {placeholderCount > 0 && (
            <span className="truncate min-w-0">占位符: {placeholderCount} 个</span>
          )}
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
        </>
      }
      status={
        <Badge
          variant={template.status === "published" ? "default" : "secondary"}
          className={cn(
            "text-[9px] flex-shrink-0 font-medium px-1.5 py-0 h-4 flex items-center gap-1",
            template.status === "published" 
              ? "bg-green-500 hover:bg-green-600 text-white" 
              : "bg-slate-200 text-slate-600"
          )}
        >
          {template.status === "published" ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              已发布
            </>
          ) : (
            <>
              <Circle className="h-3 w-3" />
              草稿
            </>
          )}
        </Badge>
      }
    />
  )
}
