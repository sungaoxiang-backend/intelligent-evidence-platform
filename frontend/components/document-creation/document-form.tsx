"use client"

import React, { useEffect } from "react"
import { DocumentFormFields } from "@/components/documents/document-form-fields"

interface DocumentFormProps {
  placeholderMetadata: Record<string, {
    name: string
    type: "text" | "radio" | "checkbox" | ""
    options: string[]
  }>
  formData: Record<string, any>
  onFormChange: (key: string, value: any) => void
  onCheckboxChange: (key: string, option: string, checked: boolean) => void
  onDataChange?: (hasChanges: boolean) => void
  savedFormData?: Record<string, any>
}

export function DocumentForm({
  placeholderMetadata,
  formData,
  onFormChange,
  onCheckboxChange,
  onDataChange,
  savedFormData,
}: DocumentFormProps) {
  // 检测表单数据是否有更新
  useEffect(() => {
    if (!onDataChange || !savedFormData) return

    const hasChanges = JSON.stringify(formData) !== JSON.stringify(savedFormData)
    onDataChange(hasChanges)
  }, [formData, savedFormData, onDataChange])

  return (
    <div className="space-y-4">
      <DocumentFormFields
        placeholderMetadata={placeholderMetadata}
        formData={formData}
        onFormChange={onFormChange}
        onCheckboxChange={onCheckboxChange}
      />
    </div>
  )
}

