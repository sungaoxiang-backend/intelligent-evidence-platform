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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { X } from "lucide-react"
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

      case "file":
        // file 类型：支持粘贴COS链接和拖拽图片，显示图片预览
        const fileUrl = internalValue || ""
        const isImageUrl = fileUrl && /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(fileUrl)
        const [isDragging, setIsDragging] = React.useState(false)
        const [previewImage, setPreviewImage] = React.useState<{ url: string } | null>(null)
        const fileInputRef = React.useRef<HTMLInputElement>(null)
        
        const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
          const pastedText = e.clipboardData.getData('text')
          if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
            e.preventDefault()
            handleChange(pastedText)
          }
        }

        const handleDragOver = (e: React.DragEvent<HTMLInputElement>) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(true)
        }

        const handleDragLeave = (e: React.DragEvent<HTMLInputElement>) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
        }

        const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          
          // 尝试从拖拽数据中获取URL
          const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            handleChange(url)
            return
          }
          
          // 如果没有URL，尝试获取文件
          const files = e.dataTransfer.files
          if (files && files.length > 0) {
            const file = files[0]
            if (file.type.startsWith('image/')) {
              // 如果是本地文件，创建临时URL（实际项目中可能需要上传到COS）
              const reader = new FileReader()
              reader.onload = (event) => {
                const result = event.target?.result
                if (typeof result === 'string') {
                  handleChange(result)
                }
              }
              reader.readAsDataURL(file)
            }
          }
        }

        return (
          <div className={cn("flex flex-col gap-2 min-w-[200px]", className)}>
            <div className="relative">
              <Input
                ref={(el) => {
                  inputRef.current = el
                  fileInputRef.current = el as HTMLInputElement
                }}
                type="text"
                value={fileUrl}
                onChange={(e) => handleChange(e.target.value)}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="粘贴图片链接或拖拽图片"
                className={cn(
                  "min-w-[200px] pr-8",
                  isDragging && "ring-2 ring-blue-500 bg-blue-50"
                )}
                disabled={disabled}
              />
              {fileUrl && (
                <button
                  type="button"
                  onClick={() => handleChange("")}
                  disabled={disabled}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="清除"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              )}
            </div>
            {isImageUrl && (
              <div 
                className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-50 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                onClick={() => setPreviewImage({ url: fileUrl })}
              >
                <img
                  src={fileUrl}
                  alt={placeholder.name}
                  className="w-full h-auto max-h-48 object-contain"
                  title="点击放大"
                  onError={(e) => {
                    // 如果图片加载失败，隐藏预览
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* 图片预览弹窗 */}
            <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
              <DialogContent className="max-w-none w-auto h-auto p-0 bg-transparent border-0 shadow-none">
                <DialogTitle className="sr-only">图片预览</DialogTitle>
                {previewImage && (
                  <div className="relative">
                    <img
                      src={previewImage.url}
                      alt={placeholder.name}
                      className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
                    />
                    
                    {/* 关闭按钮 */}
                    <Button 
                      onClick={() => setPreviewImage(null)} 
                      className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                      size="sm"
                    >
                      关闭
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
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

