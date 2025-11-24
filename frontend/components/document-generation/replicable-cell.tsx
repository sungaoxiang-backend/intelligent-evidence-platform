"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo, PlaceholderFormField } from "./placeholder-form-fields"
import { getArrayFieldName, parseArrayFieldName } from "./replicable-cell-utils"

interface ReplicableCellProps {
  /** 单元格的原始 JSON 结构 */
  cellNode: JSONContent
  /** 单元格中的占位符列表 */
  placeholders: string[]
  /** 占位符信息列表 */
  placeholderInfos: PlaceholderInfo[]
  /** 表单数据 */
  formData: Record<string, any>
  /** 表单数据变化回调 */
  onFormDataChange: (formData: Record<string, any>) => void
  /** 模板类型 */
  templateCategory?: string | null
  /** 单元格的唯一标识 */
  cellId: string
}

/**
 * 可复制的单元格组件
 * 支持动态添加/删除字段组
 */
export function ReplicableCell({
  cellNode,
  placeholders,
  placeholderInfos,
  formData,
  onFormDataChange,
  templateCategory,
  cellId,
}: ReplicableCellProps) {
  console.log("ReplicableCell render:", { 
    cellId, 
    placeholders, 
    formDataKeys: Object.keys(formData || {}),
    formDataKeysCount: Object.keys(formData || {}).length
  })
  
  // 获取当前有多少个副本
  const getReplicaCount = (): number => {
    // 检查第一个占位符有多少个数组索引
    if (placeholders.length === 0) return 1
    
    const firstPlaceholder = placeholders[0]
    let maxIndex = -1
    let hasOriginalField = false
    
    console.log("getReplicaCount: checking formData keys:", Object.keys(formData))
    
    // 查找所有相关的数组字段
    Object.keys(formData).forEach(key => {
      const parsed = parseArrayFieldName(key)
      if (parsed && parsed.baseName === firstPlaceholder) {
        console.log(`getReplicaCount: found array field ${key}, index: ${parsed.index}`)
        maxIndex = Math.max(maxIndex, parsed.index)
      } else if (key === firstPlaceholder && formData[key] !== undefined) {
        // 如果存在原始字段名（没有数组索引），也算作一个副本
        console.log(`getReplicaCount: found original field ${key}`)
        hasOriginalField = true
      }
    })
    
    // 如果找到了数组字段，返回最大索引+1
    if (maxIndex >= 0) {
      const count = maxIndex + 1
      console.log(`getReplicaCount: found array fields, maxIndex: ${maxIndex}, returning count: ${count}`)
      return count
    }
    
    // 如果有原始字段，返回1（表示有一个副本，但还没有转换为数组格式）
    // 如果没有原始字段，也返回1（默认一个）
    const count = hasOriginalField ? 1 : 1
    console.log(`getReplicaCount: no array fields, hasOriginalField: ${hasOriginalField}, returning: ${count}`)
    return count
  }
  
  const [replicaCount, setReplicaCount] = useState(() => {
    const count = getReplicaCount()
    console.log("ReplicableCell: initial replicaCount:", count, "formData keys:", Object.keys(formData))
    return count
  })
  
  // 当 formData 变化时更新副本数量
  useEffect(() => {
    const newCount = getReplicaCount()
    console.log("ReplicableCell: formData changed, new replicaCount:", newCount, "formData keys:", Object.keys(formData))
    setReplicaCount(newCount)
  }, [formData, placeholders])
  
  // 添加副本
  const handleAdd = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // 直接计算当前的副本数量，而不是使用状态值（避免状态更新延迟问题）
    const currentCount = getReplicaCount()
    console.log("handleAdd called, current replicaCount:", currentCount, "state replicaCount:", replicaCount)
    console.log("handleAdd: placeholders", placeholders)
    console.log("handleAdd: current formData", formData)
    
    const newFormData = { ...formData }
    
    // 检查是否是第一次添加（从原始字段转换为数组格式）
    const firstPlaceholder = placeholders[0]
    const hasArrayFields = Object.keys(formData).some(key => {
      const parsed = parseArrayFieldName(key)
      return parsed && parsed.baseName === firstPlaceholder
    })
    const hasOriginalField = formData[firstPlaceholder] !== undefined
    
    // 如果是第一次添加（有原始字段但没有数组字段），需要先迁移原始字段到 [0]
    if (!hasArrayFields && hasOriginalField) {
      placeholders.forEach(placeholder => {
        const arrayFieldName0 = getArrayFieldName(placeholder, 0)
        if (formData[placeholder] !== undefined) {
          newFormData[arrayFieldName0] = formData[placeholder]
          // 保留原始字段（向后兼容），但优先使用数组字段
          console.log(`handleAdd: 迁移原始字段 ${placeholder} 到 ${arrayFieldName0} = ${newFormData[arrayFieldName0]}`)
        }
      })
    }
    
    // 计算新索引（如果已经有数组字段，使用最大索引+1；否则使用1）
    const newIndex = hasArrayFields ? currentCount : 1
    
    // 为每个占位符创建新的数组字段
    placeholders.forEach(placeholder => {
      const arrayFieldName = getArrayFieldName(placeholder, newIndex)
      // 如果已经有值，复制最后一个副本的值；否则为空
      const lastFieldName = newIndex > 0 
        ? getArrayFieldName(placeholder, newIndex - 1)
        : null
      
      // 获取当前值（可能是原始字段名或数组字段名）
      const currentValue = (lastFieldName && newFormData[lastFieldName]) || newFormData[placeholder]
      
      newFormData[arrayFieldName] = currentValue !== undefined ? currentValue : ""
      
      console.log(`handleAdd: 创建字段 ${arrayFieldName} = ${newFormData[arrayFieldName]}`)
    })
    
    console.log("handleAdd: newFormData (完整)", JSON.stringify(newFormData, null, 2))
    
    // 直接更新 replicaCount，确保 UI 立即反映变化
    // 计算新数据中的副本数量
    const newCount = hasArrayFields ? newIndex + 1 : 2
    console.log("handleAdd: updating replicaCount to", newCount)
    setReplicaCount(newCount)
    
    onFormDataChange(newFormData)
  }
  
  // 删除副本
  const handleDelete = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (replicaCount <= 1) return // 至少保留一个
    
    console.log("handleDelete called, index:", index, "replicaCount:", replicaCount)
    const newFormData = { ...formData }
    
    // 删除指定索引的所有字段
    placeholders.forEach(placeholder => {
      const arrayFieldName = getArrayFieldName(placeholder, index)
      delete newFormData[arrayFieldName]
    })
    
    // 重新索引：将后面的字段前移
    for (let i = index + 1; i < replicaCount; i++) {
      placeholders.forEach(placeholder => {
        const oldFieldName = getArrayFieldName(placeholder, i)
        const newFieldName = getArrayFieldName(placeholder, i - 1)
        if (oldFieldName in newFormData) {
          newFormData[newFieldName] = newFormData[oldFieldName]
          delete newFormData[oldFieldName]
        }
      })
    }
    
    console.log("handleDelete: newFormData", newFormData)
    onFormDataChange(newFormData)
  }
  
  // 获取指定索引的占位符值
  const getPlaceholderValue = (placeholder: string, index: number): any => {
    // 优先查找数组格式的字段名
    const arrayFieldName = getArrayFieldName(placeholder, index)
    if (formData[arrayFieldName] !== undefined) {
      return formData[arrayFieldName]
    }
    
    // 如果是第一个索引（0），也检查原始字段名（向后兼容）
    if (index === 0 && formData[placeholder] !== undefined) {
      return formData[placeholder]
    }
    
    return ""
  }
  
  // 处理占位符值变化
  const handlePlaceholderChange = (placeholder: string, index: number, value: any) => {
    const arrayFieldName = getArrayFieldName(placeholder, index)
    onFormDataChange({
      ...formData,
      [arrayFieldName]: value,
    })
  }
  
  // 渲染单个字段组
  const renderFieldGroup = (index: number) => {
    const placeholderInfoMap = new Map(
      placeholderInfos.map(info => [info.name, info])
    )
    
    return (
      <div
        key={index}
        className={cn(
          "relative",
          index > 0 && "mt-4 pt-4 border-t border-dashed border-gray-300"
        )}
      >
        {/* 字段组内容 */}
        <div className="space-y-3">
          {placeholders.map(placeholder => {
            const info = placeholderInfoMap.get(placeholder)
            if (!info) return null
            
            // 判断是否是要素式模板
            const isElementStyle = templateCategory && (templateCategory.includes("要素") || templateCategory === "要素式")

            return (
              <div key={placeholder} className={isElementStyle ? "flex items-center gap-2" : ""}>
                {isElementStyle && (
                  <label className="text-sm font-medium text-gray-700 min-w-[100px]">
                    {info.name}:
                  </label>
                )}
                <div className={isElementStyle ? "flex-1" : ""}>
                  <PlaceholderFormField
                    placeholder={info}
                    value={getPlaceholderValue(placeholder, index)}
                    onChange={(value) => handlePlaceholderChange(placeholder, index, value)}
                    templateCategory={templateCategory}
                  />
                </div>
              </div>
            )
          })}
        </div>
        
        {/* 删除按钮 */}
        {replicaCount > 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => handleDelete(index, e)}
            className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            删除
          </Button>
        )}
      </div>
    )
  }
  
  return (
    <div className="replicable-cell">
      {/* 渲染所有字段组 */}
      {Array.from({ length: replicaCount }).map((_, index) => renderFieldGroup(index))}
      
      {/* 添加按钮 */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => handleAdd(e)}
        className="mt-4 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
      >
        <Plus className="h-4 w-4 mr-1" />
        添加
      </Button>
    </div>
  )
}

