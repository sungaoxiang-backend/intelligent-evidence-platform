"use client"

import { useState, useMemo, useRef, useImperativeHandle, forwardRef } from "react"
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
  const processedContent = useMemo(() => {
    if (!template?.content_html) {
      return []
    }

    const placeholderRegex = /\{\{([^}]+)\}\}/g
    const parts: Array<{ type: "text" | "placeholder"; content: string; fieldName?: string }> = []
    let lastIndex = 0
    let match

    while ((match = placeholderRegex.exec(template.content_html)) !== null) {
      // 添加占位符前的文本
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: template.content_html.substring(lastIndex, match.index),
        })
      }

      // 添加占位符
      const fieldName = match[1].trim()
      if (placeholderMetadata[fieldName]) {
        parts.push({
          type: "placeholder",
          content: match[0],
          fieldName,
        })
      } else {
        // 如果占位符没有元数据，保持原样（高亮显示）
        parts.push({
          type: "text",
          content: `<span class="lex-docx-placeholder" style="background-color: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 500; font-family: 'Courier New', monospace; display: inline-block;">${match[0]}</span>`,
        })
      }

      lastIndex = match.index + match[0].length
    }

    // 添加剩余文本
    if (lastIndex < template.content_html.length) {
      parts.push({
        type: "text",
        content: template.content_html.substring(lastIndex),
      })
    }

    return parts
  }, [template?.content_html, placeholderMetadata])

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

  // 渲染内联表单字段（直接替换占位符）
  const renderInlineFormField = (
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
              <span className="inline-block mx-1">
                <Input
                  {...field}
                  type={metadata.type === "number" ? "number" : "text"}
                  value={field.value ?? ""}
                  placeholder={metadata.label}
                  className={cn(
                    "inline-block min-w-[120px]",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    padding: "2px 6px",
                    height: "auto",
                  }}
                />
              </span>
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
              <span className="inline-block mx-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "inline-flex min-w-[120px] justify-start text-left font-normal",
                        !field.value && "text-muted-foreground",
                        hasError && "border-destructive"
                      )}
                      style={{
                        fontFamily: "inherit",
                        fontSize: "inherit",
                        lineHeight: "inherit",
                        padding: "2px 6px",
                        height: "auto",
                      }}
                    >
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {field.value ? (
                        format(field.value, "yyyy-MM-dd")
                      ) : (
                        <span>{metadata.label}</span>
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
              <span className="inline-block mx-1">
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  placeholder={metadata.label}
                  className={cn(
                    "inline-block min-w-[200px]",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    padding: "4px 6px",
                    minHeight: "60px",
                  }}
                />
              </span>
            )}
          />
        )

      case "checkbox":
        return (
          <Controller
            key={fieldName}
            name={fieldName}
            control={control}
            render={({ field }) => (
              <span className="inline-flex items-center mx-1">
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  className="inline-block"
                />
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
              <span className="inline-flex flex-wrap items-center gap-2 mx-1">
                {metadata.options?.map((option) => (
                  <span key={option} className="inline-flex items-center space-x-1">
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
                    <Label className="text-sm font-normal cursor-pointer">
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
              <span className="inline-block mx-1">
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder={metadata.label}
                  className={cn(
                    "inline-block min-w-[120px]",
                    hasError && "border-destructive"
                  )}
                  style={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    padding: "2px 6px",
                    height: "auto",
                  }}
                />
              </span>
            )}
          />
        )
    }
  }

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
          <div className="lex-docx-interactive-preview">
            {processedContent.map((part, index) => {
              if (part.type === "text") {
                return (
                  <span
                    key={index}
                    dangerouslySetInnerHTML={{ __html: part.content }}
                  />
                )
              } else if (part.type === "placeholder" && part.fieldName) {
                const metadata = placeholderMetadata[part.fieldName]
                if (metadata) {
                  return (
                    <span key={index} className="inline-block">
                      {renderInlineFormField(part.fieldName, metadata)}
                    </span>
                  )
                }
              }
              return null
            })}
          </div>
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


