"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Save, FileText } from "lucide-react"
import { TemplateSelector } from "./template-selector"
import { CaseSelector } from "./case-selector"
import { DocumentPreviewForm } from "./document-preview-form"
import { documentGenerationApi, type TemplateInfo, type PlaceholderInfo as ApiPlaceholderInfo } from "@/lib/document-generation-api"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { cn } from "@/lib/utils"

export function DocumentGenerationPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [generationId, setGenerationId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { toast } = useToast()
  
  const lastSavedFormDataRef = useRef<Record<string, any>>({})

  // 转换API占位符格式为组件格式
  const convertPlaceholders = useCallback((apiPlaceholders: ApiPlaceholderInfo[]): PlaceholderInfo[] => {
    return apiPlaceholders.map((p, index) => {
      // API可能返回name或placeholder_name字段
      const placeholderName = (p as any).name || p.placeholder_name || ""
      return {
        id: (p as any).id || index, // 使用API返回的id或索引
        name: placeholderName,
        type: p.type || "text",
        options: p.options,
      }
    })
  }, [])

  // 当模板或案件变化时，创建或获取生成记录
  useEffect(() => {
    if (!selectedTemplate || !selectedCaseId) {
      setGenerationId(null)
      setFormData({})
      return
    }

    const createOrGetGeneration = async () => {
      setLoading(true)
      try {
        const response = await documentGenerationApi.createOrGetGeneration({
          case_id: selectedCaseId,
          template_id: selectedTemplate.id,
        })
        
        // API返回的可能是DocumentGeneration对象或包含data字段的响应
        const generation = (response as any).data || response
        
        if (!generation || !generation.id) {
          throw new Error("创建文书生成记录失败：响应格式错误")
        }
        
        setGenerationId(generation.id)
        const initialFormData = generation.form_data || {}
        // 确保 form_data 是对象
        const normalizedFormData = typeof initialFormData === 'object' && initialFormData !== null && !Array.isArray(initialFormData)
          ? initialFormData 
          : {}
        setFormData(normalizedFormData)
        lastSavedFormDataRef.current = normalizedFormData
        setHasUnsavedChanges(false)
      } catch (error: any) {
        toast({
          title: "加载失败",
          description: error.message || "无法加载文书生成记录",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    createOrGetGeneration()
  }, [selectedTemplate, selectedCaseId, toast])

  // 检测表单数据变化
  useEffect(() => {
    if (!generationId) return
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(lastSavedFormDataRef.current)
    setHasUnsavedChanges(hasChanges)
  }, [formData, generationId])

  // 页面离开前提示
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = "页面不会保存你的更改"
      return "页面不会保存你的更改"
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  // 手动保存
  const handleManualSave = async () => {
    if (!generationId) {
      toast({
        title: "请先选择模板和案件",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      // 使用最新的 formData 进行保存
      const currentFormData = formData
      console.log("Saving formData:", JSON.stringify(currentFormData, null, 2))
      console.log("FormData keys:", Object.keys(currentFormData))
      
      const requestData = {
        form_data: currentFormData,
      }
      console.log("Request data:", JSON.stringify(requestData, null, 2))
      
      const response = await documentGenerationApi.updateGenerationData(generationId, requestData)
      
      console.log("Save response:", response)
      console.log("Save response type:", typeof response)
      console.log("Save response keys:", response ? Object.keys(response) : "null")
      
      // API返回的可能是DocumentGeneration对象或包含data字段的响应
      const updated = (response as any).data || response
      
      if (!updated || !updated.id) {
        console.error("Invalid save response:", updated)
        throw new Error("保存响应格式错误")
      }
      
      // 更新已保存的数据引用
      const savedFormData = updated.form_data || currentFormData
      console.log("Saved form_data from server:", savedFormData)
      console.log("Saved form_data type:", typeof savedFormData)
      
      // 确保 savedFormData 是对象
      let normalizedSavedData: Record<string, any>
      if (typeof savedFormData === 'string') {
        // 如果后端返回的是 JSON 字符串，需要解析
        try {
          normalizedSavedData = JSON.parse(savedFormData)
        } catch (e) {
          console.error("Failed to parse savedFormData as JSON:", e)
          normalizedSavedData = currentFormData
        }
      } else if (typeof savedFormData === 'object' && savedFormData !== null && !Array.isArray(savedFormData)) {
        normalizedSavedData = savedFormData
      } else {
        console.warn("Unexpected savedFormData format, using currentFormData")
        normalizedSavedData = currentFormData
      }
      
      console.log("Normalized saved data:", JSON.stringify(normalizedSavedData, null, 2))
      
      lastSavedFormDataRef.current = normalizedSavedData
      
      // 更新 formData 以确保与服务器同步
      setFormData(normalizedSavedData)
      
      // 清除未保存状态
      setHasUnsavedChanges(false)
      
      toast({
        title: "保存成功",
        description: "表单数据已保存",
      })
    } catch (error: any) {
      console.error("Save error:", error)
      console.error("Save error stack:", error.stack)
      toast({
        title: "保存失败",
        description: error.message || "无法保存表单数据",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // 导出文书
  const handleExport = async () => {
    if (!generationId) {
      toast({
        title: "请先选择模板和案件",
        variant: "destructive",
      })
      return
    }

    // 先保存当前表单数据
    if (JSON.stringify(formData) !== JSON.stringify(lastSavedFormDataRef.current)) {
      try {
        const response = await documentGenerationApi.updateGenerationData(generationId, {
          form_data: formData,
        })
        const updated = (response as any).data || response
        lastSavedFormDataRef.current = updated.form_data || formData
      } catch (error: any) {
        toast({
          title: "保存失败",
          description: error.message || "无法保存表单数据",
          variant: "destructive",
        })
        return
      }
    }

    setExporting(true)
    try {
      const response = await documentGenerationApi.exportGenerationDocument(generationId)
      
      if (response.data?.file_url) {
        // 下载文件
        const link = document.createElement("a")
        link.href = response.data.file_url
        link.download = response.data.filename || "document.docx"
        link.target = "_blank"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // 显示警告信息（如果有）
        const warnings = response.data.warnings || []
        if (warnings.length > 0) {
          toast({
            title: "导出成功（有警告）",
            description: warnings.join("; "),
            variant: "default",
          })
        } else {
          toast({
            title: "导出成功",
            description: `文书已生成并下载`,
          })
        }
      } else {
        throw new Error("导出响应中没有文件URL")
      }
    } catch (error: any) {
      toast({
        title: "导出失败",
        description: error.message || "无法导出文书",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const placeholders: PlaceholderInfo[] = selectedTemplate
    ? convertPlaceholders(selectedTemplate.placeholders || [])
    : []

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">文书生成</h1>
        <p className="text-muted-foreground mt-1">
          选择模板和案件，填写表单数据，生成文书
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 左侧：模板和案件选择 */}
        <div className="lg:col-span-1 space-y-4">
          <TemplateSelector
            selectedTemplateId={selectedTemplate?.id}
            onSelectTemplate={setSelectedTemplate}
          />
          <CaseSelector
            selectedCaseId={selectedCaseId || undefined}
            onSelectCase={setSelectedCaseId}
          />
        </div>

        {/* 右侧：文档预览和表单 */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {!selectedTemplate || !selectedCaseId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    请先选择模板和案件
                  </p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedTemplate.name}</h3>
                      {selectedTemplate.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedTemplate.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasUnsavedChanges && (
                        <span className="text-xs text-orange-600 flex items-center gap-1">
                          (未保存)
                        </span>
                      )}
                      {saving && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          保存中...
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualSave}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        保存
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleExport}
                        disabled={exporting}
                      >
                        {exporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            导出中...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            下载文书
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <DocumentPreviewForm
                      content={selectedTemplate.prosemirror_json}
                      placeholders={placeholders}
                      formData={formData}
                      onFormDataChange={(updater) => {
                        if (typeof updater === 'function') {
                          setFormData(updater)
                        } else {
                          setFormData(updater)
                        }
                      }}
                      className="min-h-[600px]"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

