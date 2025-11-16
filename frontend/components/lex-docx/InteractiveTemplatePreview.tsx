"use client"

import { useState, useMemo, useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from "react"
import { createRoot } from "react-dom/client"
import "@/app/lex-docx/docx-styles.css"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { CalendarIcon, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { type DocumentTemplate, type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"
import { FileText } from "lucide-react"

interface InteractiveTemplatePreviewProps {
  template: DocumentTemplate | null
  onSubmit?: (formData: Record<string, any>) => void | Promise<void>
  isGenerating?: boolean
  className?: string
}

export interface InteractiveTemplatePreviewRef {
  submit: () => void
}

// 生成 Zod Schema
function generateZodSchema(
  placeholderMetadata: Record<string, PlaceholderMetadata>
): z.ZodObject<any> {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, metadata] of Object.entries(placeholderMetadata)) {
    let fieldSchema: z.ZodTypeAny

    switch (metadata.type) {
      case "text":
        fieldSchema = z.string()
        break
      case "number":
        fieldSchema = z
          .union([z.number(), z.string()])
          .refine(
            (val) => {
              if (typeof val === "string") {
                return val === "" || !isNaN(Number(val))
              }
              return true
            },
            { message: "必须是有效的数字" }
          )
          .transform((val) => {
            if (typeof val === "string") {
              return val === "" ? undefined : Number(val)
            }
            return val
          })
        break
      case "date":
        fieldSchema = z
          .union([z.date(), z.string()])
          .refine(
            (val) => {
              if (typeof val === "string") {
                return val === "" || !isNaN(new Date(val).getTime())
              }
              return true
            },
            { message: "必须是有效的日期" }
          )
          .transform((val) => {
            if (typeof val === "string") {
              return val === "" ? undefined : new Date(val)
            }
            return val
          })
        break
      case "textarea":
        fieldSchema = z.string()
        break
      case "checkbox":
        fieldSchema = z.boolean()
        break
      case "multiselect":
        fieldSchema = z.array(z.string())
        break
      default:
        fieldSchema = z.string()
    }

    // 应用必填验证
    if (metadata.required) {
      if (metadata.type === "checkbox") {
        // 复选框的必填意味着必须为 true
        fieldSchema = fieldSchema.refine((val) => val === true, {
          message: `${metadata.label}是必填项`,
        })
      } else if (metadata.type === "multiselect") {
        fieldSchema = fieldSchema.refine((val) => Array.isArray(val) && val.length > 0, {
          message: `${metadata.label}是必填项`,
        })
      } else {
        fieldSchema = fieldSchema.refine((val) => {
          if (typeof val === "string") {
            return val.trim().length > 0
          }
          return val !== undefined && val !== null && val !== ""
        }, { message: `${metadata.label}是必填项` })
      }
    } else {
      // 可选字段允许空值，但需要处理空字符串
      if (metadata.type === "text" || metadata.type === "textarea") {
        fieldSchema = fieldSchema.optional().or(z.literal(""))
      } else {
        fieldSchema = fieldSchema.optional()
      }
    }

    // 应用验证规则
    if (metadata.validation) {
      if (metadata.validation.min !== undefined) {
        fieldSchema = fieldSchema.refine(
          (val) => {
            if (val === undefined || val === null || val === "") return true
            const numVal = typeof val === "number" ? val : Number(val)
            return !isNaN(numVal) && numVal >= metadata.validation!.min!
          },
          { message: `最小值不能小于${metadata.validation.min}` }
        )
      }
      if (metadata.validation.max !== undefined) {
        fieldSchema = fieldSchema.refine(
          (val) => {
            if (val === undefined || val === null || val === "") return true
            const numVal = typeof val === "number" ? val : Number(val)
            return !isNaN(numVal) && numVal <= metadata.validation!.max!
          },
          { message: `最大值不能大于${metadata.validation.max}` }
        )
      }
      if (metadata.validation.pattern) {
        fieldSchema = fieldSchema.refine(
          (val) => {
            if (val === undefined || val === null || val === "") return true
            return new RegExp(metadata.validation!.pattern!).test(String(val))
          },
          { message: "格式不正确" }
        )
      }
    }

    shape[key] = fieldSchema
  }

  return z.object(shape)
}


export const InteractiveTemplatePreview = forwardRef<InteractiveTemplatePreviewRef, InteractiveTemplatePreviewProps>(({
  template,
  onSubmit,
  isGenerating = false,
  className,
}, ref) => {
  const formRef = useRef<HTMLFormElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const rootsRef = useRef<Array<{ root: ReturnType<typeof createRoot>; container: HTMLElement }>>([])
  const placeholderMetadata = template?.placeholder_metadata || {}

  // 生成表单 schema
  const schema = useMemo(() => {
    if (Object.keys(placeholderMetadata).length === 0) {
      return z.object({})
    }
    return generateZodSchema(placeholderMetadata)
  }, [placeholderMetadata])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur", // 只在失去焦点时验证，允许空值提交
    defaultValues: Object.fromEntries(
      Object.entries(placeholderMetadata).map(([key, meta]) => [
        key,
        meta.default_value !== undefined
          ? meta.default_value
          : meta.type === "checkbox"
          ? false
          : meta.type === "multiselect"
          ? []
          : meta.type === "date"
          ? undefined
          : "",
      ])
    ),
  })

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
    const error = errors[fieldName]
    const hasError = !!error

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
                    backgroundColor: "#ffffff",
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
            render={({ field }) => (
              <span className="inline-block lex-docx-form-field-container">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "inline-flex justify-start text-left font-normal lex-docx-form-field-container",
                        !field.value && "text-muted-foreground",
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
                        boxSizing: "border-box",
                      }}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {field.value ? (
                        format(field.value, "yyyy-MM-dd")
                      ) : (
                        <span className="text-muted-foreground">选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </span>
            )}
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
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
            )}
          />
        )
    }
  }, [control, errors])

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

  const handleFormSubmit = async (data: Record<string, any>) => {
    // 清理空值，但保留所有字段（即使为空也可以生成文档）
    const cleanedData: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      // 保留所有字段，即使是空值
      cleanedData[key] = value === undefined || value === null ? "" : value
    }
    
    if (onSubmit) {
      await onSubmit(cleanedData)
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
    <form ref={formRef} onSubmit={handleSubmit(handleFormSubmit)} className={cn("flex flex-col h-full", className)}>
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

      {/* 底部操作栏 */}
      <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          随时可以生成，即使表单没有内容也可以生成空的 Word 文档
        </p>
        <Button
          type="submit"
          disabled={isGenerating}
          className="ml-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              生成中...
            </>
          ) : (
            "生成文书"
          )}
        </Button>
      </div>
    </form>
  )
})


