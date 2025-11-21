"use client"

import React, { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import type { PlaceholderMeta, PlaceholderPayload } from "./placeholder-manager"

export type PlaceholderFormState = {
  fieldKey: string
  type: string
  options: Array<{ label: string; value: string }>
}

export const placeholderTypeOptions = [
  { value: "text", label: "文本 (text)" },
  { value: "textarea", label: "多行文本 (textarea)" },
  { value: "select", label: "下拉选择 (select)" },
  { value: "radio", label: "单选 (radio)" },
  { value: "checkbox", label: "复选框 (checkbox)" },
  { value: "date", label: "日期 (date)" },
  { value: "number", label: "数字 (number)" },
  { value: "file", label: "文件 (file)" },
]

export const createEmptyPlaceholderForm = (): PlaceholderFormState => ({
  fieldKey: "",
  type: "text",
  options: [],
})

export const normalizePlaceholderOptions = (formData: PlaceholderFormState) =>
  formData.options?.filter((opt) => (opt.label ?? "").trim() || (opt.value ?? "").trim()) || []

export const isValidFieldKey = (value: string) => {
  // 允许中文字符、英文字母、数字、下划线、点、连字符
  // 不能为空，不能包含花括号（因为占位符格式是 {{name}}）
  const trimmed = value.trim()
  if (!trimmed) return false
  // 不允许包含花括号，避免与占位符语法冲突
  if (trimmed.includes('{') || trimmed.includes('}')) return false
  // 允许任何其他字符（包括中文）
  return true
}

export const buildFormStateFromMeta = (meta: PlaceholderMeta): PlaceholderFormState => {
  // 确保 options 数组中的每个对象都有正确的结构
  const normalizeOptions = (options?: Array<{ label?: string; value?: string }>): Array<{ label: string; value: string }> => {
    if (!options || !Array.isArray(options)) return []
    return options.map(opt => ({
      label: typeof opt?.label === 'string' ? opt.label : "",
      value: typeof opt?.value === 'string' ? opt.value : "",
    }))
  }
  
  return {
    fieldKey: meta.backendMeta?.name || meta.fieldKey,
    type: meta.backendMeta?.type || meta.dataType || "text",
    options: normalizeOptions(meta.backendMeta?.options),
  }
}

export const buildPayloadFromFormState = (formData: PlaceholderFormState): PlaceholderPayload => ({
  name: formData.fieldKey.trim(),
  type: formData.type,
  options: normalizePlaceholderOptions(formData),
})

export interface PlaceholderFormFieldsProps {
  formId?: string
  formData: PlaceholderFormState
  onChange: (value: PlaceholderFormState) => void
  disabled?: boolean
}

export function PlaceholderFormFields({
  formId,
  formData,
  onChange,
  disabled,
}: PlaceholderFormFieldsProps) {
  const fieldIds = useMemo(
    () => ({
      fieldKey: `${formId ?? "placeholder"}-field-key`,
      type: `${formId ?? "placeholder"}-type`,
    }),
    [formId]
  )

  const updateField = <K extends keyof PlaceholderFormState>(key: K, value: PlaceholderFormState[K]) => {
    onChange({
      ...formData,
      [key]: value,
    })
  }

  const updateOption = (index: number, field: "label" | "value", value: string) => {
    const next = [...(formData.options || [])]
    const currentOption = next[index] || { label: "", value: "" }
    next[index] = { ...currentOption, [field]: value }
    onChange({
      ...formData,
      options: next,
    })
  }

  const removeOption = (index: number) => {
    onChange({
      ...formData,
      options: formData.options?.filter((_, i) => i !== index) || [],
    })
  }

  const needsOptions = ["select", "radio", "checkbox"].includes(formData.type)

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={fieldIds.fieldKey}>占位符名称</Label>
          <Input
            id={fieldIds.fieldKey}
            value={formData.fieldKey}
            onChange={(e) => updateField("fieldKey", e.target.value)}
            placeholder="例如：{{name}} 或 {{姓名}}"
            className="mt-2 font-mono"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={fieldIds.type}>数据类型 / 控件</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => updateField("type", value)}
            disabled={disabled}
          >
            <SelectTrigger id={fieldIds.type} className="mt-2">
              <SelectValue placeholder="选择控件类型" />
            </SelectTrigger>
            <SelectContent>
              {placeholderTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsOptions && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>选项列表</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...formData,
                  options: [...(formData.options || []), { label: "", value: "" }],
                })
              }
              disabled={disabled}
            >
              <Plus className="h-3 w-3 mr-1" />
              添加选项
            </Button>
          </div>
          <div className="space-y-2 mt-2">
            {(formData.options || []).map((option, index) => {
              // 确保 option 对象有正确的结构，防止中文字段名或其他异常结构
              const safeOption: { label: string; value: string } = 
                option && typeof option === 'object' && 'label' in option && 'value' in option
                  ? { label: String(option.label || ""), value: String(option.value || "") }
                  : { label: "", value: "" }
              return (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="标签"
                    value={safeOption.label}
                    onChange={(e) => updateOption(index, "label", e.target.value)}
                    className="flex-1"
                    disabled={disabled}
                  />
                  <Input
                    placeholder="值"
                    value={safeOption.value}
                    onChange={(e) => updateOption(index, "value", e.target.value)}
                    className="flex-1"
                    disabled={disabled}
                  />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              )
            })}
            {(formData.options?.length || 0) === 0 && (
              <p className="text-xs text-muted-foreground">点击“添加选项”新增选项</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

