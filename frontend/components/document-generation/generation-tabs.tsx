"use client"

import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileEdit, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface GenerationTabsProps {
  formContent: React.ReactNode
  previewContent: React.ReactNode
  filledFieldsCount?: number
  totalFieldsCount?: number
  activeTab?: "form" | "preview"
  onTabChange?: (tab: "form" | "preview") => void
  className?: string
}

/**
 * 文书生成标签页组件
 * 在表单和预览之间切换
 */
export function GenerationTabs({
  formContent,
  previewContent,
  filledFieldsCount = 0,
  totalFieldsCount = 0,
  activeTab = "form",
  onTabChange,
  className = "",
}: GenerationTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange?.(value as "form" | "preview")}
      className={`h-full flex flex-col ${className}`}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form" className="flex items-center gap-2">
          <FileEdit className="h-4 w-4" />
          <span>表单填写</span>
          {totalFieldsCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {filledFieldsCount}/{totalFieldsCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="preview" className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          <span>文书预览</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="form" className="flex-1 overflow-hidden mt-0">
        {formContent}
      </TabsContent>

      <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
        {previewContent}
      </TabsContent>
    </Tabs>
  )
}

