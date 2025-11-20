"use client"

import React from "react"
import { PlaceholderFieldRenderer, PlaceholderOption } from "./placeholder-field-renderer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export interface PlaceholderInfo {
  placeholder_name: string
  label?: string
  type: string
  hint?: string
  default_value?: string
  options?: PlaceholderOption[]
}

export interface GenerationFormProps {
  placeholders: PlaceholderInfo[]
  formData: Record<string, any>
  onChange: (fieldName: string, value: any) => void
  className?: string
}

/**
 * 文书生成表单组件
 * 遍历占位符列表，使用 PlaceholderFieldRenderer 渲染每个字段
 */
export function GenerationForm({
  placeholders,
  formData,
  onChange,
  className = "",
}: GenerationFormProps) {
  // 如果没有占位符，显示空状态
  if (!placeholders || placeholders.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            此模板没有配置占位符，无需填写表单。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 按字段分组（可选：如果需要支持分组功能）
  // 这里简单实现，不分组，直接渲染所有字段
  const renderFields = () => {
    return placeholders.map((placeholder) => (
      <div key={placeholder.placeholder_name} className="mb-6">
        <PlaceholderFieldRenderer
          placeholder_name={placeholder.placeholder_name}
          label={placeholder.label}
          type={placeholder.type}
          hint={placeholder.hint}
          default_value={placeholder.default_value}
          options={placeholder.options}
          value={formData[placeholder.placeholder_name]}
          onChange={(value) => onChange(placeholder.placeholder_name, value)}
        />
      </div>
    ))
  }

  // 如果字段较多（超过 10 个），使用折叠面板
  if (placeholders.length > 10) {
    // 按每 5 个字段分组
    const groupSize = 5
    const groups: PlaceholderInfo[][] = []
    for (let i = 0; i < placeholders.length; i += groupSize) {
      groups.push(placeholders.slice(i, i + groupSize))
    }

    return (
      <ScrollArea className={`h-full ${className}`}>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>表单填写</CardTitle>
              <CardDescription>
                请填写以下字段，所有字段均为可选，未填写的字段将保留占位符。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={["group-0"]} className="w-full">
                {groups.map((group, index) => (
                  <AccordionItem key={`group-${index}`} value={`group-${index}`}>
                    <AccordionTrigger>
                      字段组 {index + 1} （{group.length} 个字段）
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-6 pt-2">
                        {group.map((placeholder) => (
                          <div key={placeholder.placeholder_name}>
                            <PlaceholderFieldRenderer
                              placeholder_name={placeholder.placeholder_name}
                              label={placeholder.label}
                              type={placeholder.type}
                              hint={placeholder.hint}
                              default_value={placeholder.default_value}
                              options={placeholder.options}
                              value={formData[placeholder.placeholder_name]}
                              onChange={(value) => onChange(placeholder.placeholder_name, value)}
                            />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    )
  }

  // 字段较少时，直接渲染
  return (
    <ScrollArea className={`h-full ${className}`}>
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>表单填写</CardTitle>
            <CardDescription>
              请填写以下字段，所有字段均为可选，未填写的字段将保留占位符。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderFields()}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}

