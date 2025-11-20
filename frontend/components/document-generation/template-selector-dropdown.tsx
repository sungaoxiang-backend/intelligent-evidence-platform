"use client"

import React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"
import type { TemplateInfo } from "@/lib/document-generation-api"

export interface TemplateSelectorDropdownProps {
  templates: TemplateInfo[]
  selectedTemplateId?: number
  onSelect: (template: TemplateInfo | null) => void
  loading?: boolean
}

/**
 * 模板下拉选择器
 * 用于在文书生成页面选择模板
 */
export function TemplateSelectorDropdown({
  templates = [],
  selectedTemplateId,
  onSelect,
  loading = false,
}: TemplateSelectorDropdownProps) {
  const handleValueChange = (value: string) => {
    if (value === "none") {
      onSelect(null)
      return
    }
    const templateId = parseInt(value, 10)
    const template = templates.find((t) => t.id === templateId)
    if (template) {
      onSelect(template)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="template-selector" className="text-sm font-medium text-gray-700">
        选择模板
      </Label>
      <Select
        value={selectedTemplateId?.toString() || "none"}
        onValueChange={handleValueChange}
        disabled={loading}
      >
        <SelectTrigger
          id="template-selector"
          className="w-full h-10 bg-white border-gray-300"
        >
          <SelectValue placeholder="请选择模板" />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          <SelectItem value="none" disabled>
            <span className="text-gray-400">请选择模板</span>
          </SelectItem>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id.toString()}>
              <div className="flex items-center gap-2 py-1">
                <FileText className="h-4 w-4 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{template.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {template.placeholders.length} 字段
                    </Badge>
                  </div>
                  {template.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedTemplateId && (
        <div className="text-xs text-muted-foreground">
          已选择：
          {templates.find((t) => t.id === selectedTemplateId)?.name || "未知模板"}
        </div>
      )}
    </div>
  )
}

