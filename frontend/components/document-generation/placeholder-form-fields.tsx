"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface PlaceholderInfo {
  id: number
  name: string
  type: string
  options?: Array<{ label: string; value: string }>
}

interface PlaceholderFormFieldProps {
  placeholder: PlaceholderInfo
  value: any
  onChange: (value: any) => void
  className?: string
  disabled?: boolean
}

export function PlaceholderFormField({
  placeholder,
  value,
  onChange,
  className,
  disabled = false,
}: PlaceholderFormFieldProps) {
  // 使用内部状态来避免输入中断
  // 根据占位符类型初始化内部状态
  const getInitialValue = () => {
    if (placeholder.type === "checkbox" && placeholder.options && placeholder.options.length > 0) {
      // 多选 checkbox：值是数组
      return Array.isArray(value) ? value : (value ? [value] : [])
    }
    if (placeholder.type === "radio") {
      // radio：值是字符串
      return value || ""
    }
    return value || ""
  }
  
  const [internalValue, setInternalValue] = React.useState(getInitialValue)
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const isFocusedRef = React.useRef(false)
  const isUserInputRef = React.useRef(false) // 标记是否是用户输入导致的变化
  
  // 当外部值变化时更新内部状态（但不影响正在输入的字段）
  React.useEffect(() => {
    // 如果是用户输入导致的变化，不同步（避免覆盖用户输入）
    if (isUserInputRef.current) {
      isUserInputRef.current = false
      return
    }
    
    // 只有当输入框没有焦点时才同步外部值（用于从服务器加载数据）
    if (isFocusedRef.current && (placeholder.type === "text" || placeholder.type === "textarea" || placeholder.type === "date" || placeholder.type === "number")) {
      return
    }
    
    // 同步外部值到内部状态
    if (placeholder.type === "checkbox" && placeholder.options && placeholder.options.length > 0) {
      // 多选 checkbox：值是数组
      const newValue = Array.isArray(value) ? value : (value ? [value] : [])
      if (JSON.stringify(newValue) !== JSON.stringify(internalValue)) {
        setInternalValue(newValue)
      }
    } else if (placeholder.type === "radio") {
      // radio：值是字符串
      const newValue = value || ""
      if (newValue !== internalValue) {
        setInternalValue(newValue)
      }
    } else {
      // 文本输入：值是字符串
      const newValue = value || ""
      if (newValue !== internalValue) {
        setInternalValue(newValue)
      }
    }
  }, [value, placeholder.type, placeholder.options])
  
  // 处理焦点事件
  const handleFocus = () => {
    isFocusedRef.current = true
  }
  
  const handleBlur = () => {
    isFocusedRef.current = false
    // 注意：不在 blur 时强制同步，让用户输入的值保持
    // 外部值会通过 onChange 已经更新到 formData
  }
  
  const handleChange = (newValue: any) => {
    isUserInputRef.current = true // 标记这是用户输入
    setInternalValue(newValue)
    onChange(newValue) // 立即更新外部状态
  }
  
  const renderField = () => {
    switch (placeholder.type) {
      case "text":
        return (
          <Input
            ref={(el) => {
              inputRef.current = el
            }}
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={`请输入${placeholder.name}`}
            className={cn("min-w-[120px]", className)}
            disabled={disabled}
          />
        )

      case "textarea":
        return (
          <Textarea
            ref={(el) => {
              inputRef.current = el
            }}
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={`请输入${placeholder.name}`}
            className={cn("min-w-[200px] min-h-[60px]", className)}
            disabled={disabled}
          />
        )

      case "select":
        if (!placeholder.options || placeholder.options.length === 0) {
          return (
            <Input
              ref={(el) => {
                inputRef.current = el
              }}
              value={internalValue}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={`请输入${placeholder.name}`}
              className={cn("min-w-[120px]", className)}
              disabled={disabled}
            />
          )
        }
        return (
          <Select
            value={internalValue || ""}
            onValueChange={(newValue) => {
              isUserInputRef.current = true // 标记这是用户输入
              setInternalValue(newValue)
              onChange(newValue)
            }}
            disabled={disabled}
          >
            <SelectTrigger className={cn("min-w-[120px]", className)}>
              <SelectValue placeholder={`请选择${placeholder.name}`} />
            </SelectTrigger>
            <SelectContent>
              {placeholder.options.map((option, index) => (
                <SelectItem key={index} value={option.value}>
                  {option.label || option.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "radio":
        if (!placeholder.options || placeholder.options.length === 0) {
          return (
            <Input
              ref={(el) => {
                inputRef.current = el
              }}
              value={internalValue}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={`请输入${placeholder.name}`}
              className={cn("min-w-[120px]", className)}
              disabled={disabled}
            />
          )
        }
        // radio 使用内部状态管理
        const radioValue = internalValue || ""
        return (
          <RadioGroup
            value={radioValue}
            onValueChange={(newValue) => {
              isUserInputRef.current = true // 标记这是用户输入
              setInternalValue(newValue)
              onChange(newValue)
            }}
            className={cn("flex flex-row gap-4", className)}
            disabled={disabled}
          >
            {placeholder.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${placeholder.name}-${index}`} />
                <Label htmlFor={`${placeholder.name}-${index}`} className="cursor-pointer">
                  {option.label || option.value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )

      case "checkbox":
        // checkbox 如果有 options，支持多选（值是数组）
        if (placeholder.options && placeholder.options.length > 0) {
          // 多选模式：值是数组，使用 internalValue
          const checkboxValues = Array.isArray(internalValue) ? internalValue : (internalValue ? [internalValue] : [])
          
          const handleCheckboxChange = (optionValue: string, checked: boolean) => {
            isUserInputRef.current = true // 标记这是用户输入
            let newValues: string[]
            if (checked) {
              // 添加选项
              newValues = [...checkboxValues, optionValue]
            } else {
              // 移除选项
              newValues = checkboxValues.filter((v) => v !== optionValue)
            }
            setInternalValue(newValues)
            onChange(newValues)
          }
          
          return (
            <div className={cn("flex flex-row gap-4 flex-wrap", className)}>
              {placeholder.options.map((option, index) => {
                const isChecked = checkboxValues.includes(option.value)
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${placeholder.name}-${index}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => handleCheckboxChange(option.value, Boolean(checked))}
                      disabled={disabled}
                    />
                    <Label htmlFor={`${placeholder.name}-${index}`} className="cursor-pointer">
                      {option.label || option.value}
                    </Label>
                  </div>
                )
              })}
            </div>
          )
        }
        
        // 单选模式：单个复选框
        return (
          <div className={cn("flex items-center space-x-2", className)}>
            <Checkbox
              id={placeholder.name}
              checked={Boolean(internalValue)}
              onCheckedChange={(checked) => {
                isUserInputRef.current = true // 标记这是用户输入
                setInternalValue(checked)
                onChange(checked)
              }}
              disabled={disabled}
            />
            <Label htmlFor={placeholder.name} className="cursor-pointer">
              {placeholder.name}
            </Label>
          </div>
        )

      case "date":
        return (
          <Input
            ref={(el) => {
              inputRef.current = el
            }}
            type="date"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={cn("min-w-[150px]", className)}
            disabled={disabled}
          />
        )

      case "number":
        return (
          <Input
            ref={(el) => {
              inputRef.current = el
            }}
            type="number"
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={`请输入${placeholder.name}`}
            className={cn("min-w-[120px]", className)}
            disabled={disabled}
          />
        )

      default:
        return (
          <Input
            ref={(el) => {
              inputRef.current = el
            }}
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={`请输入${placeholder.name}`}
            className={cn("min-w-[120px]", className)}
            disabled={disabled}
          />
        )
    }
  }

  return <div className="inline-block">{renderField()}</div>
}

