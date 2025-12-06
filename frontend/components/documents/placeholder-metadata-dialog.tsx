"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { Plus, X } from "lucide-react"

interface PlaceholderMetadata {
  name: string
  type: "text" | "radio" | "checkbox" | ""
  options: string[]
}

interface PlaceholderMetadataDialogProps {
  open: boolean
  placeholderName: string
  metadata: PlaceholderMetadata | null
  onClose: () => void
  onSave: (metadata: PlaceholderMetadata) => void
}

export function PlaceholderMetadataDialog({
  open,
  placeholderName,
  metadata,
  onClose,
  onSave,
}: PlaceholderMetadataDialogProps) {
  const [formData, setFormData] = useState<PlaceholderMetadata>({
    name: placeholderName,
    type: "",
    options: [],
  })
  const [optionsList, setOptionsList] = useState<string[]>([])

  useEffect(() => {
    if (metadata) {
      setFormData(metadata)
      setOptionsList(metadata.options || [])
    } else {
      setFormData({
        name: placeholderName,
        type: "",
        options: [],
      })
      setOptionsList([])
    }
  }, [metadata, placeholderName, open])

  const handleAddOption = () => {
    setOptionsList([...optionsList, ""])
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...optionsList]
    newOptions[index] = value
    setOptionsList(newOptions)
  }

  const handleRemoveOption = (index: number) => {
    const newOptions = optionsList.filter((_, i) => i !== index)
    setOptionsList(newOptions)
  }

  const handleSave = () => {
    const options = optionsList
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0)

    onSave({
      ...formData,
      options,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑占位符元数据</DialogTitle>
          <DialogDescription>配置占位符 "{placeholderName}" 的元数据</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="placeholder-name">占位符名称</Label>
            <Input
              id="placeholder-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="placeholder-type">接收值类型</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData({ ...formData, type: value as any, options: [] })
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">普通文本</SelectItem>
                <SelectItem value="radio">单选</SelectItem>
                <SelectItem value="checkbox">多选</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(formData.type === "radio" || formData.type === "checkbox") && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>选项</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加选项
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {optionsList.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`选项 ${index + 1}`}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {optionsList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    点击"添加选项"来添加选项
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

