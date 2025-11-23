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
      
      let root: ReturnType<typeof createRoot> | null = null
      let isDestroyed = false
      let currentCellId: string | null = null
      let unregisterCallback: (() => void) | null = null

      const updateReplicableCell = () => {
        if (isDestroyed || !dom.parentNode) {
          console.log("updateReplicableCell: skipped, isDestroyed:", isDestroyed, "has parent:", !!dom.parentNode)
          return
        }
        
        const cellNode = node.toJSON() as JSONContent
        const placeholders = extractPlaceholdersFromCell(cellNode)
        // 每次调用时都重新获取最新的 formData
        const currentFormData = this.options.getFormData?.() || {}
        
        console.log("updateReplicableCell: called", { 
          placeholders, 
          formDataKeys: Object.keys(currentFormData), 
          formDataKeysCount: Object.keys(currentFormData).length,
          hasRoot: !!root 
        })
        
        if (placeholders.length > 1) {
          if (!root) {
            console.log("updateReplicableCell: creating new root")
            try {
              root = createRoot(dom)
            } catch (error) {
              console.error("Error creating root:", error)
              return
            }
          }
          
          try {
            // 使用最新的 formData 重新渲染
            root.render(
              React.createElement(ReplicableCell, {
                cellNode,
                placeholders,
                placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                formData: currentFormData, // 使用最新的 formData
                onFormDataChange: (newFormData) => {
                  console.log("updateReplicableCell: onFormDataChange called", newFormData)
                  if (this.options.onFormDataChange) {
                    this.options.onFormDataChange(newFormData)
                  }
                },
                templateCategory: this.options.templateCategory,
                cellId: currentCellId || `cell-${getPos?.() || Date.now()}`,
              })
            )
            console.log("updateReplicableCell: rendered successfully with formData keys:", Object.keys(currentFormData).length)
          } catch (error) {
            console.error("Error updating ReplicableCell:", error)
          }
        }
      }

      const safeUnmount = () => {
        if (!root) return
        const currentRoot = root
        root = null // 先清空引用，避免重复调用
        
        // 使用 setTimeout 异步卸载，避免在 React 渲染过程中同步卸载
        setTimeout(() => {
          try {
            currentRoot.unmount()
          } catch (error) {
            // 忽略卸载错误，可能已经被卸载了
            console.warn("Error unmounting ReplicableCell:", error)
          }
        }, 0)
      }

      // 检查单元格是否包含多个占位符
      const cellNode = node.toJSON() as JSONContent
      const placeholders = extractPlaceholdersFromCell(cellNode)
      const isReplicable = placeholders.length > 1

      if (isReplicable) {
        // 如果包含多个占位符，使用 ReplicableCell 组件
        const cellId = `cell-${getPos?.() || Date.now()}`
        currentCellId = cellId

        // 立即渲染，不使用 requestAnimationFrame，确保按钮可以点击
        try {
          root = createRoot(dom)
          root.render(
            React.createElement(ReplicableCell, {
              cellNode,
              placeholders,
              placeholderInfos: this.options.getPlaceholderInfos?.() || [],
              formData: this.options.getFormData?.() || {},
              onFormDataChange: (newFormData) => {
                // 确保回调被调用
                if (this.options.onFormDataChange) {
                  this.options.onFormDataChange(newFormData)
                }
              },
              templateCategory: this.options.templateCategory,
              cellId,
            })
          )
          
          // 注册更新回调，当 formData 变化时更新组件
          if (this.options.registerUpdateCallback) {
            unregisterCallback = this.options.registerUpdateCallback(() => {
              updateReplicableCell()
            })
          }
        } catch (error) {
          console.error("Error rendering ReplicableCell:", error)
          // 如果渲染失败，使用默认渲染
          dom.textContent = "渲染错误"
        }

        // 返回自定义 NodeView（不使用 contentDOM，因为我们已经完全控制了渲染）
        return {
          dom,
          contentDOM: null,
          destroy: () => {
            isDestroyed = true
            // 取消注册回调
            if (unregisterCallback) {
              unregisterCallback()
              unregisterCallback = null
            }
            // 延迟卸载，避免在 React 渲染过程中同步卸载
            setTimeout(() => {
              safeUnmount()
            }, 0)
          },
          update: (updatedNode) => {
            // 当节点更新时，重新渲染
            if (isDestroyed || !dom.parentNode) return false
            
            const updatedCellNode = updatedNode.toJSON() as JSONContent
            const updatedPlaceholders = extractPlaceholdersFromCell(updatedCellNode)
            
            // 如果占位符数量变化，需要重新创建根节点
            if (updatedPlaceholders.length > 1) {
              // 如果之前没有根节点，或者占位符数量变化了，需要重新创建
              if (!root || placeholders.length !== updatedPlaceholders.length) {
                if (root) {
                  safeUnmount()
                }
                // 延迟创建，确保之前的卸载完成
                setTimeout(() => {
                  if (isDestroyed || !dom.parentNode) return
                  try {
                    root = createRoot(dom)
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
                        cellId: currentCellId || `cell-${getPos?.() || Date.now()}`,
                      })
                    )
                    
                    // 注册更新回调
                    if (unregisterCallback) {
                      unregisterCallback()
                    }
                    if (this.options.registerUpdateCallback) {
                      unregisterCallback = this.options.registerUpdateCallback(() => {
                        updateReplicableCell()
                      })
                    }
                  } catch (error) {
                    console.error("Error creating/updating root:", error)
                  }
                }, 0)
                return true
              }
              
              // 如果根节点存在且占位符数量没变，直接更新
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
                      cellId: currentCellId || `cell-${getPos?.() || Date.now()}`,
                    })
                  )
                  
                  // 重新注册更新回调
                  if (unregisterCallback) {
                    unregisterCallback()
                  }
                  if (this.options.registerUpdateCallback) {
                    unregisterCallback = this.options.registerUpdateCallback(() => {
                      updateReplicableCell()
                    })
                  }
                } catch (error) {
                  console.error("Error updating ReplicableCell:", error)
                  return false
                }
              }
            } else {
              // 如果占位符数量变为1或0，需要卸载并返回默认渲染
              if (root) {
                safeUnmount()
              }
            }
            return true
          },
        }
      }
      
      // 如果只有一个或没有占位符，使用默认渲染（返回 undefined 让 TipTap 使用默认 NodeView）
      return undefined
    }
  },
})

