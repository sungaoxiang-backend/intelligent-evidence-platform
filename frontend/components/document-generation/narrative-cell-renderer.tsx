"use client"

import React from "react"
import { createRoot } from "react-dom/client"
import { PlaceholderFormField } from "./placeholder-form-fields"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo } from "./placeholder-form-fields"

export interface NarrativeCellRendererProps {
  cellNode: JSONContent
  placeholderInfos: PlaceholderInfo[]
  formData: Record<string, any>
  onFormDataChange: (formData: Record<string, any>) => void
  templateCategory?: string | null
  getFormData: () => Record<string, any>
  cellId: string
}

/**
 * 陈述式单元格渲染器
 * 直接渲染为段落格式，不使用ReplicableCell组件
 */
export function NarrativeCellRenderer({
  cellNode,
  placeholderInfos,
  formData,
  onFormDataChange,
  templateCategory,
  getFormData,
  cellId,
}: NarrativeCellRendererProps) {
  console.log("NarrativeCellRenderer: component rendered", {
    cellNode,
    placeholderInfosCount: placeholderInfos.length,
    placeholderInfos: placeholderInfos.map(p => ({ name: p.name, type: p.type })),
    formDataKeys: Object.keys(formData),
    templateCategory,
    cellId
  })

  // 将单元格内容渲染为段落序列
  const renderContent = (node: JSONContent): React.ReactNode[] => {
    if (!node) {
      console.log("renderContent: node is null")
      return []
    }

    const nodeType = node.type
    console.log("renderContent: processing node", { nodeType, node })

    if (nodeType === "text") {
      const text = node.text || ""
      console.log("renderContent: text node", { text })
      return [text]
    }

    if (nodeType === "placeholder") {
      const fieldKey = node.attrs?.fieldKey || ""
      console.log("renderContent: placeholder node", { fieldKey })

      const placeholderInfo = placeholderInfos.find(p => p.name === fieldKey)

      if (!placeholderInfo) {
        return `{{${fieldKey}}}`
      }

      return React.createElement(PlaceholderFormField, {
        placeholder: placeholderInfo,
        value: formData[fieldKey] || getFormData()[fieldKey],
        onChange: (value: any) => onFormDataChange({ ...formData, [fieldKey]: value }),
        templateCategory,
      })
    }

    if (node.content && Array.isArray(node.content)) {
      console.log("renderContent: processing children", { childCount: node.content.length })
      return node.content.map((child, index) => (
        React.createElement(React.Fragment, { key: index }, renderContent(child))
      ))
    }

    console.log("renderContent: no content matched", { nodeType, node })
    return []
  }

  const content = renderContent(cellNode)
  console.log("NarrativeCellRenderer: final content", { content })

  return (
    <div className="narrative-cell-content" style={{ width: "100%" }}>
      {content}
    </div>
  )
}

export function createNarrativeCellRenderer(
  dom: HTMLElement,
  cellNode: JSONContent,
  placeholderInfos: PlaceholderInfo[],
  formData: Record<string, any>,
  onFormDataChange: (formData: Record<string, any>) => void,
  templateCategory?: string | null,
  cellId: string,
  registerUpdateCallback?: (callback: () => void) => () => void
) {
  console.log("createNarrativeCellRenderer: function called", {
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
    console.log("narrative-cell-renderer: renderCell start", {
      isDestroyed,
      hasDomParent: !!dom.parentNode,
      cellNode
    })

    if (isDestroyed || !dom.parentNode) {
      console.log("narrative-cell-renderer: renderCell early return", { isDestroyed, hasDomParent: !!dom.parentNode })
      return
    }

    try {
      console.log("narrative-cell-renderer: renderCell called", {
        cellNode,
        placeholderInfos: placeholderInfos.length,
        formDataKeys: Object.keys(formData),
        templateCategory,
        cellId
      })

      if (!root) {
        console.log("narrative-cell-renderer: creating root")
        root = createRoot(dom)
      }

      root.render(
        React.createElement(NarrativeCellRenderer, {
          cellNode,
          placeholderInfos,
          formData,
          onFormDataChange,
          templateCategory,
          getFormData: () => formData,
          cellId,
        })
      )

      console.log("narrative-cell-renderer: render completed")

      // 注册更新回调
      if (registerUpdateCallback && !unregisterCallback) {
        const updateCallback = () => {
          console.log("narrative-cell-renderer: update callback triggered")
          renderCell()
        }
        unregisterCallback = registerUpdateCallback(updateCallback)
      }
    } catch (error) {
      console.error("Error rendering narrative cell:", error)
      dom.textContent = "渲染错误"
    }
  }

  const delayedRender = () => {
    console.log("narrative-cell-renderer: delayedRender called")
    renderCell()
  }

  console.log("narrative-cell-renderer: about to schedule delayed render")
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
      // 这里可以添加比较逻辑，只有内容变化时才重新渲染
      renderCell()
      return true
    },
  }
}