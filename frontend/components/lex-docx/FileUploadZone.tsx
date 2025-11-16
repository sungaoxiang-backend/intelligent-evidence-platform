"use client"

import { useState, useRef, DragEvent, ChangeEvent } from "react"
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadZoneProps {
  accept?: string
  maxSize?: number // 单位：MB
  onFileSelect: (file: File) => void
  selectedFile?: File | null
  onRemove?: () => void
  disabled?: boolean
  className?: string
}

export function FileUploadZone({
  accept = ".docx",
  maxSize = 10,
  onFileSelect,
  selectedFile,
  onRemove,
  disabled = false,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 验证文件格式
  const validateFile = (file: File): boolean => {
    setError(null)

    // 检查文件扩展名
    const fileName = file.name.toLowerCase()
    const acceptedExtensions = accept.split(",").map((ext) => ext.trim().replace(".", ""))
    const fileExtension = fileName.split(".").pop()

    if (!fileExtension || !acceptedExtensions.includes(fileExtension)) {
      setError(`不支持的文件格式。仅支持: ${accept}`)
      return false
    }

    // 检查文件大小
    const maxSizeBytes = maxSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setError(`文件大小不能超过 ${maxSize}MB`)
      return false
    }

    return true
  }

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
    }
  }

  // 处理拖拽进入
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  // 处理拖拽离开
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  // 处理拖拽悬停
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // 处理文件放下
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // 处理文件输入变化
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
    // 重置 input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // 处理点击上传区域
  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // 处理移除文件
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRemove) {
      onRemove()
    }
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed",
          selectedFile && "border-green-300 bg-green-50/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                {!disabled && onRemove && (
                  <button
                    onClick={handleRemove}
                    className="ml-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    type="button"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!disabled && (
              <p className="text-xs text-gray-500">点击或拖拽文件以更换</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Upload
              className={cn(
                "h-12 w-12 mx-auto",
                isDragging ? "text-primary" : "text-gray-400"
              )}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? "松开以上传文件" : "点击上传或拖拽文件到此处"}
              </p>
              <p className="text-xs text-gray-500">
                支持 {accept} 格式，最大 {maxSize}MB
              </p>
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick()
                }}
              >
                选择文件
              </Button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

