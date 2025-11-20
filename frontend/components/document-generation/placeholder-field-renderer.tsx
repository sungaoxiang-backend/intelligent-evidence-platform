"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { cn } from "@/lib/utils"

export interface PlaceholderOption {
  label: string
  value: string
}

export interface PlaceholderFieldProps {
  placeholder_name: string
  label?: string
  type: string
  hint?: string
  default_value?: string
  options?: PlaceholderOption[]
  value?: any
  onChange: (value: any) => void
}

/**
 * 占位符字段渲染器
 * 根据字段类型渲染对应的输入组件
 */
export function PlaceholderFieldRenderer({
  placeholder_name,
  label,
  type,
  hint,
  default_value,
  options = [],
  value,
  onChange,
}: PlaceholderFieldProps) {
  const displayLabel = label || placeholder_name
  const fieldId = `field-${placeholder_name}`

  // 渲染文本输入框
  const renderTextInput = () => (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{displayLabel}</Label>
      <Input
        id={fieldId}
        type="text"
        placeholder={hint || `请输入${displayLabel}`}
        value={value || default_value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )

  // 渲染多行文本框
  const renderTextarea = () => (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{displayLabel}</Label>
      <Textarea
        id={fieldId}
        placeholder={hint || `请输入${displayLabel}`}
        value={value || default_value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )

  // 渲染下拉选择框
  const renderSelect = () => (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{displayLabel}</Label>
      <Select
        value={value || default_value || ""}
        onValueChange={onChange}
      >
        <SelectTrigger id={fieldId}>
          <SelectValue placeholder={hint || `请选择${displayLabel}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )

  // 渲染单选框组
  const renderRadio = () => (
    <div className="space-y-2">
      <Label>{displayLabel}</Label>
      <RadioGroup
        value={value || default_value || ""}
        onValueChange={onChange}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={`${fieldId}-${option.value}`} />
            <Label
              htmlFor={`${fieldId}-${option.value}`}
              className="font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )

  // 渲染复选框组（多选）
  const renderCheckbox = () => {
    const checkedValues = Array.isArray(value) ? value : []

    const handleCheckboxChange = (optionValue: string, checked: boolean) => {
      if (checked) {
        onChange([...checkedValues, optionValue])
      } else {
        onChange(checkedValues.filter((v: string) => v !== optionValue))
      }
    }

    return (
      <div className="space-y-2">
        <Label>{displayLabel}</Label>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${fieldId}-${option.value}`}
                checked={checkedValues.includes(option.value)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(option.value, checked as boolean)
                }
              />
              <Label
                htmlFor={`${fieldId}-${option.value}`}
                className="font-normal cursor-pointer"
              >
                {option.label}
              </Label>
            </div>
          ))}
        </div>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  // 渲染日期选择器
  const renderDate = () => {
    const dateValue = value ? new Date(value) : default_value ? new Date(default_value) : undefined

    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId}>{displayLabel}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={fieldId}
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateValue && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? (
                format(dateValue, "PPP", { locale: zhCN })
              ) : (
                <span>{hint || `请选择${displayLabel}`}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
              locale={zhCN}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
    )
  }

  // 渲染数字输入框
  const renderNumber = () => (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{displayLabel}</Label>
      <Input
        id={fieldId}
        type="number"
        placeholder={hint || `请输入${displayLabel}`}
        value={value !== undefined && value !== null ? value : default_value || ""}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === "" ? "" : Number(val))
        }}
      />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )

  // 根据类型渲染对应组件
  switch (type) {
    case "text":
      return renderTextInput()
    case "textarea":
      return renderTextarea()
    case "select":
      return renderSelect()
    case "radio":
      return renderRadio()
    case "checkbox":
      return renderCheckbox()
    case "date":
      return renderDate()
    case "number":
      return renderNumber()
    default:
      // 默认使用文本输入框
      return renderTextInput()
  }
}

