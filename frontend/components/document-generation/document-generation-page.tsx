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
  const lastSavedTemplateContentRef = useRef<JSONContent | null>(null) // 跟踪保存的templateContent
  const hasInitializedCaseIdRef = useRef(false)
  const hasInitializedTemplateRef = useRef(false)
  const justSavedRef = useRef<number | null>(null) // 标记刚刚保存的时间戳，暂时跳过检查
  
  // 使用ref来存储最新的formData和templateContent，避免闭包问题
  const formDataRef = useRef<Record<string, any>>(formData)
  const templateContentRef = useRef<JSONContent | null>(templateContent)
  
  // 保持ref与state同步
  useEffect(() => {
    formDataRef.current = formData
  }, [formData])
  
  useEffect(() => {
    templateContentRef.current = templateContent
  }, [templateContent])

  // 当模板变化时，更新模板内容
  // 注意：这个effect会在模板变化时重置templateContent
  // 但实际的恢复逻辑在createOrGetGeneration中，会从草稿中恢复templateContent
  // 为了避免覆盖从草稿恢复的内容，我们只在模板真正变化时重置
  const previousTemplateIdRef = useRef<number | null>(null)
  useEffect(() => {
    const currentTemplateId = selectedTemplate?.id || null
    // 只有在模板ID真正变化时才重置templateContent
    if (currentTemplateId !== previousTemplateIdRef.current) {
      previousTemplateIdRef.current = currentTemplateId
      if (selectedTemplate?.prosemirror_json) {
        // 深拷贝模板内容，避免修改原始模板
        const newContent = JSON.parse(JSON.stringify(selectedTemplate.prosemirror_json))
        setTemplateContent(newContent)
        // 同时更新lastSavedTemplateContentRef，避免误判为未保存
        lastSavedTemplateContentRef.current = newContent
      } else {
        setTemplateContent(null)
        lastSavedTemplateContentRef.current = null
      }
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
        let normalizedFormData = typeof initialFormData === 'object' && initialFormData !== null && !Array.isArray(initialFormData)
          ? initialFormData 
          : {}
        
        // 关键修复：从草稿中恢复templateContent（包含exportEnabled状态）
        const savedTemplateContent = normalizedFormData["__template_content__"]
        let initialTemplateContent: JSONContent | null = null
        if (savedTemplateContent) {
          console.log("DocumentGenerationPage: 从草稿恢复templateContent（包含exportEnabled状态）")
          initialTemplateContent = savedTemplateContent
          setTemplateContent(savedTemplateContent)
        } else {
          // 如果没有保存的templateContent，使用模板的原始内容
          if (selectedTemplate?.prosemirror_json) {
            initialTemplateContent = JSON.parse(JSON.stringify(selectedTemplate.prosemirror_json))
            setTemplateContent(initialTemplateContent)
          }
        }
        
        // 清理旧格式的段落数量key（格式：__paragraph_count_cell-XXX__）
        // 只保留新格式（格式：__paragraph_count_table-X-row-Y-cell-Z__）
        const oldFormatKeys = Object.keys(normalizedFormData).filter(k => 
          k.startsWith("__paragraph_count_") && 
          !k.includes("table-")
        )
        if (oldFormatKeys.length > 0) {
          console.warn("DocumentGenerationPage: 检测到旧格式的段落数量key，已自动清理:", oldFormatKeys)
          oldFormatKeys.forEach(key => {
            delete normalizedFormData[key]
          })
        }
        
        setFormData(normalizedFormData)
        
        // 规范化保存的数据用于比较
        // 初始化时也不要规范化，保留数组长度信息
        lastSavedFormDataRef.current = normalizedFormData
        lastSavedTemplateContentRef.current = initialTemplateContent
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
  // 注意：这个 effect 在 formData 变化时执行，但不会覆盖通过事件设置的"未保存"状态
  // 因为事件处理会直接设置状态，而这个 effect 只是作为补充检查
  useEffect(() => {
    if (!generationId) return
    
    // 延迟检测，等待 DOM 渲染完成
    const timeoutId = setTimeout(() => {
      // 如果刚刚保存（3秒内），跳过检查（避免保存后立即误判为有变化）
      if (justSavedRef.current && Date.now() - justSavedRef.current < 3000) {
        console.log("DocumentGenerationPage: 刚刚保存，跳过检查")
        return
      }
      // 如果超过3秒，清除标志
      if (justSavedRef.current && Date.now() - justSavedRef.current >= 3000) {
        justSavedRef.current = null
      }
      
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

      // 使用ref获取最新的formData和templateContent，避免闭包问题
      const currentFormData = formDataRef.current
      const currentTemplateContent = templateContentRef.current
      
      // 合并 formData 和 DOM 中的值
      const mergedFormData = { ...currentFormData, ...currentFormDataFromDOM }
      
      // 使用与事件处理相同的比较逻辑，考虑数组长度变化
      const compareFormData = (current: Record<string, any>, saved: Record<string, any>): boolean => {
        const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)])
        
        for (const key of allKeys) {
          const currentValue = current[key]
          const savedValue = saved[key]
          
          // 如果都是数组，比较数组长度（即使末尾是空值，长度变化也是变化）
          if (Array.isArray(currentValue) && Array.isArray(savedValue)) {
            if (currentValue.length !== savedValue.length) {
              return true // 有变化
            }
            // 如果长度相同，比较内容（忽略末尾空值）
            const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
            const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
            if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)) {
              return true // 有变化
            }
          } else if (Array.isArray(currentValue) || Array.isArray(savedValue)) {
            // 一个数组，一个非数组，肯定有变化
            return true
          } else {
            // 都不是数组，使用规范化比较
            const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
            const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
            if (normalizedCurrent !== normalizedSaved) {
              return true
            }
          }
        }
        return false // 无变化
      }
      
      const hasFormDataChanges = compareFormData(mergedFormData, lastSavedFormDataRef.current)
      
      // 比较templateContent（exportEnabled状态）
      const currentTemplateContentStr = currentTemplateContent ? JSON.stringify(currentTemplateContent) : null
      const savedTemplateContentStr = lastSavedTemplateContentRef.current ? JSON.stringify(lastSavedTemplateContentRef.current) : null
      const hasTemplateContentChanges = currentTemplateContentStr !== savedTemplateContentStr
      
      const hasChanges = hasFormDataChanges || hasTemplateContentChanges
      
      // 只有当检测到有变化时才更新状态，避免覆盖事件设置的状态
      // 如果当前已经是"未保存"状态，且检测到没有变化，保持 true（可能是事件设置的）
      // 只有在明确检测到有变化时才设置为 true
      setHasUnsavedChanges(prev => {
        if (hasChanges) {
          return true
        }
        // 如果没有变化，且之前是 false（已保存状态），保持 false
        // 这样可以避免保存后立即变为"未保存"
        if (!prev) {
          return false
        }
        // 如果之前是 true，保持 true（可能是事件设置的）
        return prev
      })
    }, 500) // 延迟 500ms，等待 DOM 渲染完成

    return () => clearTimeout(timeoutId)
  }, [formData, templateContent, generationId])
  
  // 立即检查未保存状态的函数
  const checkUnsavedChangesImmediately = useCallback(() => {
    if (!generationId) return
    
    // 如果刚刚保存（3秒内），跳过检查（避免保存后立即误判为有变化）
    if (justSavedRef.current && Date.now() - justSavedRef.current < 3000) {
      console.log("DocumentGenerationPage: 刚刚保存，跳过立即检查")
      return
    }
    // 如果超过3秒，清除标志
    if (justSavedRef.current && Date.now() - justSavedRef.current >= 3000) {
      justSavedRef.current = null
    }
    
    const currentFormDataFromDOM: Record<string, any> = {}
    const allInputs = document.querySelectorAll('input[data-field-key]:not([type="radio"]):not([type="checkbox"]), textarea[data-field-key]')

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

    const currentFormData = formDataRef.current
    const currentTemplateContent = templateContentRef.current
    
    const mergedFormData = { ...currentFormData, ...currentFormDataFromDOM }
    
    // 使用与事件处理相同的比较逻辑，考虑数组长度变化
    const compareFormData = (current: Record<string, any>, saved: Record<string, any>): boolean => {
      const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)])
      
      for (const key of allKeys) {
        const currentValue = current[key]
        const savedValue = saved[key]
        
        // 如果都是数组，比较数组长度（即使末尾是空值，长度变化也是变化）
        if (Array.isArray(currentValue) && Array.isArray(savedValue)) {
          if (currentValue.length !== savedValue.length) {
            return true // 有变化
          }
          // 如果长度相同，比较内容（忽略末尾空值）
          const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
          const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
          if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)) {
            return true // 有变化
          }
        } else if (Array.isArray(currentValue) || Array.isArray(savedValue)) {
          // 一个数组，一个非数组，肯定有变化
          return true
        } else {
          // 都不是数组，使用规范化比较
          const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
          const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
          if (normalizedCurrent !== normalizedSaved) {
            return true
          }
        }
      }
      return false // 无变化
    }
    
    const hasFormDataChanges = compareFormData(mergedFormData, lastSavedFormDataRef.current)
    
    const currentTemplateContentStr = currentTemplateContent ? JSON.stringify(currentTemplateContent) : null
    const savedTemplateContentStr = lastSavedTemplateContentRef.current ? JSON.stringify(lastSavedTemplateContentRef.current) : null
    const hasTemplateContentChanges = currentTemplateContentStr !== savedTemplateContentStr
    
    const hasChanges = hasFormDataChanges || hasTemplateContentChanges
    setHasUnsavedChanges(hasChanges)
  }, [generationId])

  // 监听立即检查事件
  useEffect(() => {
    const handleFormDataChanged = (event: Event) => {
      console.log("DocumentGenerationPage: formDataChanged event received", event)
      const customEvent = event as CustomEvent
      const { newFormData, source, cellId } = customEvent.detail || {}
      
      console.log("DocumentGenerationPage: formDataChanged event detail", { source, cellId, hasNewFormData: !!newFormData })
      
      // 简化逻辑：如果是添加或删除操作，直接设置为未保存状态
      // 不需要复杂的比较，因为这些操作本身就是变化
      if (source === 'handleAdd' || source === 'handleDelete') {
        console.log("DocumentGenerationPage: 检测到添加/删除操作，直接设置为未保存状态")
        setHasUnsavedChanges(true)
        return
      }
      
      // 对于其他操作（如占位符内容变化），使用比较逻辑
      if (newFormData) {
        // 对于数组类型的值，比较时需要考虑数组长度，即使末尾是空值
        // 因为添加段落时，即使新段落是空的，数组长度变化也应该被视为变化
        const compareFormData = (current: Record<string, any>, saved: Record<string, any>): boolean => {
          // 获取所有唯一的键
          const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)])
          
          for (const key of allKeys) {
            const currentValue = current[key]
            const savedValue = saved[key]
            
            // 如果都是数组，比较数组长度（即使末尾是空值，长度变化也是变化）
            if (Array.isArray(currentValue) && Array.isArray(savedValue)) {
              if (currentValue.length !== savedValue.length) {
                console.log(`DocumentGenerationPage: 数组长度变化检测到: ${key}, 当前长度: ${currentValue.length}, 保存长度: ${savedValue.length}`)
                return true // 有变化
              }
              // 如果长度相同，比较内容（忽略末尾空值）
              const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
              const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
              if (JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)) {
                console.log(`DocumentGenerationPage: 数组内容变化检测到: ${key}`)
                return true // 有变化
              }
            } else if (Array.isArray(currentValue) || Array.isArray(savedValue)) {
              // 一个数组，一个非数组，肯定有变化
              console.log(`DocumentGenerationPage: 数组类型变化检测到: ${key}`)
              return true
            } else {
              // 都不是数组，使用规范化比较
              const normalizedCurrent = normalizeFormDataForComparison({ [key]: currentValue })[key]
              const normalizedSaved = normalizeFormDataForComparison({ [key]: savedValue })[key]
              if (normalizedCurrent !== normalizedSaved) {
                console.log(`DocumentGenerationPage: 值变化检测到: ${key}`)
                return true
              }
            }
          }
          return false // 无变化
        }
        
        const hasFormDataChanges = compareFormData(newFormData, lastSavedFormDataRef.current)
        
        const currentTemplateContent = templateContentRef.current
        const currentTemplateContentStr = currentTemplateContent ? JSON.stringify(currentTemplateContent) : null
        const savedTemplateContentStr = lastSavedTemplateContentRef.current ? JSON.stringify(lastSavedTemplateContentRef.current) : null
        const hasTemplateContentChanges = currentTemplateContentStr !== savedTemplateContentStr
        
        const hasChanges = hasFormDataChanges || hasTemplateContentChanges
        console.log("DocumentGenerationPage: 未保存状态检查结果", {
          hasFormDataChanges,
          hasTemplateContentChanges,
          hasChanges,
          currentKeys: Object.keys(newFormData).length,
          savedKeys: Object.keys(lastSavedFormDataRef.current).length
        })
        setHasUnsavedChanges(hasChanges)
      } else {
        // 如果没有新数据，使用常规检查
        console.log("DocumentGenerationPage: 事件中没有新数据，使用常规检查")
        checkUnsavedChangesImmediately()
      }
    }
    
    window.addEventListener('formDataChanged', handleFormDataChanged)
    return () => {
      window.removeEventListener('formDataChanged', handleFormDataChanged)
    }
  }, [checkUnsavedChangesImmediately])

  // 定期检查 DOM 中的值是否有变化（用于检测未保存的更改）
  useEffect(() => {
    if (!generationId) return
    
    // 延迟启动检测，避免初始化时误触发
    const timeoutId = setTimeout(() => {
      const intervalId = setInterval(() => {
        // 如果刚刚保存（3秒内），跳过检查（避免保存后立即误判为有变化）
        if (justSavedRef.current && Date.now() - justSavedRef.current < 3000) {
          console.log("DocumentGenerationPage: 刚刚保存，跳过定期检查")
          return
        }
        // 如果超过3秒，清除标志
        if (justSavedRef.current && Date.now() - justSavedRef.current >= 3000) {
          justSavedRef.current = null
        }
        
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

        // 使用ref获取最新的formData和templateContent，避免闭包问题
        const currentFormData = formDataRef.current
        const currentTemplateContent = templateContentRef.current
        
        // 合并 formData 和 DOM 中的值（优先使用formData，因为包含radio、checkbox等）
        const mergedFormData = { ...currentFormData, ...currentFormDataFromDOM }
        
        // 规范化后比较formData
        const normalizedCurrent = normalizeFormDataForComparison(mergedFormData)
        const normalizedSaved = normalizeFormDataForComparison(lastSavedFormDataRef.current)
        const hasFormDataChanges = JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)
        
        // 比较templateContent（exportEnabled状态）
        const currentTemplateContentStr = currentTemplateContent ? JSON.stringify(currentTemplateContent) : null
        const savedTemplateContentStr = lastSavedTemplateContentRef.current ? JSON.stringify(lastSavedTemplateContentRef.current) : null
        const hasTemplateContentChanges = currentTemplateContentStr !== savedTemplateContentStr
        
        const hasChanges = hasFormDataChanges || hasTemplateContentChanges
        
        // 只有当检测到有变化时才更新状态，避免覆盖事件设置的状态
        // 如果当前已经是"未保存"状态，且检测到没有变化，保持 true（可能是事件设置的）
        // 只有在明确检测到有变化时才设置为 true
        setHasUnsavedChanges(prev => {
          if (hasChanges) {
            return true
          }
          // 如果没有变化，保持之前的状态（不覆盖事件设置的状态）
          return prev
        })
      }, 2000) // 每2秒检查一次，减少频率

      return () => clearInterval(intervalId)
    }, 2000) // 延迟2秒启动，避免初始化时误触发

    return () => clearTimeout(timeoutId)
  }, [generationId]) // 只依赖generationId，使用ref获取最新的formData和templateContent

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
            // 处理普通字段：优先使用DOM中的值（因为DOM中的值是最新的用户输入）
            // 这样可以确保保存时使用的是用户在页面上看到和输入的最新值
            newFormData[fieldKey] = value
          }
        }
      })
      
      // 从DOM读取radio按钮的值（优先使用DOM中的值）
      const allRadios = document.querySelectorAll('input[type="radio"][data-field-key]:checked')
      allRadios.forEach((radio) => {
        const fieldKey = radio.getAttribute('data-field-key')
        const value = (radio as HTMLInputElement).value
        if (fieldKey) {
          newFormData[fieldKey] = value
        }
      })
      
      // 从DOM读取checkbox的值（多选，优先使用DOM中的值）
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
        newFormData[fieldKey] = values
      })
      
      // 从DOM读取select的值（优先使用DOM中的值）
      const allSelects = document.querySelectorAll('[role="combobox"][data-field-key]')
      allSelects.forEach((select) => {
        const fieldKey = select.getAttribute('data-field-key')
        // Select组件的值需要通过其内部的input获取
        const selectInput = select.querySelector('input[value]') as HTMLInputElement
        if (fieldKey && selectInput) {
          newFormData[fieldKey] = selectInput.value
        }
      })

      // 重要：不要清理数组末尾的空值，保留数组长度信息
      // 因为添加段落时，即使新段落是空的，数组长度变化也应该被保存
      // 清理空值会导致数组长度信息丢失，导致保存后刷新时段落丢失
      // 注释掉清理逻辑，保留完整的数组长度信息
      // for (const key in newFormData) {
      //   if (Array.isArray(newFormData[key])) {
      //     const arr = newFormData[key]
      //     while (arr.length > 1 && arr[arr.length - 1] === "") {
      //       arr.pop()
      //     }
      //     if (arr.length === 0) {
      //       newFormData[key] = []
      //     }
      //   }
      // }

      // 关键修复：优先使用newFormData（DOM中的最新值），然后保留formData中的特殊字段
      // 确保所有 __paragraph_count_* 和 __template_content__ 等特殊key都被保留
      const currentFormData = { ...newFormData }
      
      // 保留formData中的特殊字段（段落计数、模板内容等），这些不在DOM中
      Object.keys(formData).forEach(key => {
        if (key.startsWith("__paragraph_count_") || key === "__template_content__") {
          currentFormData[key] = formData[key]
        }
      })
      
      // 关键修复：从templateContent中扫描所有单元格，确保所有需要段落数量key的单元格都有对应的key
      // 这样可以避免因为cellId不稳定导致的段落数量key丢失
      if (templateContent) {
        const { extractAllCells } = await import('./cell-id-utils')
        const allCells = extractAllCells(templateContent)
        
        // 关键修复：确保所有没有占位符的单元格都有对应的段落数量key
        const cellsWithoutPlaceholders = allCells.filter(c => c.placeholders.length === 0)
        console.log("Saving: 从templateContent扫描到的单元格", {
          totalCells: allCells.length,
          cellsWithoutPlaceholders: cellsWithoutPlaceholders.length,
          cellsInfo: cellsWithoutPlaceholders.map(c => ({
            cellId: c.cellId,
            tableIndex: c.tableIndex,
            rowIndex: c.rowIndex,
            cellIndex: c.cellIndex,
            paragraphCountKey: `__paragraph_count_${c.cellId}__`,
            hasKeyInFormData: `__paragraph_count_${c.cellId}__` in formData,
            hasKeyInCurrent: `__paragraph_count_${c.cellId}__` in currentFormData,
            valueInFormData: formData[`__paragraph_count_${c.cellId}__`],
            valueInCurrent: currentFormData[`__paragraph_count_${c.cellId}__`]
          }))
        })
        
        // 确保所有没有占位符的单元格都有对应的段落数量key
        cellsWithoutPlaceholders.forEach(cell => {
          const paragraphCountKey = `__paragraph_count_${cell.cellId}__`
          
          // 如果formData中已经有这个key，保留它
          if (paragraphCountKey in formData) {
            currentFormData[paragraphCountKey] = formData[paragraphCountKey]
            console.log(`Saving: 保留段落数量key ${paragraphCountKey} = ${formData[paragraphCountKey]}`)
          } else {
            console.log(`Saving: 单元格 ${cell.cellId} 没有段落数量key（新格式）`)
          }
        })
        
        // 清理旧格式的段落数量key（格式：__paragraph_count_cell-XXX__）
        // 在清理之前，尝试迁移到新格式
        const oldFormatKeys = Object.keys(currentFormData).filter(k => 
          k.startsWith("__paragraph_count_") && 
          !k.includes("table-")
        )
        if (oldFormatKeys.length > 0) {
          console.warn("Saving: 检测到旧格式的段落数量key，尝试迁移到新格式:", oldFormatKeys)
          
          // 尝试将旧格式的key迁移到新格式
          // 由于无法从旧格式推断新格式，我们只能：
          // 1. 如果formData中已经有新格式的key，保留新格式的值
          // 2. 如果formData中只有旧格式的key，尝试通过单元格内容匹配来迁移
          // 但这种方法不可靠，所以最好的方法是确保cellId生成正确
          
          oldFormatKeys.forEach(oldKey => {
            const oldValue = currentFormData[oldKey]
            console.warn(`Saving: 旧格式key ${oldKey} = ${oldValue}，但无法自动迁移到新格式（需要cellId生成正确）`)
            // 直接删除旧格式的key，因为无法可靠地迁移
            delete currentFormData[oldKey]
          })
        }
      }
      
      // 确保所有段落数量key都被保留（这些key不在DOM中，只在formData状态中）
      const paragraphCountKeys = Object.keys(formData).filter(k => k.startsWith("__paragraph_count_"))
      console.log("Saving: 检查段落数量key", {
        formDataKeys: Object.keys(formData),
        paragraphCountKeys,
        paragraphCountValues: paragraphCountKeys.reduce((acc, k) => {
          acc[k] = formData[k]
          return acc
        }, {} as Record<string, any>),
        newFormDataKeys: Object.keys(newFormData),
      })
      
      paragraphCountKeys.forEach(key => {
        // 确保段落数量key被保留（即使newFormData中没有）
        if (!(key in currentFormData)) {
          currentFormData[key] = formData[key]
          console.log(`Saving: 恢复段落数量key ${key} = ${formData[key]}`)
        }
      })
      
      // 确保 __template_content__ 也被保留（如果存在）
      if ("__template_content__" in formData && !("__template_content__" in newFormData)) {
        currentFormData["__template_content__"] = formData["__template_content__"]
      }
      
      console.log("Saving formData (merged):", JSON.stringify(currentFormData, null, 2))
      console.log("FormData keys (merged):", Object.keys(currentFormData))
      console.log("段落数量key (merged):", Object.keys(currentFormData).filter(k => k.startsWith("__paragraph_count_")))
      
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
      const savedFormData = updated.form_data || currentFormData
      console.log("Saved form_data from server:", savedFormData)
      console.log("Saved form_data type:", typeof savedFormData)
      
      // 确保 savedFormData 是对象
      let savedDataFromServer: Record<string, any>
      if (typeof savedFormData === 'string') {
        // 如果后端返回的是 JSON 字符串，需要解析
        try {
          savedDataFromServer = JSON.parse(savedFormData)
        } catch (e) {
          console.error("Failed to parse savedFormData as JSON:", e)
          savedDataFromServer = currentFormData
        }
      } else if (typeof savedFormData === 'object' && savedFormData !== null && !Array.isArray(savedFormData)) {
        savedDataFromServer = savedFormData
      } else {
        console.warn("Unexpected savedFormData format, using currentFormData")
        savedDataFromServer = currentFormData
      }
      
      console.log("Saved data from server:", JSON.stringify(savedDataFromServer, null, 2))
      
      // 关键修复：使用当前保存的 formData（currentFormData），而不是服务器返回的数据
      // 因为服务器返回的数据可能被规范化了，丢失了数组长度信息
      // 我们需要使用实际保存的数据（currentFormData），它包含了完整的数组长度信息
      const savedDataWithParagraphCounts = { ...currentFormData }
      
      // 确保所有段落数量key都被保留
      Object.keys(formData).forEach(key => {
        if (key.startsWith("__paragraph_count_")) {
          // 确保段落数量key被保留
          if (!(key in savedDataWithParagraphCounts)) {
            savedDataWithParagraphCounts[key] = formData[key]
          }
        }
      })
      
      // 重要：保存时不要规范化数组，保留数组长度信息
      // 这样比较时才能检测到数组长度的变化（即使末尾是空值）
      console.log("Setting lastSavedFormDataRef.current to:", JSON.stringify(savedDataWithParagraphCounts, null, 2))
      lastSavedFormDataRef.current = savedDataWithParagraphCounts
      
      // 更新保存的templateContent引用
      if (templateContent) {
        lastSavedTemplateContentRef.current = JSON.parse(JSON.stringify(templateContent))
      }
      
      // 更新 formData 以确保与服务器同步（使用包含段落数量key的数据）
      setFormData(savedDataWithParagraphCounts)
      
      // 关键修复：立即同步 formDataRef，确保后续的比较逻辑使用正确的值
      formDataRef.current = savedDataWithParagraphCounts
      
      // 标记刚刚保存的时间戳，暂时跳过检查逻辑（避免保存后立即误判为有变化）
      justSavedRef.current = Date.now()
      
      // 清除未保存状态（在更新 ref 之后）
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

    // 关键修复：导出前先保存当前表单数据和templateContent
    // 确保段落数量key和exportEnabled状态都被保存
    try {
      // 合并formData和templateContent
      const requestData: any = {
        form_data: formData,
      }
      
      // 如果有templateContent，也保存它（包含exportEnabled状态）
      if (templateContent) {
        requestData.prosemirror_json = templateContent
      }
      
      // 检查是否有未保存的更改
      const normalizedCurrent = normalizeFormDataForComparison(formData)
      const normalizedSaved = normalizeFormDataForComparison(lastSavedFormDataRef.current)
      const hasFormDataChanges = JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedSaved)
      
      // 比较templateContent（exportEnabled状态）
      const currentTemplateContentStr = templateContent ? JSON.stringify(templateContent) : null
      const savedTemplateContentStr = lastSavedTemplateContentRef.current ? JSON.stringify(lastSavedTemplateContentRef.current) : null
      const hasTemplateContentChanges = currentTemplateContentStr !== savedTemplateContentStr
      
      if (hasFormDataChanges || hasTemplateContentChanges) {
        console.log("DocumentGenerationPage: 导出前保存数据", {
          hasFormDataChanges,
          hasTemplateContentChanges,
          formDataKeys: Object.keys(formData),
          paragraphCountKeys: Object.keys(formData).filter(k => k.startsWith("__paragraph_count_")),
        })
        
        const response = await documentGenerationApi.updateGenerationData(generationId, requestData)
        const updated = (response as any).data || response
        // 保存的数据应该保留数组长度信息（不规范化），用于后续比较
        const savedData = updated.form_data || formData
        lastSavedFormDataRef.current = savedData
        
        // 更新保存的templateContent引用
        if (templateContent) {
          lastSavedTemplateContentRef.current = JSON.parse(JSON.stringify(templateContent))
        }
        
        // 更新formData状态，确保与保存的数据一致
        setFormData(savedData)
        
        // 清除未保存状态（导出前保存后）
        setHasUnsavedChanges(false)
        
        console.log("DocumentGenerationPage: 数据已保存", {
          savedFormDataKeys: Object.keys(savedData),
          savedParagraphCountKeys: Object.keys(savedData).filter(k => k.startsWith("__paragraph_count_")),
        })
      }
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "无法保存表单数据",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      // 传递更新后的模板内容（包含exportEnabled状态）
      // 优先使用templateContent，它应该包含最新的checkbox状态
      let jsonToExport = templateContent || selectedTemplate?.prosemirror_json
      
      // 调试：验证导出前的JSON状态和formData
      console.log("DocumentGenerationPage: 导出前的状态", {
        formDataKeys: Object.keys(formData),
        paragraphCountKeys: Object.keys(formData).filter(k => k.startsWith("__paragraph_count_")),
        paragraphCountValues: Object.keys(formData)
          .filter(k => k.startsWith("__paragraph_count_"))
          .reduce((acc, k) => {
            acc[k] = formData[k]
            return acc
          }, {} as Record<string, any>),
        hasTemplateContent: !!templateContent,
      })
      
      if (jsonToExport) {
        const { extractTableRows } = await import('./table-row-export-control')
        const tableRows = extractTableRows(jsonToExport)
        console.log("DocumentGenerationPage: Exporting with table rows state:", 
          tableRows.map(r => ({
            id: r.id,
            tableIndex: r.tableIndex,
            rowIndex: r.rowIndex,
            exportEnabled: r.exportEnabled,
            previewText: r.previewText.substring(0, 40)
          }))
        )
        
        // 检查是否有未勾选的行
        const uncheckedRows = tableRows.filter(r => r.exportEnabled === false)
        if (uncheckedRows.length > 0) {
          console.log("DocumentGenerationPage: ⚠️ Found unchecked rows that should be excluded:", 
            uncheckedRows.map(r => ({
              id: r.id,
              previewText: r.previewText.substring(0, 40)
            }))
          )
        } else {
          console.log("DocumentGenerationPage: ✅ All rows are checked (or no rows found)")
        }
      } else {
        console.warn("DocumentGenerationPage: ⚠️ No JSON content to export!")
      }
      
      const response = await documentGenerationApi.exportGenerationDocument(generationId, {
        prosemirror_json: jsonToExport,
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
                        variant="default"
                        size="sm"
                        onClick={handleExport}
                        disabled={exporting || !generationId || hasUnsavedChanges}
                        title={hasUnsavedChanges ? "请先保存草稿后再下载文书" : ""}
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
                          setFormData((prevFormData) => {
                            const newFormData = updater(prevFormData)
                            // 立即更新 ref，确保检查未保存状态时能获取到最新数据
                            formDataRef.current = newFormData
                            return newFormData
                          })
                        } else {
                          setFormData(updater)
                          // 立即更新 ref，确保检查未保存状态时能获取到最新数据
                          formDataRef.current = updater
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

