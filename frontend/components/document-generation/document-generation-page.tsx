"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Download, Save, FileText, Scale } from "lucide-react"
import { DocumentPreviewForm } from "./document-preview-form"
import { documentGenerationApi, type TemplateInfo, type PlaceholderInfo as ApiPlaceholderInfo } from "@/lib/document-generation-api"
import { PlaceholderInfo } from "./placeholder-form-fields"
import type { JSONContent } from "@tiptap/core"
import { EvidenceCardsList } from "./evidence-cards-list"
import { caseApi } from "@/lib/api"
import { type Case } from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import useSWR from "swr"

// 规范化 formData 用于比较（统一格式）
const normalizeFormDataForComparison = (data: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = {}
  for (const key in data) {
    const value = data[key]
    if (Array.isArray(value)) {
      // 清理数组末尾的空值
      const arr = [...value]
      while (arr.length > 1 && arr[arr.length - 1] === "") {
        arr.pop()
      }
      // 如果数组为空，不添加这个键（与空数组等价）
      if (arr.length > 0) {
        normalized[key] = arr
      }
    } else if (value !== undefined && value !== null && value !== "") {
      normalized[key] = value
    }
    // 忽略空字符串、undefined、null
  }
  return normalized
}

export function DocumentGenerationPage() {
  const searchParams = useSearchParams()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [generationId, setGenerationId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [templateContent, setTemplateContent] = useState<JSONContent | null>(null) // 用于管理表格行导出状态
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { toast } = useToast()
  
  const lastSavedFormDataRef = useRef<Record<string, any>>({})
  const hasInitializedCaseIdRef = useRef(false)
  const hasInitializedTemplateRef = useRef(false)

  // 当模板变化时，更新模板内容
  useEffect(() => {
    if (selectedTemplate?.prosemirror_json) {
      // 深拷贝模板内容，避免修改原始模板
      setTemplateContent(JSON.parse(JSON.stringify(selectedTemplate.prosemirror_json)))
    } else {
      setTemplateContent(null)
    }
  }, [selectedTemplate])

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
        // 规范化保存的数据用于比较
        lastSavedFormDataRef.current = normalizeFormDataForComparison(normalizedFormData)
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

  // 检测表单数据变化（包括 DOM 中的值）
  useEffect(() => {
    if (!generationId) return
    
    // 延迟检测，等待 DOM 渲染完成
    const timeoutId = setTimeout(() => {
      // 从 DOM 读取当前值
      const currentFormDataFromDOM: Record<string, any> = {}
      const allInputs = document.querySelectorAll('input[data-field-key], textarea[data-field-key]')

      // 如果没有输入框，说明 DOM 还没渲染完成，不检测
      if (allInputs.length === 0) {
        return
      }

      allInputs.forEach((input) => {
        const fieldKey = input.getAttribute('data-field-key')
        const indexStr = input.getAttribute('data-field-index')
        const value = (input as HTMLInputElement | HTMLTextAreaElement).value

        if (fieldKey) {
          if (indexStr !== null) {
            const index = parseInt(indexStr, 10)
            if (!Array.isArray(currentFormDataFromDOM[fieldKey])) {
              currentFormDataFromDOM[fieldKey] = []
            }
            while (currentFormDataFromDOM[fieldKey].length <= index) {
              currentFormDataFromDOM[fieldKey].push("")
            }
            currentFormDataFromDOM[fieldKey][index] = value
          } else {
            currentFormDataFromDOM[fieldKey] = value
          }
        }
      })

      // 合并 formData 和 DOM 中的值
      const mergedFormData = { ...formData, ...currentFormDataFromDOM }
      
      // 规范化后比较
      const normalizedCurrent = normalizeFormDataForComparison(mergedFormData)
      const normalizedSaved = normalizeFormDataForComparison(lastSavedFormDataRef.current)
      
      const hasChanges = JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)
      setHasUnsavedChanges(hasChanges)
    }, 500) // 延迟 500ms，等待 DOM 渲染完成

    return () => clearTimeout(timeoutId)
  }, [formData, generationId])
  
  // 定期检查 DOM 中的值是否有变化（用于检测未保存的更改）
  useEffect(() => {
    if (!generationId) return
    
    // 延迟启动检测，避免初始化时误触发
    const timeoutId = setTimeout(() => {
      const intervalId = setInterval(() => {
        const currentFormDataFromDOM: Record<string, any> = {}
        const allInputs = document.querySelectorAll('input[data-field-key]:not([type="radio"]):not([type="checkbox"]), textarea[data-field-key]')

        // 如果没有输入框，跳过检测
        if (allInputs.length === 0) {
          return
        }

        allInputs.forEach((input) => {
          const fieldKey = input.getAttribute('data-field-key')
          const indexStr = input.getAttribute('data-field-index')
          const value = (input as HTMLInputElement | HTMLTextAreaElement).value

          if (fieldKey) {
            if (indexStr !== null) {
              const index = parseInt(indexStr, 10)
              if (!Array.isArray(currentFormDataFromDOM[fieldKey])) {
                currentFormDataFromDOM[fieldKey] = []
              }
              while (currentFormDataFromDOM[fieldKey].length <= index) {
                currentFormDataFromDOM[fieldKey].push("")
              }
              currentFormDataFromDOM[fieldKey][index] = value
            } else {
              currentFormDataFromDOM[fieldKey] = value
            }
          }
        })

        // 合并 formData 和 DOM 中的值（优先使用formData，因为包含radio、checkbox等）
        const mergedFormData = { ...formData, ...currentFormDataFromDOM }
        
        // 规范化后比较
        const normalizedCurrent = normalizeFormDataForComparison(mergedFormData)
        const normalizedSaved = normalizeFormDataForComparison(lastSavedFormDataRef.current)
        
        const hasChanges = JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)
        setHasUnsavedChanges(hasChanges)
      }, 2000) // 每2秒检查一次，减少频率

      return () => clearInterval(intervalId)
    }, 2000) // 延迟2秒启动，避免初始化时误触发

    return () => clearTimeout(timeoutId)
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
      // 在保存前，收集所有表单数据：
      // 1. 从formData状态获取最新值（包括radio、checkbox、select等）
      // 2. 从DOM读取input和textarea的值（用于同步内部状态）
      // 3. 合并两者，优先使用formData中的值
      
      // 首先，合并当前的formData（包含所有类型的表单控件值）
      const newFormData: Record<string, any> = { ...formData }
      
      // 从DOM读取input和textarea的值（用于同步可能未更新的内部状态）
      const allInputs = document.querySelectorAll('input[data-field-key]:not([type="radio"]):not([type="checkbox"]), textarea[data-field-key]')

      allInputs.forEach((input) => {
        const fieldKey = input.getAttribute('data-field-key')
        const indexStr = input.getAttribute('data-field-index')
        const value = (input as HTMLInputElement | HTMLTextAreaElement).value

        if (fieldKey) {
          if (indexStr !== null) {
            // 处理数组字段，例如 "姓名[0]"
            const index = parseInt(indexStr, 10)
            if (!Array.isArray(newFormData[fieldKey])) {
              newFormData[fieldKey] = []
            }
            // 确保数组长度足够
            while (newFormData[fieldKey].length <= index) {
              newFormData[fieldKey].push("")
            }
            newFormData[fieldKey][index] = value
          } else {
            // 处理普通字段（只有当formData中没有该字段时才使用DOM值）
            if (!(fieldKey in newFormData)) {
              newFormData[fieldKey] = value
            }
          }
        }
      })
      
      // 从DOM读取radio按钮的值
      const allRadios = document.querySelectorAll('input[type="radio"][data-field-key]:checked')
      allRadios.forEach((radio) => {
        const fieldKey = radio.getAttribute('data-field-key')
        const value = (radio as HTMLInputElement).value
        if (fieldKey && !(fieldKey in newFormData)) {
          newFormData[fieldKey] = value
        }
      })
      
      // 从DOM读取checkbox的值（多选）
      const checkboxGroups = new Map<string, string[]>()
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"][data-field-key]')
      allCheckboxes.forEach((checkbox) => {
        const fieldKey = checkbox.getAttribute('data-field-key')
        const value = (checkbox as HTMLInputElement).value
        const checked = (checkbox as HTMLInputElement).checked
        if (fieldKey) {
          if (!checkboxGroups.has(fieldKey)) {
            checkboxGroups.set(fieldKey, [])
          }
          if (checked) {
            checkboxGroups.get(fieldKey)!.push(value)
          }
        }
      })
      checkboxGroups.forEach((values, fieldKey) => {
        if (!(fieldKey in newFormData)) {
          newFormData[fieldKey] = values
        }
      })
      
      // 从DOM读取select的值
      const allSelects = document.querySelectorAll('[role="combobox"][data-field-key]')
      allSelects.forEach((select) => {
        const fieldKey = select.getAttribute('data-field-key')
        // Select组件的值需要通过其内部的input获取
        const selectInput = select.querySelector('input[value]') as HTMLInputElement
        if (fieldKey && selectInput && !(fieldKey in newFormData)) {
          newFormData[fieldKey] = selectInput.value
        }
      })

      // 清理数组末尾的空值（但保留至少一个值）
      for (const key in newFormData) {
        if (Array.isArray(newFormData[key])) {
          const arr = newFormData[key]
          while (arr.length > 1 && arr[arr.length - 1] === "") {
            arr.pop()
          }
          // 如果数组为空，设置为空数组
          if (arr.length === 0) {
            newFormData[key] = []
          }
        }
      }

      // 合并现有的 formData（保留非输入框字段，包括段落计数等）
      const currentFormData = { ...formData, ...newFormData }
      console.log("Saving formData (merged):", JSON.stringify(currentFormData, null, 2))
      console.log("FormData keys (merged):", Object.keys(currentFormData))
      
      // 同时保存templateContent（包含exportEnabled状态）
      const requestData: any = {
        form_data: currentFormData,
      }
      
      // 如果有templateContent，也保存它（包含exportEnabled状态）
      if (templateContent) {
        requestData.prosemirror_json = templateContent
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
      const savedFormData = updated.form_data || newFormData
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
      
      // 规范化保存的数据用于比较
      lastSavedFormDataRef.current = normalizeFormDataForComparison(normalizedSavedData)
      
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
        // 规范化保存的数据用于比较
        const savedData = updated.form_data || formData
        lastSavedFormDataRef.current = normalizeFormDataForComparison(savedData)
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
      // 传递更新后的模板内容（包含exportEnabled状态）
      const response = await documentGenerationApi.exportGenerationDocument(generationId, {
        prosemirror_json: templateContent || selectedTemplate?.prosemirror_json,
      })
      
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

  // 从 URL 参数读取 caseId 并自动选择案件
  useEffect(() => {
    if (hasInitializedCaseIdRef.current) return
    if (selectedCaseId !== null) return // 如果已经选择了案件，不再从 URL 读取
    
    const caseIdParam = searchParams.get('caseId')
    if (caseIdParam) {
      const caseId = Number(caseIdParam)
      if (!isNaN(caseId) && caseId > 0) {
        // 如果案件列表已加载，验证 caseId 是否存在
        if (cases.length > 0) {
          const caseExists = cases.some(c => c.id === caseId)
          if (caseExists) {
            setSelectedCaseId(caseId)
            hasInitializedCaseIdRef.current = true
          }
        } else {
          // 如果案件列表还未加载，先设置 caseId，后续会验证
          setSelectedCaseId(caseId)
          hasInitializedCaseIdRef.current = true
        }
      }
    }
  }, [searchParams, cases, selectedCaseId])

  // 自动选择首个已发布模板（仅在初始化时执行一次）
  useEffect(() => {
    if (hasInitializedTemplateRef.current) return
    if (templates.length === 0) return
    if (selectedTemplate) return

    // 自动选择第一个模板
    setSelectedTemplate(templates[0])
    hasInitializedTemplateRef.current = true
  }, [templates, selectedTemplate])

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

  const getPartyTypeLabel = (partyType: string | null | undefined): string => {
    if (partyType === 'person') return '个人'
    if (partyType === 'company') return '公司'
    if (partyType === 'individual') return '个体工商户'
    return 'N/A'
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      {/* 顶部：标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">文书生成页面</h1>
      </div>

      {/* 案件信息卡片 - 放在页面顶部 */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
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
          <>
            <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
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

            {/* 债权人和债务人信息 - 左右分布 */}
            {(caseData.case_parties?.find((p: any) => p.party_role === "creditor") || caseData.case_parties?.find((p: any) => p.party_role === "debtor")) && (
              <div className="grid grid-cols-2 gap-4 items-start">
                {/* 债权人信息 */}
                {caseData.case_parties?.find((p: any) => p.party_role === "creditor") && (
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/50">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-blue-500 rounded-full" />
                      <h4 className="text-slate-500 text-sm font-normal">债权人信息</h4>
                    </div>
                    {(() => {
                      const creditor = caseData.case_parties.find((p: any) => p.party_role === "creditor")
                      if (!creditor) return null
                      
                      return (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">债权人类型</label>
                            <div className="text-sm font-medium text-slate-900">
                              {getPartyTypeLabel(creditor.party_type)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">债权人名称</label>
                            <div className="text-sm font-medium text-slate-900">
                              {creditor.party_name || 'N/A'}
                            </div>
                          </div>
                          
                          {/* 根据类型动态渲染必要字段 */}
                          {creditor.party_type === "person" && (
                            <div className="space-y-1">
                              <label className="text-xs text-slate-500">自然人姓名</label>
                              <div className="text-sm font-medium text-slate-900">
                                {creditor.name || 'N/A'}
                              </div>
                            </div>
                          )}

                          {creditor.party_type === "individual" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">个体工商户名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {creditor.company_name || 'N/A'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">经营者名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {creditor.name || 'N/A'}
                                </div>
                              </div>
                            </>
                          )}

                          {creditor.party_type === "company" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">公司名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {creditor.company_name || 'N/A'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">法定代表人名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {creditor.name || 'N/A'}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* 债务人信息 */}
                {caseData.case_parties?.find((p: any) => p.party_role === "debtor") && (
                  <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1 h-5 bg-slate-400 rounded-full" />
                      <h4 className="text-slate-500 text-sm font-normal">债务人信息</h4>
                    </div>
                    {(() => {
                      const debtor = caseData.case_parties.find((p: any) => p.party_role === "debtor")
                      if (!debtor) return null
                      
                      return (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">债务人类型</label>
                            <div className="text-sm font-medium text-slate-900">
                              {getPartyTypeLabel(debtor.party_type)}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">债务人名称</label>
                            <div className="text-sm font-medium text-slate-900">
                              {debtor.party_name || 'N/A'}
                            </div>
                          </div>
                          
                          {/* 根据类型动态渲染必要字段 */}
                          {debtor.party_type === "person" && (
                            <div className="space-y-1">
                              <label className="text-xs text-slate-500">自然人姓名</label>
                              <div className="text-sm font-medium text-slate-900">
                                {debtor.name || 'N/A'}
                              </div>
                            </div>
                          )}

                          {debtor.party_type === "individual" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">个体工商户名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {debtor.company_name || 'N/A'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">经营者名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {debtor.name || 'N/A'}
                                </div>
                              </div>
                            </>
                          )}

                          {debtor.party_type === "company" && (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">公司名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {debtor.company_name || 'N/A'}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">法定代表人名称</label>
                                <div className="text-sm font-medium text-slate-900">
                                  {debtor.name || 'N/A'}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
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
                      content={templateContent || selectedTemplate.prosemirror_json}
                      placeholders={placeholders}
                      formData={formData}
                      templateCategory={selectedTemplate.category}
                      onFormDataChange={(updater) => {
                        if (typeof updater === 'function') {
                          setFormData(updater)
                        } else {
                          setFormData(updater)
                        }
                      }}
                      onContentChange={(updatedContent) => {
                        setTemplateContent(updatedContent)
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

