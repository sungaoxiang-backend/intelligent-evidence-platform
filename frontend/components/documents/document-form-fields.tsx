"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface PlaceholderMetadata {
  name: string
  type: "text" | "radio" | "checkbox" | ""
  options: string[]
}

interface DocumentFormFieldsProps {
  placeholderMetadata: Record<string, PlaceholderMetadata>
  formData: Record<string, any>
  onFormChange: (key: string, value: any) => void
  onCheckboxChange: (key: string, option: string, checked: boolean) => void
}

export function DocumentFormFields({
  placeholderMetadata,
  formData,
  onFormChange,
  onCheckboxChange,
}: DocumentFormFieldsProps) {
  const placeholderEntries = Object.entries(placeholderMetadata)

  if (placeholderEntries.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">该模板没有占位符</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {placeholderEntries.map(([key, meta]) => (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{meta.name || key}</Label>
          {meta.type === "text" || !meta.type ? (
            <Input
              id={key}
              value={formData[key] || ""}
              onChange={(e) => onFormChange(key, e.target.value)}
              placeholder={`请输入${meta.name || key}`}
            />
          ) : meta.type === "radio" ? (
            <RadioGroup
              value={formData[key] || ""}
              onValueChange={(value) => onFormChange(key, value)}
            >
              {meta.options && meta.options.length > 0 ? (
                meta.options.map((option: string) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${key}-${option}`} />
                    <Label htmlFor={`${key}-${option}`} className="font-normal cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无选项</p>
              )}
            </RadioGroup>
          ) : meta.type === "checkbox" ? (
            <div className="space-y-2">
              {meta.options && meta.options.length > 0 ? (
                meta.options.map((option: string) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${key}-${option}`}
                      checked={(formData[key] || []).includes(option)}
                      onCheckedChange={(checked) =>
                        onCheckboxChange(key, option, checked as boolean)
                      }
                    />
                    <Label htmlFor={`${key}-${option}`} className="font-normal cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暂无选项</p>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

