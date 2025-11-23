"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import React from "react"
import { createRoot } from "react-dom/client"
import { ReplicableCell } from "./replicable-cell"
import { identifyReplicableCells, extractPlaceholdersFromCell } from "./replicable-cell-utils"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo } from "./placeholder-form-fields"

export interface ReplicableTableCellOptions {
  getPlaceholderInfo?: (fieldKey: string) => PlaceholderInfo | undefined
  getFormValue?: (fieldKey: string) => any
  onFormValueChange?: (fieldKey: string, value: any) => void
  getPlaceholderInfos?: () => PlaceholderInfo[]
  templateCategory?: string | null
  getFormData?: () => Record<string, any>
  onFormDataChange?: (formData: Record<string, any>) => void
}

export const ReplicableTableCell = Node.create<ReplicableTableCellOptions>({
  name: "tableCell",
  group: "block",
  content: "block+",
  tableRole: "cell",
  isolating: true,

  addOptions() {
    return {
      getPlaceholderInfo: () => undefined,
      getFormValue: () => undefined,
      onFormValueChange: () => {},
      getPlaceholderInfos: () => [],
      templateCategory: null,
      getFormData: () => ({}),
      onFormDataChange: () => {},
    }
  },

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => {
          const colspan = element.getAttribute("colspan")
          return colspan ? parseInt(colspan, 10) : 1
        },
        renderHTML: (attributes) => {
          if (!attributes.colspan || attributes.colspan === 1) {
            return {}
          }
          return {
            colspan: attributes.colspan,
          }
        },
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => {
          const rowspan = element.getAttribute("rowspan")
          return rowspan ? parseInt(rowspan, 10) : 1
        },
        renderHTML: (attributes) => {
          if (!attributes.rowspan || attributes.rowspan === 1) {
            return {}
          }
          return {
            rowspan: attributes.rowspan,
          }
        },
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute("data-colwidth")
          if (colwidth) {
            return colwidth.split(",").map((item) => parseInt(item, 10))
          }
          return null
        },
        renderHTML: (attributes) => {
          if (!attributes.colwidth) {
            return {}
          }
          return {
            "data-colwidth": attributes.colwidth.join(","),
          }
        },
      },
      backgroundColor: {
        default: null,
        parseHTML: (element) => {
          return element.style.backgroundColor || null
        },
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) {
            return {}
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "td",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement("td")
      dom.setAttribute("data-type", "tableCell")
      
      let root: ReturnType<typeof createRoot> | null = null
      let isDestroyed = false
      let currentCellId: string | null = null

      const safeUnmount = () => {
        if (!root) return
        try {
          root.unmount()
        } catch (error) {
          console.warn("Error unmounting ReplicableCell:", error)
        }
        root = null
      }

      const updateCell = () => {
        if (isDestroyed || !dom.parentNode) return

        // 检查单元格是否包含多个占位符
        const cellNode = node.toJSON() as JSONContent
        const placeholders = extractPlaceholdersFromCell(cellNode)
        
        // 如果包含多个占位符，使用 ReplicableCell 组件
        if (placeholders.length > 1) {
          const cellId = `cell-${getPos?.() || Date.now()}`
          
          // 如果 cellId 没变且已有 root，只更新数据
          if (currentCellId === cellId && root) {
            try {
              root.render(
                React.createElement(ReplicableCell, {
                  cellNode,
                  placeholders,
                  placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                  formData: this.options.getFormData?.() || {},
                  onFormDataChange: this.options.onFormDataChange || (() => {}),
                  templateCategory: this.options.templateCategory,
                  cellId,
                })
              )
            } catch (error) {
              console.error("Error updating ReplicableCell:", error)
            }
            return
          }

          // 需要重新创建组件
          safeUnmount()
          currentCellId = cellId

          requestAnimationFrame(() => {
            if (isDestroyed || !dom.parentNode) return
            
            try {
              root = createRoot(dom)
              root.render(
                React.createElement(ReplicableCell, {
                  cellNode,
                  placeholders,
                  placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                  formData: this.options.getFormData?.() || {},
                  onFormDataChange: this.options.onFormDataChange || (() => {}),
                  templateCategory: this.options.templateCategory,
                  cellId,
                })
              )
            } catch (error) {
              console.error("Error rendering ReplicableCell:", error)
              // 如果渲染失败，使用默认渲染
              dom.textContent = "渲染错误"
            }
          })
        } else {
          // 如果只有一个或没有占位符，使用默认渲染
          safeUnmount()
          currentCellId = null
          // 让 TipTap 使用默认的单元格渲染
          // 这里我们需要返回 null 让 TipTap 使用默认渲染
        }
      }

      // 初始渲染
      updateCell()

      // 监听数据变化
      const checkInterval = setInterval(() => {
        if (isDestroyed) {
          clearInterval(checkInterval)
          return
        }
        updateCell()
      }, 100)

      return {
        dom,
        contentDOM: dom,
        destroy: () => {
          isDestroyed = true
          clearInterval(checkInterval)
          safeUnmount()
        },
      }
    }
  },
})

