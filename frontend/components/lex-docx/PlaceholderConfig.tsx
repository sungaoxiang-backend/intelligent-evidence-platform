"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus } from "lucide-react"
import { type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { cn } from "@/lib/utils"

interface PlaceholderConfigProps {
  placeholderName: string
  metadata?: PlaceholderMetadata | null
  onSave: (name: string, metadata: PlaceholderMetadata) => void
  onCancel?: () => void
  className?: string
  allowNameEdit?: boolean  // 是否允许编辑占位符名称
  onNameChange?: (newName: string) => void  // 占位符名称变化回调
}

const FIELD_TYPES = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "textarea", label: "多行文本" },
  { value: "checkbox", label: "复选框" },
  { value: "multiselect", label: "多选框" },
] as const

export function PlaceholderConfig({
  placeholderName,
  metadata,
  onSave,
  onCancel,
  className,
  allowNameEdit = false,
  onNameChange,
}: PlaceholderConfigProps) {
  // 占位符名称状态（如果允许编辑）
  const [editableName, setEditableName] = useState(placeholderName)
  // 表单状态
  const [formData, setFormData] = useState<PlaceholderMetadata>({
    type: "text",
    label: "",
    required: false,
    default_value: undefined,
    options: undefined,
    validation: undefined,
  })

  // 验证错误
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 多选框选项列表（临时状态，用于编辑）
  const [optionItems, setOptionItems] = useState<string[]>([])

  // 同步占位符名称变化
  useEffect(() => {
    setEditableName(placeholderName)
  }, [placeholderName])

  // 初始化表单数据
  useEffect(() => {
    if (metadata) {
      setFormData(metadata)
      // 如果是多选框或复选框，初始化选项列表
      if ((metadata.type === "multiselect" || metadata.type === "checkbox") && metadata.options) {
        setOptionItems([...metadata.options])
      } else {
        setOptionItems([])
      }
    } else {
      // 默认值：尝试从占位符名称推断标签
      const inferredLabel = editableName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase())
      setFormData({
        type: "text",
        label: inferredLabel,
        required: false,
        default_value: undefined,
        options: undefined,
        validation: undefined,
      })
      setOptionItems([])
    }
  }, [metadata, editableName])

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // 验证标签
    if (!formData.label || !formData.label.trim()) {
      newErrors.label = "标签不能为空"
    }

    // 验证多选框和复选框选项
    if (formData.type === "multiselect" || formData.type === "checkbox") {
      if (!optionItems || optionItems.length === 0) {
        newErrors.options = formData.type === "multiselect" 
          ? "多选框必须至少有一个选项" 
          : "复选框必须至少有一个选项"
      } else {
        // 验证选项不能为空
        const emptyOptions = optionItems.filter((opt) => !opt.trim())
        if (emptyOptions.length > 0) {
          newErrors.options = "选项不能为空"
        }
      }
    }

    // 验证数字类型的默认值
    if (formData.type === "number" && formData.default_value !== undefined) {
      const numValue = Number(formData.default_value)
      if (isNaN(numValue)) {
        newErrors.default_value = "默认值必须是有效的数字"
      }
    }

    // 验证日期类型的默认值
    if (formData.type === "date" && formData.default_value !== undefined) {
      const dateValue = new Date(formData.default_value as string)
      if (isNaN(dateValue.getTime())) {
        newErrors.default_value = "默认值必须是有效的日期"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理保存
  const handleSave = () => {
    if (!validate()) {
      return
    }

    // 构建最终的元数据
    const finalMetadata: PlaceholderMetadata = {
      type: formData.type,
      label: formData.label.trim(),
      required: formData.required,
      default_value: formData.default_value,
      // 多选框和复选框都需要选项列表
      options: (formData.type === "multiselect" || formData.type === "checkbox") 
        ? optionItems.filter((opt) => opt.trim()) 
        : undefined,
      validation: formData.validation,
    }

    onSave(editableName.trim(), finalMetadata)
  }

  // 处理字段类型变化
  const handleTypeChange = (newType: PlaceholderMetadata["type"]) => {
    setFormData((prev) => {
      const updated = {
        ...prev,
        type: newType,
      }

      // 如果切换到多选框或复选框，初始化选项列表
      if (newType === "multiselect" || newType === "checkbox") {
        updated.options = optionItems.length > 0 ? optionItems : []
        // 如果选项列表为空，添加一个空选项
        if (optionItems.length === 0) {
          setOptionItems([""])
        }
      } else {
        updated.options = undefined
        setOptionItems([])
      }

      // 根据类型重置默认值
      if (newType === "number") {
        updated.default_value = undefined
      } else if (newType === "date") {
        updated.default_value = undefined
      } else if (newType === "checkbox") {
        // 复选框：如果有选项，默认值为第一个选项；否则为 false
        updated.default_value = optionItems.length > 0 && optionItems[0].trim() 
          ? optionItems[0].trim() 
          : false
      } else if (newType === "multiselect") {
        updated.default_value = []
      } else {
        updated.default_value = undefined
      }

      return updated
    })
  }

  // 添加选项
  const handleAddOption = () => {
    setOptionItems([...optionItems, ""])
  }

  // 更新选项
  const handleUpdateOption = (index: number, value: string) => {
    const updated = [...optionItems]
    updated[index] = value
    setOptionItems(updated)
  }

  // 删除选项
  const handleRemoveOption = (index: number) => {
    if (optionItems.length <= 1) {
      return // 至少保留一个选项
    }
    const updated = optionItems.filter((_, i) => i !== index)
    setOptionItems(updated)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 占位符名称（可编辑或只读） */}
      <div>
        <Label>占位符名称</Label>
        {allowNameEdit ? (
          <Input
            value={editableName}
            onChange={(e) => {
              const newName = e.target.value
              setEditableName(newName)
              if (onNameChange) {
                onNameChange(newName)
              }
            }}
            className="mt-1 font-mono"
            placeholder="例如: plaintiff_name"
          />
        ) : (
          <Input value={editableName} disabled className="mt-1 font-mono" />
        )}
        <p className="text-xs text-muted-foreground mt-1">
          格式：{`{{${editableName}}}`}
        </p>
      </div>

      {/* 字段类型 */}
      <div>
        <Label htmlFor="type">字段类型 *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => handleTypeChange(value as PlaceholderMetadata["type"])}
        >
          <SelectTrigger id="type" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-destructive mt-1">{errors.type}</p>
        )}
      </div>

      {/* 字段标签 */}
      <div>
        <Label htmlFor="label">字段标签 *</Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, label: e.target.value }))
          }
          placeholder="请输入字段显示标签"
          className="mt-1"
        />
        {errors.label && (
          <p className="text-sm text-destructive mt-1">{errors.label}</p>
        )}
      </div>

      {/* 必填属性 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="required">必填</Label>
          <p className="text-xs text-muted-foreground">
            是否要求用户必须填写此字段
          </p>
        </div>
        <Switch
          id="required"
          checked={formData.required}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, required: checked }))
          }
        />
      </div>

      {/* 默认值（根据类型显示不同的输入控件） */}
      {formData.type !== "multiselect" && formData.type !== "checkbox" && (
        <div>
          <Label htmlFor="default_value">默认值</Label>
          {formData.type === "textarea" ? (
            <Textarea
              id="default_value"
              value={(formData.default_value as string) || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  default_value: e.target.value || undefined,
                }))
              }
              placeholder="请输入默认值"
              className="mt-1"
              rows={3}
            />
          ) : formData.type === "number" ? (
            <Input
              id="default_value"
              type="number"
              value={(formData.default_value as number) ?? ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  default_value:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                }))
              }
              placeholder="请输入数字默认值"
              className="mt-1"
            />
          ) : formData.type === "date" ? (
            <Input
              id="default_value"
              type="date"
              value={
                formData.default_value
                  ? new Date(formData.default_value as string)
                      .toISOString()
                      .split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  default_value: e.target.value || undefined,
                }))
              }
              className="mt-1"
            />
          ) : (
            <Input
              id="default_value"
              value={(formData.default_value as string) || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  default_value: e.target.value || undefined,
                }))
              }
              placeholder="请输入默认值"
              className="mt-1"
            />
          )}
          {errors.default_value && (
            <p className="text-sm text-destructive mt-1">
              {errors.default_value}
            </p>
          )}
        </div>
      )}

      {/* 选项列表（多选框和复选框） */}
      {(formData.type === "multiselect" || formData.type === "checkbox") && (
        <div>
          <Label>选项列表 *</Label>
          <p className="text-xs text-muted-foreground mb-2">
            {formData.type === "multiselect" 
              ? "为多选框配置可选项，至少需要一个选项"
              : "为复选框配置可选项，至少需要一个选项"}
          </p>
          <div className="space-y-2 mt-1">
            {optionItems.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => handleUpdateOption(index, e.target.value)}
                  placeholder={`选项 ${index + 1}`}
                  className="flex-1"
                />
                {optionItems.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(index)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              添加选项
            </Button>
          </div>
          {errors.options && (
            <p className="text-sm text-destructive mt-1">{errors.options}</p>
          )}
        </div>
      )}

      {/* 默认值（复选框和多选框，从选项中选择） */}
      {(formData.type === "checkbox" || formData.type === "multiselect") && optionItems.length > 0 && (
        <div>
          <Label htmlFor="default_value">默认值</Label>
          {formData.type === "checkbox" ? (
            <Select
              value={
                formData.default_value && typeof formData.default_value === "string"
                  ? formData.default_value
                  : "__none__"
              }
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  default_value: value === "__none__" ? false : value,
                }))
              }
            >
              <SelectTrigger id="default_value" className="mt-1">
                <SelectValue placeholder="请选择默认选项（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无默认值</SelectItem>
                {optionItems.filter((opt) => opt.trim()).map((option, index) => (
                  <SelectItem key={index} value={option.trim()}>
                    {option.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2 mt-1">
              {optionItems.filter((opt) => opt.trim()).map((option, index) => {
                const optionValue = option.trim()
                const selectedValues = (formData.default_value as string[]) || []
                const isSelected = selectedValues.includes(optionValue)
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`default_${index}`}
                      checked={isSelected}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, optionValue]
                          : selectedValues.filter((v) => v !== optionValue)
                        setFormData((prev) => ({
                          ...prev,
                          default_value: newValues.length > 0 ? newValues : [],
                        }))
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`default_${index}`} className="text-sm font-normal cursor-pointer">
                      {optionValue}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
          {errors.default_value && (
            <p className="text-sm text-destructive mt-1">
              {errors.default_value}
            </p>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
        <Button onClick={handleSave}>保存</Button>
      </div>
    </div>
  )
}

