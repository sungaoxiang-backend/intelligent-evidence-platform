"use client"

import { useState, useMemo, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"
import "@/app/lex-docx/docx-styles.css"
import { useForm, Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, Loader2, FileText, Download } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { type DocumentTemplate, type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"

interface InteractiveTemplatePreviewProps {
  template: DocumentTemplate | null
  onSubmit?: (formData: Record<string, any>) => void | Promise<void>
  isGenerating?: boolean
  className?: string
  onDownloadDocument?: () => void
  isExporting?: boolean
}

export interface InteractiveTemplatePreviewRef {
  submit: () => void
}

// 生成 Zod Schema
export const InteractiveTemplatePreview = forwardRef<InteractiveTemplatePreviewRef, InteractiveTemplatePreviewProps>(({
  template,
  onSubmit,
  isGenerating = false,
  className,
  onDownloadDocument,
  isExporting = false,
}, ref) => {
  const formRef = useRef<HTMLFormElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rootsRef = useRef<Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }>>([])
  const placeholderMetadata = template?.placeholder_metadata || {}

  // 计算默认值
  const getDefaultValues = useCallback(() => {
    return Object.fromEntries(
      Object.entries(placeholderMetadata).map(([key, meta]) => {
        // 如果有默认值，使用默认值
        if (meta.default_value !== undefined) {
          return [key, meta.default_value]
        }
        // 根据类型设置默认值
        if (meta.type === "checkbox") {
          // checkbox 类型实际上是 radio（单选），使用第一个选项作为默认值，或者空字符串
          return [key, meta.options && meta.options.length > 0 ? meta.options[0] : ""]
        }
        if (meta.type === "multiselect") {
          return [key, []]
        }
        if (meta.type === "date") {
          return [key, undefined]
        }
        return [key, ""]
      })
    )
  }, [placeholderMetadata])

  const {
    control,
    getValues,
    reset,
  } = useForm({
    // 移除验证，允许直接提交任何值
    mode: "onBlur",
    defaultValues: getDefaultValues(),
  })

  // 当模板改变时，重置表单数据
  useEffect(() => {
    if (template) {
      const defaultValues = getDefaultValues()
      reset(defaultValues)
    }
  }, [template?.id, reset, getDefaultValues])

  // 处理 HTML 内容，将占位符替换为表单组件
  // 使用与 TemplatePreview 相同的方法，保持完整的HTML结构
  const processedHtml = useMemo(() => {
    if (!template?.content_html) {
      return ""
    }

    // 使用正则表达式匹配占位符 {{field_name}}
    const placeholderRegex = /\{\{([^}]+)\}\}/g

    // 转义 HTML 特殊字符（仅用于占位符内容）
    const escapeHtml = (text: string) => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }
      return text.replace(/[&<>"']/g, (m) => map[m])
    }

    // 将 HTML 内容中的占位符替换为特殊标记，稍后在渲染时替换为表单组件
    let processed = template.content_html
    const matches = Array.from(template.content_html.matchAll(placeholderRegex))

    if (matches.length === 0) {
      return template.content_html
    }

    // 从后往前替换，避免索引偏移问题
    // 使用特殊标记来标识占位符位置，稍后在渲染时替换为表单组件
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      const fullMatch = match[0] // {{field_name}}
      const fieldName = match[1].trim() // field_name（去除首尾空格）
      const startIndex = match.index!
      const endIndex = startIndex + fullMatch.length

      // 提取占位符前后的内容
      const before = processed.substring(0, startIndex)
      const after = processed.substring(endIndex)

      // 如果占位符有元数据，使用特殊标记（稍后替换为表单组件）
      // 如果没有元数据，保持高亮显示
      if (placeholderMetadata[fieldName]) {
        // 使用特殊标记，稍后在渲染时替换为表单组件
        const placeholderMarker = `<span data-placeholder-field="${escapeHtml(fieldName)}" class="lex-docx-form-field-marker"></span>`
        processed = before + placeholderMarker + after
      } else {
        // 如果占位符没有元数据，保持原样（高亮显示）
        const highlightedPlaceholder = `<span class="lex-docx-placeholder" data-placeholder="${escapeHtml(fieldName)}" style="background-color: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 500; font-family: 'Courier New', monospace; display: inline-block;">${escapeHtml(fullMatch)}</span>`
        processed = before + highlightedPlaceholder + after
      }
    }

    return processed
  }, [template?.content_html, placeholderMetadata])

  // 渲染内联表单字段（直接替换占位符）
  // 使用 useCallback 以便在 useEffect 中使用
  const renderInlineFormField = useCallback((
    fieldName: string,
    metadata: PlaceholderMetadata
  ) => {
    // 移除验证，不再显示错误
    const hasError = false

    switch (metadata.type) {
      case "text":
      case "number":
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
                <Input
                  {...field}
                  type={metadata.type === "number" ? "number" : "text"}
                  value={field.value ?? ""}
                  className={cn(
                    "lex-docx-form-field-container",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "1.5",
                    padding: "2px 8px",
                    height: "auto",
                    minHeight: "1.5em",
                    width: "200px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    backgroundColor: field.value ? "#e0f2fe" : "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
            )}
          />
        )

      case "date":
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => {
              const [currentMonth, setCurrentMonth] = useState<Date>(field.value || new Date())
              const [open, setOpen] = useState(false)

              // 当字段值改变时，更新当前月份
              useEffect(() => {
                if (field.value) {
                  setCurrentMonth(field.value)
                }
              }, [field.value])

              // 生成年份选项（从1900年到当前年份+10年）
              const currentYear = new Date().getFullYear()
              const years = Array.from({ length: currentYear - 1900 + 11 }, (_, i) => 1900 + i)
              const months = [
                { value: "0", label: "1月" },
                { value: "1", label: "2月" },
                { value: "2", label: "3月" },
                { value: "3", label: "4月" },
                { value: "4", label: "5月" },
                { value: "5", label: "6月" },
                { value: "6", label: "7月" },
                { value: "7", label: "8月" },
                { value: "8", label: "9月" },
                { value: "9", label: "10月" },
                { value: "10", label: "11月" },
                { value: "11", label: "12月" },
              ]

              const handleSelect = (date: Date | undefined) => {
                field.onChange(date)
                setOpen(false)
              }

              const handleYearChange = (year: string) => {
                const newDate = new Date(currentMonth)
                newDate.setFullYear(parseInt(year))
                setCurrentMonth(newDate)
              }

              const handleMonthChange = (month: string) => {
                const newDate = new Date(currentMonth)
                newDate.setMonth(parseInt(month))
                setCurrentMonth(newDate)
              }

              return (
                <span className="inline-block lex-docx-form-field-container">
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "inline-flex justify-start text-left font-normal lex-docx-form-field-container",
                          !field.value && "text-muted-foreground",
                          hasError && "border-destructive",
                          // 使用 Tailwind 类来覆盖背景色，确保优先级
                          field.value ? "!bg-[#e0f2fe]" : "!bg-white"
                        )}
                        style={{
                          fontFamily: "inherit",
                          fontSize: "inherit",
                          lineHeight: "1.5",
                          padding: "2px 8px",
                          height: "auto",
                          minHeight: "1.5em",
                          width: "200px",
                          boxSizing: "border-box",
                          borderColor: "#d1d5db",
                        }}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {field.value ? (
                          format(field.value, "yyyy年M月d日", { locale: zhCN })
                        ) : (
                          <span className="text-muted-foreground">选择日期</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="flex items-center space-x-2">
                          <Select
                            value={currentMonth.getFullYear().toString()}
                            onValueChange={handleYearChange}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}年
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={currentMonth.getMonth().toString()}
                            onValueChange={handleMonthChange}
                          >
                            <SelectTrigger className="h-8 w-16">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {months.map((month) => (
                                <SelectItem key={month.value} value={month.value}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={handleSelect}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        locale={zhCN}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </span>
              )
            }}
          />
        )

      case "textarea":
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
              <span className="inline-block lex-docx-form-field-container">
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  className={cn(
                    "lex-docx-form-field-container",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "1.5",
                    padding: "2px 8px",
                    minHeight: "60px",
                    height: "auto",
                    width: "200px",
                    backgroundColor: field.value ? "#e0f2fe" : "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </span>
            )}
          />
        )

      case "checkbox":
        // 复选框类型应该显示单选按钮组（radio buttons）
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
              <span className="lex-docx-form-field-container">
                {metadata.options?.map((option) => (
                  <span key={option} className="inline-flex items-center space-x-1.5 flex-shrink-0">
                    <input
                      type="radio"
                      id={`${fieldName}_${option}`}
                      name={fieldName}
                      value={option}
                      checked={field.value === option}
                      onChange={() => field.onChange(option)}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 flex-shrink-0"
                    />
                    <Label 
                      htmlFor={`${fieldName}_${option}`} 
                      className="text-sm font-normal cursor-pointer m-0 whitespace-nowrap"
                    >
                      {option}
                    </Label>
                  </span>
                ))}
              </span>
            )}
          />
        )

      case "multiselect":
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
              <span className="lex-docx-form-field-container">
                {metadata.options?.map((option) => (
                  <span key={option} className="inline-flex items-center space-x-1.5 flex-shrink-0">
                    <Checkbox
                      checked={field.value?.includes(option) ?? false}
                      onCheckedChange={(checked) => {
                        const currentValue = field.value || []
                        if (checked) {
                          field.onChange([...currentValue, option])
                        } else {
                          field.onChange(
                            currentValue.filter((v: string) => v !== option)
                          )
                        }
                      }}
                    />
                    <Label className="text-sm font-normal cursor-pointer m-0 whitespace-nowrap">
                      {option}
                    </Label>
                  </span>
                ))}
              </span>
            )}
          />
        )

      default:
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className={cn(
                    "lex-docx-form-field-container",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "1.5",
                    padding: "2px 8px",
                    height: "auto",
                    minHeight: "1.5em",
                    width: "200px",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    backgroundColor: field.value ? "#e0f2fe" : "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
            )}
          />
        )
    }
  }, [control])

  // 在 DOM 渲染后，将占位符标记替换为表单组件
  // 使用 useEffect 确保在 HTML 内容渲染后执行
  useEffect(() => {
    if (!contentRef.current) return

    // 使用 setTimeout 确保 HTML 内容已经渲染到 DOM
    const timer = setTimeout(() => {
      if (!contentRef.current) return

      // 先清理之前的 roots（延迟清理，避免在渲染过程中同步卸载）
      const previousRoots = [...rootsRef.current]
      rootsRef.current = []
      
      // 延迟卸载之前的 roots
      setTimeout(() => {
        previousRoots.forEach(({ root }) => {
          try {
            root.unmount()
          } catch (error) {
            // 忽略卸载错误（可能已经被卸载）
          }
        })
      }, 0)

      // 查找所有占位符标记并替换为表单组件
      const markers = contentRef.current.querySelectorAll('[data-placeholder-field]')

      markers.forEach((marker) => {
        const fieldName = marker.getAttribute('data-placeholder-field')
        if (fieldName && placeholderMetadata[fieldName]) {
          const metadata = placeholderMetadata[fieldName]
          
          // 检查父元素，转换为flex布局以实现左右对齐
          const parent = marker.parentElement
          if (parent) {
            // 检查是否已经是flex布局
            if (!parent.classList.contains('lex-docx-field-row')) {
              parent.classList.add('lex-docx-field-row')
              
              // 将占位符前的文本节点包装为标签
              const walker = document.createTreeWalker(
                parent,
                NodeFilter.SHOW_TEXT,
                null
              )
              
              let textNode
              const textNodes: Text[] = []
              while ((textNode = walker.nextNode() as Text)) {
                if (textNode.textContent && textNode.textContent.trim()) {
                  textNodes.push(textNode)
                }
              }
              
              // 找到占位符前的最后一个文本节点（最接近占位符的）
              let labelNode: Text | null = null
              let closestDistance = Infinity
              
              for (const node of textNodes) {
                const position = marker.compareDocumentPosition(node)
                if (position & Node.DOCUMENT_POSITION_PRECEDING) {
                  // 计算节点到marker的距离（通过DOM位置）
                  const range = document.createRange()
                  range.setStart(node, 0)
                  range.setEnd(marker, 0)
                  const distance = range.toString().length
                  
                  if (distance < closestDistance) {
                    closestDistance = distance
                    labelNode = node
                  }
                }
              }
              
              // 如果找到标签文本节点，将其包装为span
              if (labelNode && labelNode.textContent) {
                const labelText = labelNode.textContent.trim()
                // 检查是否包含冒号（常见的标签格式），或者有文本内容
                if (labelText.length > 0) {
                  const labelSpan = document.createElement('span')
                  labelSpan.className = 'lex-docx-field-label'
                  labelSpan.textContent = labelText
                  labelNode.replaceWith(labelSpan)
                }
              }
            }
          }
          
          // 创建容器来渲染表单组件
          const container = document.createElement('span')
          container.className = 'lex-docx-field-input'
          marker.replaceWith(container)
          // 使用 React 渲染表单组件
          const root = createRoot(container)
          rootsRef.current.push({ root, container })
          root.render(
            <span className="inline-block">
              {renderInlineFormField(fieldName, metadata)}
            </span>
          )
        }
      })
    }, 0)

    // 清理函数：清理定时器和 React 根
    return () => {
      clearTimeout(timer)
      // 延迟卸载 React 根，避免在渲染过程中同步卸载
      setTimeout(() => {
        rootsRef.current.forEach(({ root }) => {
          try {
            root.unmount()
          } catch (error) {
            // 忽略卸载错误（可能已经被卸载）
            console.warn('Error unmounting root:', error)
          }
        })
        rootsRef.current = []
      }, 0)
    }
  }, [processedHtml, placeholderMetadata, renderInlineFormField])

  if (!template) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>请选择一个模板进行预览</p>
      </div>
    )
  }

  if (!template.content_html) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground",
          className
        )}
      >
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>该模板暂无内容</p>
      </div>
    )
  }

  const handleFormSubmit = async (e?: React.FormEvent) => {
    // 阻止默认表单提交行为
    if (e) {
      e.preventDefault()
    }
    
    // 直接获取表单值，不做任何验证
    const formData = getValues()
    
    // 清理数据格式，但保留所有字段（即使为空也可以生成文档）
    const cleanedData: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData)) {
      // 保留所有字段，即使是空值
      if (value instanceof Date) {
        // 日期转换为中文格式字符串：YYYY年MM月DD日
        cleanedData[key] = format(value, "yyyy年M月d日", { locale: zhCN })
      } else {
        cleanedData[key] = value === undefined || value === null ? "" : value
      }
    }
    
    if (onSubmit) {
      try {
        await onSubmit(cleanedData)
        // 提交成功后，重置表单为默认值
        const defaultValues = getDefaultValues()
        reset(defaultValues)
      } catch (error) {
        // 如果提交失败，不重置表单，保留用户输入
        throw error
      }
    }
  }

  // 暴露提交方法给父组件
  useImperativeHandle(ref, () => ({
    submit: () => {
      if (formRef.current) {
        formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    },
  }))

  return (
    <form ref={formRef} onSubmit={handleFormSubmit} className={cn("flex flex-col h-full relative", className)}>
      {/* 下载文书按钮（已发布状态，右上角） */}
      {onDownloadDocument && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadDocument}
            disabled={isExporting}
            className="shadow-md bg-white hover:bg-gray-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                下载中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                下载文书
              </>
            )}
          </Button>
        </div>
      )}

      {/* 文档内容区域 - WYSIWYG 编辑 */}
      <div className="flex-1 overflow-auto p-6 bg-white">
        <div
          className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 min-h-full"
          style={{
            fontFamily: "Times New Roman, serif",
            fontSize: "12pt",
            lineHeight: "1.5",
            color: "#000",
          }}
        >
          {/* 渲染处理后的内容，将占位符替换为表单组件 */}
          <div 
            ref={contentRef}
            className="lex-docx-interactive-preview lex-docx-preview-content"
            style={{
              wordBreak: "break-word",
            }}
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />
        </div>
      </div>
    </form>
  )
})


