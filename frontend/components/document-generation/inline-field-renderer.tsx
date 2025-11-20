"use client"

import React from "react"
import type { PlaceholderInfo } from "@/lib/document-generation-api"

export interface InlineFieldRendererProps {
  placeholder: PlaceholderInfo
  value: any
  onChange: (value: any) => void
  disabled?: boolean
}

/**
 * 内联字段渲染器
 * 只渲染纯粹的输入控件，无标签、无提示，适合内嵌在文档中
 */
export function InlineFieldRenderer({
  placeholder,
  value,
  onChange,
  disabled = false,
}: InlineFieldRendererProps) {
  const fieldId = `inline-field-${placeholder.placeholder_name}`
  const displayValue = value || ""

  // 基础输入框样式 - 带边框的输入框，类似图2
  const baseInputClass = "inline-block border border-gray-300 rounded px-2 py-0.5 bg-white text-inherit leading-inherit focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"

  switch (placeholder.type) {
    case "text":
      return (
        <input
          id={fieldId}
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseInputClass} min-w-[120px] w-auto max-w-[300px]`}
          style={{ width: displayValue ? `${Math.max(displayValue.length, 10)}ch` : '150px' }}
          placeholder=""
        />
      )

    case "textarea":
      return (
        <textarea
          id={fieldId}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="inline-block align-top border border-gray-300 rounded px-2 py-1 bg-white text-inherit min-w-[250px] w-full max-w-[500px] min-h-[80px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          rows={4}
          placeholder=""
        />
      )

    case "select":
      return (
        <select
          id={fieldId}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseInputClass} min-w-[150px] w-auto cursor-pointer`}
        >
          <option value="">请选择</option>
          {placeholder.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )

    case "radio":
      const radioValue = displayValue || ""
      return (
        <span className="inline-flex gap-3 items-center">
          {placeholder.options?.map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer hover:text-blue-600">
              <input
                type="radio"
                name={fieldId}
                value={opt.value}
                checked={radioValue === opt.value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm select-none">{opt.label}</span>
            </label>
          ))}
        </span>
      )

    case "checkbox":
      const checkboxValues = Array.isArray(value) ? value : []
      return (
        <span className="inline-flex gap-3 items-center">
          {placeholder.options?.map((opt) => (
            <label key={opt.value} className="inline-flex items-center gap-1.5 cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                value={opt.value}
                checked={checkboxValues.includes(opt.value)}
                onChange={(e) => {
                  const newValue = e.target.checked
                    ? [...checkboxValues, opt.value]
                    : checkboxValues.filter((v) => v !== opt.value)
                  onChange(newValue)
                }}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm select-none">{opt.label}</span>
            </label>
          ))}
        </span>
      )

    case "date":
      return (
        <input
          id={fieldId}
          type="date"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseInputClass} min-w-[150px] w-[150px]`}
        />
      )

    case "number":
      return (
        <input
          id={fieldId}
          type="number"
          value={displayValue}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={disabled}
          className={`${baseInputClass} min-w-[100px] w-auto max-w-[200px]`}
          style={{ width: displayValue ? `${Math.max(String(displayValue).length, 8)}ch` : '120px' }}
          placeholder=""
        />
      )

    default:
      return (
        <input
          id={fieldId}
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseInputClass} min-w-[120px] w-auto max-w-[300px]`}
          style={{ width: displayValue ? `${Math.max(displayValue.length, 10)}ch` : '150px' }}
          placeholder=""
        />
      )
  }
}

