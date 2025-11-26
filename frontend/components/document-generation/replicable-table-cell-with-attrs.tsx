"use client"

import { mergeAttributes } from "@tiptap/core"
import { TableCellWithAttrs } from "@/components/template-editor/extensions"
import { Node } from "@tiptap/core"
import React from "react"
import { createRoot } from "react-dom/client"
import { ReplicableCell } from "./replicable-cell"
import { extractPlaceholdersFromCell } from "./replicable-cell-utils"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { createNarrativeTableCell } from "./narrative-table-cell"

export interface ReplicableTableCellWithAttrsOptions {
  getPlaceholderInfos?: () => PlaceholderInfo[]
  getFormData?: () => Record<string, any>
  onFormDataChange?: (formData: Record<string, any>) => void
  templateCategory?: string | null
  registerUpdateCallback?: (callback: () => void) => () => void
}

/**
 * 扩展 TableCellWithAttrs，支持可复制单元格
 */
export const ReplicableTableCellWithAttrs = TableCellWithAttrs.extend<ReplicableTableCellWithAttrsOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      getPlaceholderInfos: () => [],
      getFormData: () => ({}),
      onFormDataChange: () => {},
      templateCategory: null,
      registerUpdateCallback: () => () => {},
    }
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement(node.attrs.isHeader ? "th" : "td")
      dom.setAttribute("data-type", "tableCell")

      // 检查单元格内容和模板类型
      const cellNode = node.toJSON() as JSONContent
      const placeholders = extractPlaceholdersFromCell(cellNode)

      // 判断模板类型
      const isElementStyle = this.options.templateCategory &&
        (this.options.templateCategory.includes("要素") || this.options.templateCategory === "要素式")

      // 完全独立的处理逻辑：
      // 1. 陈述式模板（无论是否有占位符）-> 使用 narrative-table-cell 支持添加/删除功能
      // 2. 要素式模板且包含多个占位符 -> 使用 ReplicableCell
      // 3. 其他情况 -> 使用默认渲染

      if (!isElementStyle) {
        // 陈述式模板：所有单元格都使用 narrative-table-cell 支持添加/删除功能
        // 即使没有占位符，也要渲染为可复制的段落形式
        console.log("使用 narrative-table-cell 处理陈述式模板单元格", { placeholders: placeholders.length, hasPlaceholders: placeholders.length > 0 })

        return createNarrativeTableCell(
          dom,
          cellNode,
          this.options.getPlaceholderInfos?.() || [],
          this.options.getFormData?.() || {},
          (newFormData) => {
            if (this.options.onFormDataChange) {
              this.options.onFormDataChange(newFormData)
            }
          },
          this.options.templateCategory,
          `cell-${getPos?.() || Date.now()}`,
          this.options.registerUpdateCallback,
          this.options.getFormData
        )
      }

      if (isElementStyle && placeholders.length > 1) {
        // 要素式模板多个占位符：使用 ReplicableCell
        console.log("使用 ReplicableCell 处理要素式模板单元格", { placeholders: placeholders.length })

        let root: ReturnType<typeof createRoot> | null = null
        let isDestroyed = false
        let unregisterCallback: (() => void) | null = null

        const safeUnmount = () => {
          if (!root) return
          const currentRoot = root
          root = null

          setTimeout(() => {
            try {
              currentRoot.unmount()
            } catch (error) {
              console.warn("Error unmounting ReplicableCell:", error)
            }
          }, 0)
        }

        try {
          root = createRoot(dom)
          root.render(
            React.createElement(ReplicableCell, {
              cellNode,
              placeholders,
              placeholderInfos: this.options.getPlaceholderInfos?.() || [],
              formData: this.options.getFormData?.() || {},
              onFormDataChange: (newFormData) => {
                if (this.options.onFormDataChange) {
                  this.options.onFormDataChange(newFormData)
                }
              },
              templateCategory: this.options.templateCategory,
              cellId: `cell-${getPos?.() || Date.now()}`,
            })
          )

          if (this.options.registerUpdateCallback) {
            unregisterCallback = this.options.registerUpdateCallback(() => {
              // 更新逻辑
              if (isDestroyed || !dom.parentNode) return

              const currentFormData = this.options.getFormData?.() || {}
              if (root) {
                try {
                  root.render(
                    React.createElement(ReplicableCell, {
                      cellNode,
                      placeholders,
                      placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                      formData: currentFormData,
                      onFormDataChange: (newFormData) => {
                        if (this.options.onFormDataChange) {
                          this.options.onFormDataChange(newFormData)
                        }
                      },
                      templateCategory: this.options.templateCategory,
                      cellId: `cell-${getPos?.() || Date.now()}`,
                    })
                  )
                } catch (error) {
                  console.error("Error updating ReplicableCell:", error)
                }
              }
            })
          }
        } catch (error) {
          console.error("Error rendering ReplicableCell:", error)
          dom.textContent = "渲染错误"
        }

        return {
          dom,
          contentDOM: null,
          destroy: () => {
            isDestroyed = true
            if (unregisterCallback) {
              unregisterCallback()
            }
            setTimeout(() => {
              safeUnmount()
            }, 0)
          },
          update: (updatedNode) => {
            if (isDestroyed || !dom.parentNode) return false

            const updatedCellNode = updatedNode.toJSON() as JSONContent
            const updatedPlaceholders = extractPlaceholdersFromCell(updatedCellNode)

            if (updatedPlaceholders.length > 1) {
              // 更新渲染
              if (root) {
                try {
                  root.render(
                    React.createElement(ReplicableCell, {
                      cellNode: updatedCellNode,
                      placeholders: updatedPlaceholders,
                      placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                      formData: this.options.getFormData?.() || {},
                      onFormDataChange: (newFormData) => {
                        if (this.options.onFormDataChange) {
                          this.options.onFormDataChange(newFormData)
                        }
                      },
                      templateCategory: this.options.templateCategory,
                      cellId: `cell-${getPos?.() || Date.now()}`,
                    })
                  )
                } catch (error) {
                  console.error("Error updating ReplicableCell:", error)
                  return false
                }
              }
              return true
            } else {
              // 不再需要特殊渲染，卸载并使用默认渲染
              if (root) {
                safeUnmount()
              }
              return false // 让 TipTap 使用默认渲染
            }
          },
        }
      }

      // 使用默认渲染（返回一个简单的NodeView）
      return {
        dom,
        contentDOM: dom,
      }
    }
  },
})

