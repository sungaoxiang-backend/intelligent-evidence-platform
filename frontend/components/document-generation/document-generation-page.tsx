"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Save, FileText, Scale } from "lucide-react"
import { DocumentPreviewForm } from "./document-preview-form"
import { documentGenerationApi, type TemplateInfo, type PlaceholderInfo as ApiPlaceholderInfo } from "@/lib/document-generation-api"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { EvidenceCardsList } from "./evidence-cards-list"
import { caseApi } from "@/lib/api"
import { type Case } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useSWR from "swr"

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

  // 获取案件列表
  const casesFetcher = async () => {
    const response = await caseApi.getCases({
      page: 1,
      pageSize: 100,
    })
    return response.data || []
  }

  const { data: cases = [] } = useSWR('/api/cases', casesFetcher, {
    revalidateOnFocus: false,
  })

  // 获取选中的案件详情
  const caseFetcher = async ([_key, caseId]: [string, number]) => {
    const response = await caseApi.getCaseById(caseId)
    return response.data
  }

  const { data: caseData } = useSWR(
    selectedCaseId ? ['/api/case', selectedCaseId] : null,
    caseFetcher,
    {
      revalidateOnFocus: false,
    }
  )

  // 获取模板列表
  const templatesFetcher = async () => {
    const response = await documentGenerationApi.getPublishedTemplates({
      limit: 100,
    })
    return response.data || []
  }

  const { data: templates = [] } = useSWR('/api/templates', templatesFetcher, {
    revalidateOnFocus: false,
  })

  const getCaseDisplayName = (caseItem: Case) => {
    if (caseItem.creditor_name && caseItem.debtor_name) {
      return `${caseItem.creditor_name} vs ${caseItem.debtor_name}`
    }
    if (caseItem.description) {
      return caseItem.description
    }
    return `案件 #${caseItem.id}`
  }

  const getCaseCause = (caseItem: Case) => {
    // 从 case_type 或其他字段获取案由
    return caseItem.case_type || "未设置"
  }

  const getLoanAmount = (caseItem: Case) => {
    if (caseItem.loan_amount) {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 0,
      }).format(caseItem.loan_amount)
    }
    return "未设置"
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      {/* 顶部：标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">文书生成页面</h1>
      </div>

      {/* 案件信息卡片 - 放在页面顶部 */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">案件信息</h3>
          {/* 案件选择器 */}
          <div className="w-64">
            <Select
              value={selectedCaseId?.toString() || ""}
              onValueChange={(value) => setSelectedCaseId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择案件" />
              </SelectTrigger>
              <SelectContent>
                {cases.map((caseItem) => (
                  <SelectItem key={caseItem.id} value={caseItem.id.toString()}>
                    {getCaseDisplayName(caseItem)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* 案件基本信息 - 2x2网格布局，与卡片工厂一致 */}
        {caseData && (
          <div className="p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              案件基本信息
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* 第一行第一列：案件ID */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">案件ID</label>
                <div 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(caseData.id))
                      toast({
                        title: "复制成功",
                        description: "案件ID已复制到剪贴板",
                      })
                    } catch (error) {
                      toast({
                        title: "复制失败",
                        description: "无法复制到剪贴板",
                        variant: "destructive",
                      })
                    }
                  }}
                  className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                  title="点击复制案件ID"
                >
                  #{caseData.id}
                </div>
              </div>
              {/* 第一行第二列：关联用户 */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">关联用户</label>
                <div className="flex items-center gap-2">
                  {caseData.user?.id && (
                    <div 
                      onClick={async () => {
                        if (!caseData.user?.id) return
                        try {
                          await navigator.clipboard.writeText(String(caseData.user.id))
                          toast({
                            title: "复制成功",
                            description: "用户ID已复制到剪贴板",
                          })
                        } catch (error) {
                          toast({
                            title: "复制失败",
                            description: "无法复制到剪贴板",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                      title="点击复制用户ID"
                    >
                      #{caseData.user.id}
                    </div>
                  )}
                  {caseData.user?.wechat_avatar && (
                    <img 
                      src={caseData.user.wechat_avatar} 
                      alt={caseData.user?.name || '用户头像'} 
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => {
                        // 如果图片加载失败，隐藏图片
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  {caseData.user && caseData.user.name && (
                    <div className="text-sm font-medium text-slate-900">
                      {caseData.user.name}
                    </div>
                  )}
                  {!caseData.user && (
                    <div className="text-sm font-medium text-slate-500">N/A</div>
                  )}
                </div>
              </div>
              {/* 第二行第一列：案由 */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">案由</label>
                <div className="text-sm font-medium text-slate-900">
                  {caseData.case_type === 'debt' ? '民间借贷纠纷' : 
                   caseData.case_type === 'contract' ? '买卖合同纠纷' : 
                   getCaseCause(caseData) || 'N/A'}
                </div>
              </div>
              {/* 第二行第二列：欠款金额 */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">欠款金额</label>
                <div className="text-sm font-semibold text-red-600">
                  {caseData.loan_amount !== null && caseData.loan_amount !== undefined
                    ? `¥${caseData.loan_amount.toLocaleString()}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：证据卡片列表 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                证据卡片
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceCardsList caseId={selectedCaseId} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：模板表单 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>模板表单</CardTitle>
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
                    disabled={saving || !generationId}
                      >
                        <Save className="h-4 w-4 mr-2" />
                    保存草稿
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleExport}
                    disabled={exporting || !generationId}
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
            </CardHeader>
            <CardContent>
              {/* 模板选择器 */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">文档类型</label>
                <Select
                  value={selectedTemplate?.id?.toString() || ""}
                  onValueChange={(value) => {
                    const template = templates.find((t) => t.id.toString() === value)
                    if (template) {
                      setSelectedTemplate(template)
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 文档表单 */}
              {!selectedTemplate || !selectedCaseId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    请先选择案件和模板
                  </p>
                </div>
              ) : loading ? (
                <div className="flex items-center justify-center py-16 border rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

