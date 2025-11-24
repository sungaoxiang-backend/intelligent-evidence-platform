"use client"

import React from "react"
import { createRoot } from "react-dom/client"
import { PlaceholderFormField } from "./placeholder-form-fields"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { Plus, Trash2 } from "lucide-react"

export interface NarrativeTableCellProps {
  cellNode: JSONContent
  placeholderInfos: PlaceholderInfo[]
  formData: Record<string, any>
  onFormDataChange: (formData: Record<string, any>) => void
  templateCategory?: string | null
  getFormData: () => Record<string, any>
  cellId: string
}

/**
 * 陈述式表格单元格组件，支持添加/删除功能
 */
export function NarrativeTableCell({
  cellNode,
  placeholderInfos,
  formData,
  onFormDataChange,
  templateCategory,
  getFormData,
  cellId,
}: NarrativeTableCellProps) {
  // 使用 ref 存储防抖定时器
  
  // 获取当前单元格的所有占位符
  const extractPlaceholdersFromNode = (node: JSONContent): string[] => {
    const placeholders: string[] = []

    const traverse = (n: JSONContent) => {
      if (n.type === "placeholder" && n.attrs?.fieldKey) {
        placeholders.push(n.attrs.fieldKey)
      }
      if (n.content && Array.isArray(n.content)) {
        n.content.forEach(traverse)
      }
    }

    traverse(node)
    return placeholders
  }

  const placeholders = extractPlaceholdersFromNode(cellNode)
  const baseKey = placeholders[0] || cellId

  // 使用 useMemo 缓存数组长度计算，避免频繁重新计算
  const arrayLength = React.useMemo(() => {
    let maxLength = 0
    const currentFormData = getFormData ? getFormData() : formData
    
    placeholders.forEach(key => {
      const value = currentFormData[key]
      
      if (Array.isArray(value)) {
        maxLength = Math.max(maxLength, value.length)
      } else if (value !== undefined && value !== null && value !== '') {
        maxLength = Math.max(maxLength, 1)
      }
    })

    // 特殊处理：如果所有数组都是空的（只包含空字符串），也显示一个段落
    if (maxLength === 0) {
      return 1
    }

    return maxLength
  }, [formData, placeholders, getFormData])

  // 获取指定索引的值
  const getValueAtIndex = (key: string, index: number) => {
    const value = formData[key] || getFormData()[key] || []
    if (Array.isArray(value)) {
      return value[index] || ""
    }
    return index === 0 ? value : ""
  }

  // 设置指定索引的值
  // 注意：现在只在失去焦点时调用，所以不需要防抖
  const setValueAtIndex = (key: string, index: number, newValue: any) => {
    const currentFormData = getFormData ? getFormData() : formData
    const currentValues = [...(currentFormData[key] || [])]

    // 确保数组长度足够
    while (currentValues.length <= index) {
      currentValues.push("")
    }

    currentValues[index] = newValue

    // 移除末尾的空值（但保留至少一个值）
    while (currentValues.length > 1 && currentValues[currentValues.length - 1] === "") {
      currentValues.pop()
    }

    const newFormData = {
      ...currentFormData,
      [key]: currentValues
    }

    onFormDataChange(newFormData)
  }

  // 添加新项
  const handleAdd = () => {
    console.log("handleAdd: starting to add new item")
    
    // 在添加前，先从 DOM 读取所有输入框的当前值
    // 因为输入框使用内部状态，不会自动更新 formData
    const cellElement = document.querySelector(`[data-cell-id="${cellId}"]`) || 
                       document.querySelector(`.narrative-table-cell`)
    
    // 创建一个新的 formData，从 DOM 读取所有当前值
    const currentFormDataFromDOM: Record<string, any> = {}
    
    if (cellElement) {
      const allInputs = cellElement.querySelectorAll('input[data-field-key], textarea[data-field-key]')
      
      // 先初始化所有占位符的数组
      placeholders.forEach(key => {
        currentFormDataFromDOM[key] = []
      })
      
      // 从 DOM 读取所有输入框的值
      allInputs.forEach((input) => {
        const fieldKey = input.getAttribute('data-field-key')
        const indexStr = input.getAttribute('data-field-index')
        const inputValue = (input as HTMLInputElement | HTMLTextAreaElement).value
        
        if (fieldKey && indexStr !== null) {
          const index = parseInt(indexStr, 10)
          if (!Array.isArray(currentFormDataFromDOM[fieldKey])) {
            currentFormDataFromDOM[fieldKey] = []
          }
          // 确保数组长度足够
          while (currentFormDataFromDOM[fieldKey].length <= index) {
            currentFormDataFromDOM[fieldKey].push("")
          }
          currentFormDataFromDOM[fieldKey][index] = inputValue
        }
      })
      
      // 移除末尾的空值（但保留至少一个值）
      placeholders.forEach(key => {
        const values = currentFormDataFromDOM[key]
        if (Array.isArray(values)) {
          while (values.length > 1 && values[values.length - 1] === "") {
            values.pop()
          }
          // 如果数组为空，设置为空数组
          if (values.length === 0) {
            currentFormDataFromDOM[key] = []
          }
        }
      })
    }
    
    // 合并从 DOM 读取的值和现有的 formData（优先使用 DOM 值）
    const currentFormData = getFormData ? getFormData() : formData
    const mergedFormData = { ...currentFormData, ...currentFormDataFromDOM }
    
    console.log("handleAdd: currentFormData from DOM", currentFormDataFromDOM)
    console.log("handleAdd: mergedFormData", mergedFormData)

    const newFormData = { ...mergedFormData }

    placeholders.forEach(key => {
      const currentValue = mergedFormData[key]
      let newValues: any[]
      
      if (Array.isArray(currentValue) && currentValue.length > 0) {
        // 如果已经是数组且有值，直接复制并添加新元素
        newValues = [...currentValue, ""]
      } else if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
        // 如果有非空值但不是数组，转换为数组并添加新元素
        newValues = [currentValue, ""]
      } else {
        // 如果没有值或为空，创建包含两个空元素的数组（第一个是当前状态，第二个是新添加的）
        // 这样第一次点击时，数组长度就是 2
        newValues = ["", ""]
      }
      
      newFormData[key] = newValues
      console.log(`handleAdd: updated ${key} from`, currentValue, `to`, newValues, `(length: ${newValues.length})`)
    })

    console.log("handleAdd: calling onFormDataChange with", newFormData)
    onFormDataChange(newFormData)
  }

  // 删除指定项
  const handleDelete = (indexToDelete: number) => {
    console.log("handleDelete: deleting item at index", indexToDelete)
    const currentFormData = getFormData ? getFormData() : formData
    const newFormData = { ...currentFormData }

    placeholders.forEach(key => {
      const currentValues = currentFormData[key] || []
      if (Array.isArray(currentValues)) {
        const newValues = currentValues.filter((_, index) => index !== indexToDelete)
        newFormData[key] = newValues
        console.log(`handleDelete: updated ${key}`, newValues)
      }
    })

    console.log("handleDelete: calling onFormDataChange with", newFormData)
    onFormDataChange(newFormData)
  }

  // 渲染单个占位符内容
  const renderPlaceholderContent = (node: JSONContent, index: number): React.ReactNode => {
    if (!node) return null

    const nodeType = node.type

    if (nodeType === "text") {
      return node.text || ""
    }

    if (nodeType === "placeholder") {
      const fieldKey = node.attrs?.fieldKey || ""
      const placeholderInfo = placeholderInfos.find(p => p.name === fieldKey)

      if (!placeholderInfo) {
        return `{{${fieldKey}}}`
      }

      // 使用稳定的 key 来避免重新创建输入框导致焦点丢失
      return React.createElement(PlaceholderFormField, {
        key: `${cellId}-${fieldKey}-${index}`,
        placeholder: placeholderInfo,
        value: getValueAtIndex(fieldKey, index),
        onChange: (value: any) => setValueAtIndex(fieldKey, index, value),
        templateCategory,
        index, // 传递 index，用于在 DOM 元素上存储
      })
    }

    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child, childIndex) => (
        React.createElement(React.Fragment, { key: `${cellId}-content-${index}-${childIndex}` }, renderPlaceholderContent(child, index))
      ))
    }

    return null
  }

  // 渲染单元格内容
  const renderCellContent = (index: number) => {
    console.log(`renderCellContent: rendering index ${index}, arrayLength=${arrayLength}`)
    return React.createElement('div', {
      key: index,
      className: "narrative-cell-item",
      style: {
        padding: "8px",
        borderBottom: index < arrayLength - 1 ? "1px solid #e5e7eb" : "none",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }
    }, [
      // 内容区域
      React.createElement('div', {
        key: 'content',
        className: "narrative-cell-content",
        style: {
          flex: 1,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px"
        }
      }, renderPlaceholderContent(cellNode, index)),

      // 删除按钮（仅在有多项时显示）
      arrayLength > 1 && React.createElement('button', {
        key: 'delete',
        className: "narrative-cell-delete",
        onClick: () => handleDelete(index),
        title: "删除此项",
        style: {
          padding: "4px",
          borderRadius: "4px",
          border: "1px solid #dc2626",
          backgroundColor: "#ffffff",
          color: "#dc2626",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      }, React.createElement(Trash2, { size: 16 }))
    ])
  }

  console.log("NarrativeTableCell: rendering with arrayLength =", arrayLength)
  const itemsToRender = Math.max(1, arrayLength)
  console.log("NarrativeTableCell: itemsToRender =", itemsToRender)

  return React.createElement('div', {
    className: "narrative-table-cell",
    style: {
      width: "100%",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      backgroundColor: "#ffffff"
    },
    key: `narrative-cell-${arrayLength}-${JSON.stringify(formData)}` // 强制重新渲染
  }, [
    // 渲染所有项目
    ...Array.from({ length: itemsToRender }, (_, index) => {
      console.log(`NarrativeTableCell: rendering item at index ${index}`)
      return renderCellContent(index)
    }),

    // 添加按钮
    React.createElement('div', {
      key: 'add-button-container',
      style: {
        padding: "8px",
        borderTop: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "center"
      }
    }, React.createElement('button', {
      className: "narrative-cell-add",
      onClick: handleAdd,
      title: "添加新项",
      style: {
        padding: "6px 12px",
        borderRadius: "4px",
        border: "1px solid #059669",
        backgroundColor: "#ffffff",
        color: "#059669",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "14px"
      }
    }, [
      React.createElement(Plus, { size: 16, key: 'icon' }),
      "添加"
    ]))
  ])
}

export function createNarrativeTableCell(
  dom: HTMLElement,
  cellNode: JSONContent,
  placeholderInfos: PlaceholderInfo[],
  formData: Record<string, any>,
  onFormDataChange: (formData: Record<string, any>) => void,
  templateCategory?: string | null,
  cellId: string,
  registerUpdateCallback?: (callback: () => void) => () => void,
  getFormData?: () => Record<string, any>
) {
  console.log("createNarrativeTableCell: function called", {
    dom,
    cellNode,
    placeholderInfos: placeholderInfos.length,
    formDataKeys: Object.keys(formData),
    templateCategory,
    cellId,
    hasRegisterUpdateCallback: !!registerUpdateCallback
  })

  let root: ReturnType<typeof createRoot> | null = null
  let isDestroyed = false
  let unregisterCallback: (() => void) | null = null

  const renderCell = () => {
    console.log("narrative-table-cell: renderCell start", {
      isDestroyed,
      hasDomParent: !!dom.parentNode,
      cellNode
    })

    if (isDestroyed || !dom.parentNode) {
      console.log("narrative-table-cell: renderCell early return", { isDestroyed, hasDomParent: !!dom.parentNode })
      return
    }

    // 动态获取最新的 formData
    const currentFormData = getFormData ? getFormData() : formData

    console.log("narrative-table-cell: renderCell called", {
      cellNode,
      placeholderInfos: placeholderInfos.length,
      formDataKeys: Object.keys(currentFormData),
      templateCategory,
      cellId
    })

    try {
      if (!root) {
        console.log("narrative-table-cell: creating root")
        root = createRoot(dom)
      }

      root.render(
        React.createElement(NarrativeTableCell, {
          cellNode,
          placeholderInfos,
          formData: currentFormData,
          onFormDataChange,
          templateCategory,
          getFormData: () => currentFormData,
          cellId,
        })
      )

      console.log("narrative-table-cell: render completed")

      // 注册更新回调
      if (registerUpdateCallback && !unregisterCallback) {
        const updateCallback = () => {
          console.log("narrative-table-cell: update callback triggered")
          renderCell()
        }
        unregisterCallback = registerUpdateCallback(updateCallback)
      }
    } catch (error) {
      console.error("Error rendering narrative table cell:", error)
      dom.textContent = "渲染错误"
    }
  }

  const delayedRender = () => {
    console.log("narrative-table-cell: delayedRender called")
    renderCell()
  }

  console.log("narrative-table-cell: about to schedule delayed render")
  // 使用 setTimeout 延迟渲染，等待 DOM 元素被添加到页面
  setTimeout(delayedRender, 0)

  return {
    dom,
    contentDOM: null, // 不使用 contentDOM，完全控制渲染
    destroy: () => {
      isDestroyed = true
      if (unregisterCallback) {
        unregisterCallback()
        unregisterCallback = null
      }
      if (root) {
        setTimeout(() => {
          try {
            root.unmount()
          } catch (error) {
            // 忽略卸载错误
          }
        }, 0)
      }
    },
    update: (updatedCellNode) => {
      if (isDestroyed || !dom.parentNode) return false

      // 更新单元格节点引用
      console.log("narrative-table-cell: update called", { updatedCellNode })
      renderCell()
      return true
    },
  }
}