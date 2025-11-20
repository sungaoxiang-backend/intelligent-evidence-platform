"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { TemplateListSidebar } from "./template-list-sidebar"
import { CaseSelector } from "./case-selector"
import { GenerationTabs } from "./generation-tabs"
import { GenerationForm } from "./generation-form"
import { GenerationPreview } from "./generation-preview"
import {
  documentGenerationApi,
  type TemplateInfo,
  type DocumentGeneration,
} from "@/lib/document-generation-api"
import type { Case } from "@/lib/types"

export interface DocumentGenerationPageProps {
  initialCaseId?: number
  initialTemplateId?: number
}

/**
 * 文书生成主页面
 * 整合所有子组件，管理状态和数据流
 */
export function DocumentGenerationPage({
  initialCaseId,
  initialTemplateId,
}: DocumentGenerationPageProps) {
  const router = useRouter()
  const { toast } = useToast()

  // 状态管理
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null)
  const [generation, setGeneration] = useState<DocumentGeneration | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form")
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // 创建或获取文书生成记录
  const createOrGetGeneration = async (caseId: number, templateId: number) => {
    try {
      setLoading(true)
      const result = await documentGenerationApi.createOrGetGeneration({
        case_id: caseId,
        template_id: templateId,
        form_data: {},
      })
      setGeneration(result)
      setFormData(result.form_data || {})
      setHasUnsavedChanges(false) // 加载已有数据后，清除未保存标记
      
      toast({
        title: "成功",
        description: "文书生成记录已加载",
      })
    } catch (error) {
      console.error("创建或获取文书生成记录失败:", error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "操作失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // 监听案件和模板变化
  useEffect(() => {
    if (selectedCase && selectedTemplate) {
      createOrGetGeneration(selectedCase.id, selectedTemplate.id)
    } else {
      setGeneration(null)
      setFormData({})
      setHasUnsavedChanges(false)
    }
  }, [selectedCase?.id, selectedTemplate?.id])

  // 页面离开提示（有未保存的更改时）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = "" // Chrome 需要设置 returnValue
        return "" // 部分浏览器需要返回字符串
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // 处理字段变化
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }))
    // 标记为有未保存的更改
    setHasUnsavedChanges(true)
  }

  // 手动保存草稿
  const handleSaveDraft = async () => {
    if (!generation?.id) {
      toast({
        title: "错误",
        description: "请先选择案件和模板",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      await documentGenerationApi.updateGenerationData(generation.id, {
        form_data: formData,
      })
      
      setHasUnsavedChanges(false)
      toast({
        title: "保存成功",
        description: "草稿已保存",
      })
    } catch (error) {
      console.error("保存草稿失败:", error)
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "保存失败",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 计算已填写字段数量
  const filledFieldsCount = useMemo(() => {
    if (!selectedTemplate) return 0
    return selectedTemplate.placeholders.filter(
      (p) => formData[p.placeholder_name] !== undefined && formData[p.placeholder_name] !== null && formData[p.placeholder_name] !== ""
    ).length
  }, [selectedTemplate, formData])

  // 导出文书
  const handleExport = async () => {
    if (!generation) {
      toast({
        title: "错误",
        description: "请先选择案件和模板",
        variant: "destructive",
      })
      return
    }

    try {
      setExporting(true)
      
      // 如果有未保存的更改，先保存草稿
      if (hasUnsavedChanges) {
        toast({
          title: "提示",
          description: "正在保存草稿...",
        })
        await documentGenerationApi.updateGenerationData(generation.id, {
          form_data: formData,
        })
        setHasUnsavedChanges(false)
      }

      const result = await documentGenerationApi.exportGenerationDocument(generation.id, {
        filename: selectedTemplate?.name,
      })

      // 下载文件
      window.open(result.data.file_url, "_blank")

      toast({
        title: "导出成功",
        description: result.data.warnings.length > 0
          ? `文书已生成，但有 ${result.data.warnings.length} 个警告`
          : "文书已成功生成",
      })

      // 如果有警告，显示警告信息
      if (result.data.warnings.length > 0) {
        result.data.warnings.forEach((warning) => {
          console.warn("导出警告:", warning)
        })
      }
    } catch (error) {
      console.error("导出文书失败:", error)
      toast({
        title: "导出失败",
        description: error instanceof Error ? error.message : "导出失败",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部工具栏 */}
      <div className="border-b bg-background px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">文书生成</h1>
            <p className="text-sm text-muted-foreground">
              {selectedCase && selectedTemplate
                ? `${selectedCase.description || `案件 #${selectedCase.id}`} - ${selectedTemplate.name}`
                : "请选择案件和模板"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 未保存状态提示 */}
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-orange-600 border-orange-300">
              有未保存的更改
            </Badge>
          )}

          {/* 保存草稿按钮 */}
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={!generation || isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>保存草稿</>
            )}
          </Button>

          {/* 导出按钮 */}
          <Button
            onClick={handleExport}
            disabled={!generation || exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                导出文书
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：模板列表 */}
        <div className="w-80 shrink-0">
          <TemplateListSidebar
            selectedTemplateId={selectedTemplate?.id}
            onSelectTemplate={setSelectedTemplate}
          />
        </div>

        {/* 中间和右侧：内容区 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 案件选择器 */}
          <div className="p-4 border-b">
            <CaseSelector
              selectedCaseId={selectedCase?.id}
              onSelect={setSelectedCase}
            />
          </div>

          {/* 表单和预览区 */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedCase || !selectedTemplate ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium mb-2">开始文书生成</p>
                <p className="text-sm">
                  请先选择一个模板和案件
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden p-4">
              <GenerationTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                filledFieldsCount={filledFieldsCount}
                totalFieldsCount={selectedTemplate.placeholders.length}
                formContent={
                  <GenerationForm
                    placeholders={selectedTemplate.placeholders}
                    formData={formData}
                    onChange={handleFieldChange}
                  />
                }
                previewContent={
                  <GenerationPreview
                    template={selectedTemplate}
                    formData={formData}
                  />
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

