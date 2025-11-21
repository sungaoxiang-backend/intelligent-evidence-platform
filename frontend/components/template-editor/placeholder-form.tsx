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
  label: string
  type: string
  required: boolean
  description: string
  defaultValue: string
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
  label: "",
  type: "text",
  required: false,
  description: "",
  defaultValue: "",
  options: [],
})

export const normalizePlaceholderOptions = (formData: PlaceholderFormState) =>
  formData.options?.filter((opt) => (opt.label ?? "").trim() || (opt.value ?? "").trim()) || []

export const isValidFieldKey = (value: string) =>
  /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(value)

export const buildFormStateFromMeta = (meta: PlaceholderMeta): PlaceholderFormState => ({
  fieldKey: meta.backendMeta?.placeholder_name || meta.fieldKey,
  label: meta.backendMeta?.label || meta.label || meta.fieldKey,
  type: meta.backendMeta?.type || meta.dataType || "text",
  required: meta.backendMeta?.required ?? false,
  description: meta.backendMeta?.hint || meta.description || "",
  defaultValue: meta.backendMeta?.default_value || meta.defaultValue || "",
  options: meta.backendMeta?.options || [],
})

export const buildPayloadFromFormState = (formData: PlaceholderFormState): PlaceholderPayload => ({
  placeholder_name: formData.fieldKey.trim(),
  label: formData.label.trim(),
  type: formData.type,
  required: Boolean(formData.required),
  hint: formData.description?.trim() || undefined,
  default_value: formData.defaultValue?.trim() || undefined,
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
      label: `${formId ?? "placeholder"}-label`,
      fieldKey: `${formId ?? "placeholder"}-field-key`,
      type: `${formId ?? "placeholder"}-type`,
      defaultValue: `${formId ?? "placeholder"}-default`,
      description: `${formId ?? "placeholder"}-description`,
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
    next[index] = { ...next[index], [field]: value }
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
          <Label htmlFor={fieldIds.label}>显示名称</Label>
          <Input
            id={fieldIds.label}
            value={formData.label}
            onChange={(e) => updateField("label", e.target.value)}
            placeholder="例如：原告姓名"
            className="mt-2"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={fieldIds.fieldKey}>字段标识</Label>
          <Input
            id={fieldIds.fieldKey}
            value={formData.fieldKey}
            onChange={(e) => updateField("fieldKey", e.target.value)}
            placeholder="例如：plaintiff_name"
            className="mt-2 font-mono"
            disabled={disabled}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            仅限字母、数字、点、横线和下划线，需以字母或下划线开头
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div>
          <Label htmlFor={fieldIds.defaultValue}>默认值（可选）</Label>
          <Input
            id={fieldIds.defaultValue}
            value={formData.defaultValue}
            onChange={(e) => updateField("defaultValue", e.target.value)}
            placeholder="例如：张三"
            className="mt-2"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={`${formId ?? "placeholder"}-required`}
          checked={Boolean(formData.required)}
          onChange={(e) => updateField("required", e.target.checked)}
          className="h-4 w-4"
          disabled={disabled}
        />
        <Label htmlFor={`${formId ?? "placeholder"}-required`} className="cursor-pointer">
          必填
        </Label>
      </div>

      <div>
        <Label htmlFor={fieldIds.description}>描述（可选）</Label>
        <Textarea
          id={fieldIds.description}
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="用于提示配置/填报人员该占位符的含义"
          className="mt-2"
          rows={3}
          disabled={disabled}
        />
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
            {(formData.options || []).map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="标签"
                  value={option.label}
                  onChange={(e) => updateOption(index, "label", e.target.value)}
                  className="flex-1"
                  disabled={disabled}
                />
                <Input
                  placeholder="值"
                  value={option.value}
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
            ))}
            {(formData.options?.length || 0) === 0 && (
              <p className="text-xs text-muted-foreground">点击“添加选项”新增选项</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

