"use client"

import { useState, useEffect, useMemo } from "react"
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
import { CalendarIcon, Save } from "lucide-react"
import { format } from "date-fns"
import { type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { handleApiError } from "@/lib/utils/error-handler"

interface DynamicFormProps {
  placeholderMetadata: Record<string, PlaceholderMetadata>
  onSubmit: (data: Record<string, any>) => void | Promise<void>
  initialData?: Record<string, any>
  templateId?: number
  className?: string
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

    // 应用验证规则
    if (metadata.validation) {
      if (metadata.validation.min !== undefined) {
        if (metadata.type === "number") {
          fieldSchema = (fieldSchema as z.ZodNumber).min(
            metadata.validation.min,
            { message: `最小值不能小于 ${metadata.validation.min}` }
          )
        } else if (metadata.type === "text" || metadata.type === "textarea") {
          fieldSchema = (fieldSchema as z.ZodString).min(
            metadata.validation.min,
            { message: `长度不能少于 ${metadata.validation.min} 个字符` }
          )
        }
      }

      if (metadata.validation.max !== undefined) {
        if (metadata.type === "number") {
          fieldSchema = (fieldSchema as z.ZodNumber).max(
            metadata.validation.max,
            { message: `最大值不能大于 ${metadata.validation.max}` }
          )
        } else if (metadata.type === "text" || metadata.type === "textarea") {
          fieldSchema = (fieldSchema as z.ZodString).max(
            metadata.validation.max,
            { message: `长度不能超过 ${metadata.validation.max} 个字符` }
          )
        }
      }

      if (metadata.validation.pattern) {
        if (metadata.type === "text" || metadata.type === "textarea") {
          fieldSchema = (fieldSchema as z.ZodString).regex(
            new RegExp(metadata.validation.pattern),
            { message: "格式不正确" }
          )
        }
      }
    }

    // 必填验证
    if (metadata.required) {
      if (metadata.type === "checkbox") {
        // 复选框的必填验证：必须为 true
        fieldSchema = (fieldSchema as z.ZodBoolean).refine(
          (val) => val === true,
          { message: "此字段为必填项" }
        )
      } else if (metadata.type === "multiselect") {
        // 多选框的必填验证：数组不能为空
        fieldSchema = (fieldSchema as z.ZodArray<any>).min(1, {
          message: "至少选择一个选项",
        })
      } else {
        // 其他类型的必填验证
        fieldSchema = fieldSchema.refine(
          (val) => {
            if (val === undefined || val === null) return false
            if (typeof val === "string" && val.trim() === "") return false
            if (Array.isArray(val) && val.length === 0) return false
            return true
          },
          { message: "此字段为必填项" }
        )
      }
    } else {
      // 非必填字段允许为空
      if (metadata.type === "number" || metadata.type === "date") {
        fieldSchema = fieldSchema.optional()
      } else if (metadata.type === "text" || metadata.type === "textarea") {
        fieldSchema = fieldSchema.or(z.literal("")).optional()
      } else if (metadata.type === "checkbox") {
        fieldSchema = fieldSchema.optional()
      } else if (metadata.type === "multiselect") {
        fieldSchema = fieldSchema.optional()
      }
    }

    shape[key] = fieldSchema
  }

  return z.object(shape)
}

// 获取草稿存储键
function getDraftStorageKey(templateId?: number): string {
  return templateId
    ? `lex-docx-draft-${templateId}`
    : "lex-docx-draft-temp"
}

export function DynamicForm({
  placeholderMetadata,
  onSubmit,
  initialData,
  templateId,
  className,
}: DynamicFormProps) {
  const { toast } = useToast()

  // 生成 Zod Schema
  const schema = useMemo(
    () => generateZodSchema(placeholderMetadata),
    [placeholderMetadata]
  )

  // 初始化表单数据（从 initialData 或 localStorage 恢复）
  const getInitialValues = (): Record<string, any> => {
    // 优先使用 initialData
    if (initialData) {
      return initialData
    }

    // 尝试从 localStorage 恢复草稿
    try {
      const draftKey = getDraftStorageKey(templateId)
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)
        // 转换日期字符串为 Date 对象
        const converted: Record<string, any> = {}
        for (const [key, value] of Object.entries(parsed)) {
          const metadata = placeholderMetadata[key]
          if (metadata?.type === "date" && typeof value === "string") {
            converted[key] = new Date(value)
          } else {
            converted[key] = value
          }
        }
        return converted
      }
    } catch (error) {
      console.error("恢复草稿失败:", error)
    }

    // 使用默认值
    const defaults: Record<string, any> = {}
    for (const [key, metadata] of Object.entries(placeholderMetadata)) {
      if (metadata.default_value !== undefined) {
        if (metadata.type === "date" && typeof metadata.default_value === "string") {
          defaults[key] = new Date(metadata.default_value)
        } else {
          defaults[key] = metadata.default_value
        }
      } else {
        // 根据类型设置默认值
        if (metadata.type === "checkbox") {
          defaults[key] = false
        } else if (metadata.type === "multiselect") {
          defaults[key] = []
        } else {
          defaults[key] = ""
        }
      }
    }
    return defaults
  }

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: getInitialValues(),
  })

  // 监听表单变化，自动保存草稿
  const formData = watch()
  useEffect(() => {
    if (isDirty && Object.keys(formData).length > 0) {
      try {
        const draftKey = getDraftStorageKey(templateId)
        // 转换 Date 对象为字符串以便存储
        const dataToSave: Record<string, any> = {}
        for (const [key, value] of Object.entries(formData)) {
          if (value instanceof Date) {
            dataToSave[key] = value.toISOString()
          } else {
            dataToSave[key] = value
          }
        }
        localStorage.setItem(draftKey, JSON.stringify(dataToSave))
      } catch (error) {
        console.error("保存草稿失败:", error)
      }
    }
  }, [formData, isDirty, templateId])

  // 处理表单提交
  const onSubmitForm = async (data: Record<string, any>) => {
    try {
      // 转换 Date 对象为字符串
      const submitData: Record<string, any> = {}
      for (const [key, value] of Object.entries(data)) {
        if (value instanceof Date) {
          submitData[key] = format(value, "yyyy-MM-dd")
        } else {
          submitData[key] = value
        }
      }

      await onSubmit(submitData)

      // 提交成功后清除草稿
      if (templateId) {
        const draftKey = getDraftStorageKey(templateId)
        localStorage.removeItem(draftKey)
      }

      toast({
        title: "提交成功",
        description: "表单已提交",
      })
    } catch (error) {
      handleApiError(error, "表单提交失败")
    }
  }

  // 渲染字段
  const renderField = (
    key: string,
    metadata: PlaceholderMetadata
  ): React.ReactNode => {
    const error = errors[key]

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>
          {metadata.label}
          {metadata.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {metadata.type === "text" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <Input
                id={key}
                {...field}
                placeholder={metadata.default_value as string}
                className={cn(error && "border-destructive")}
              />
            )}
          />
        )}

        {metadata.type === "number" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <Input
                id={key}
                type="number"
                {...field}
                value={field.value ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                  field.onChange(value === "" ? undefined : Number(value))
                }}
                placeholder={metadata.default_value?.toString()}
                className={cn(error && "border-destructive")}
              />
            )}
          />
        )}

        {metadata.type === "date" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !field.value && "text-muted-foreground",
                      error && "border-destructive"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? (
                      format(field.value, "yyyy-MM-dd")
                    ) : (
                      <span>选择日期</span>
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
            )}
          />
        )}

        {metadata.type === "textarea" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <Textarea
                id={key}
                {...field}
                placeholder={metadata.default_value as string}
                className={cn(error && "border-destructive")}
                rows={4}
              />
            )}
          />
        )}

        {metadata.type === "checkbox" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={field.value || false}
                  onCheckedChange={field.onChange}
                />
                <Label
                  htmlFor={key}
                  className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {metadata.default_value
                    ? metadata.default_value
                      ? "默认选中"
                      : "默认不选中"
                    : "选中"}
                </Label>
              </div>
            )}
          />
        )}

        {metadata.type === "multiselect" && (
          <Controller
            name={key}
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <div
                  className={cn(
                    "min-h-[40px] rounded-md border border-input bg-background p-3 space-y-2",
                    error && "border-destructive"
                  )}
                >
                  {metadata.options && metadata.options.length > 0 ? (
                    metadata.options.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${key}-${option}`}
                          checked={(field.value || []).includes(option)}
                          onCheckedChange={(checked) => {
                            const current = field.value || []
                            if (checked) {
                              field.onChange([...current, option])
                            } else {
                              field.onChange(current.filter((v) => v !== option))
                            }
                          }}
                        />
                        <Label
                          htmlFor={`${key}-${option}`}
                          className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无选项</p>
                  )}
                </div>
                {(field.value?.length || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    已选择 {field.value.length} 项
                  </p>
                )}
              </div>
            )}
          />
        )}

        {error && (
          <p className="text-sm text-destructive">{error.message as string}</p>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmitForm)}
      className={cn("space-y-6", className)}
    >
      {Object.entries(placeholderMetadata).map(([key, metadata]) =>
        renderField(key, metadata)
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit">提交</Button>
      </div>
    </form>
  )
}

