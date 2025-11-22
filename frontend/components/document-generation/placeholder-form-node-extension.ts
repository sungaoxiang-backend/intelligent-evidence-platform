"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import React from "react"
import { createRoot } from "react-dom/client"
import { PlaceholderFormField, PlaceholderInfo } from "./placeholder-form-fields"

export interface PlaceholderFormNodeOptions {
  getPlaceholderInfo?: (fieldKey: string) => PlaceholderInfo | undefined
  getFormValue?: (fieldKey: string) => any
  onFormValueChange?: (fieldKey: string, value: any) => void
  registerUpdateCallback?: (callback: () => void) => () => void
  templateCategory?: string | null
}

export const PlaceholderFormNode = Node.create<PlaceholderFormNodeOptions>({
  name: "placeholder",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addOptions() {
    return {
      getPlaceholderInfo: () => undefined,
      getFormValue: () => undefined,
      onFormValueChange: undefined,
      registerUpdateCallback: undefined,
      templateCategory: null,
    }
  },

  addAttributes() {
    return {
      fieldKey: {
        default: "",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-placeholder") || "",
        renderHTML: (attributes) => ({
          "data-placeholder": attributes.fieldKey,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "span[data-placeholder]",
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-placeholder": node.attrs.fieldKey,
        class: "placeholder-form-field",
        contenteditable: "false",
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span")
      dom.className = "placeholder-form-field"
      dom.contentEditable = "false"
      dom.style.display = "inline-block"
      dom.style.verticalAlign = "baseline"

      let root: ReturnType<typeof createRoot> | null = null
      let isDestroyed = false
      let currentFieldKey: string | null = null
      let currentPlaceholderInfo: PlaceholderInfo | null = null

      const safeUnmount = () => {
        if (!root) return
        
        const currentRoot = root
        root = null // 立即清空引用，避免重复卸载
        
        // 始终使用异步卸载，避免在React渲染期间同步卸载
        setTimeout(() => {
          try {
            if (currentRoot) {
              currentRoot.unmount()
            }
          } catch (error) {
            // 忽略卸载错误
          }
        }, 0)
      }

      const updateFormField = (fieldKey: string, forceRecreate = false) => {
        if (isDestroyed) return
        
        const placeholderInfo = this.options.getPlaceholderInfo?.(fieldKey)
        const formValue = this.options.getFormValue?.(fieldKey)

        if (!placeholderInfo) {
          // 如果没有占位符信息，显示占位符名称
          if (root) {
            safeUnmount()
          }
          dom.textContent = `{{${fieldKey}}}`
          currentFieldKey = null
          currentPlaceholderInfo = null
          return
        }

        // 如果 fieldKey 和 placeholderInfo 都没变，且已有 root，只更新值
        if (
          !forceRecreate &&
          root &&
          currentFieldKey === fieldKey &&
          currentPlaceholderInfo === placeholderInfo
        ) {
          // 只更新值，不重新创建组件
              root.render(
                React.createElement(PlaceholderFormField, {
                  placeholder: placeholderInfo,
                  value: formValue,
                  onChange: (value: any) => {
                    this.options.onFormValueChange?.(fieldKey, value)
                  },
                  templateCategory: this.options.templateCategory,
                })
              )
          return
        }

        // 需要重新创建组件
        if (root) {
          safeUnmount()
        }

        currentFieldKey = fieldKey
        currentPlaceholderInfo = placeholderInfo

        // 创建React根并渲染表单字段
        // 使用 requestAnimationFrame 确保在下一个渲染周期创建
        requestAnimationFrame(() => {
          if (isDestroyed || !dom.parentNode) return
          
          try {
            root = createRoot(dom)
            root.render(
              React.createElement(PlaceholderFormField, {
                placeholder: placeholderInfo,
                value: formValue,
                onChange: (value: any) => {
                  this.options.onFormValueChange?.(fieldKey, value)
                },
                templateCategory: this.options.templateCategory,
              })
            )
          } catch (error) {
            // 如果创建失败，显示占位符名称
            dom.textContent = `{{${fieldKey}}}`
          }
        })
      }

      updateFormField(node.attrs.fieldKey)

      // 注册值更新回调（用于外部数据加载时更新，不用于用户输入）
      let unregisterCallback: (() => void) | null = null
      if (this.options.registerUpdateCallback) {
        unregisterCallback = this.options.registerUpdateCallback(() => {
          if (!isDestroyed && root && currentFieldKey) {
            const placeholderInfo = this.options.getPlaceholderInfo?.(currentFieldKey)
            const formValue = this.options.getFormValue?.(currentFieldKey)
            if (placeholderInfo) {
              // 只更新值，不重新创建组件
              // 注意：PlaceholderFormField 使用内部状态，所以这个更新只会在输入框没有焦点时生效
              root.render(
                React.createElement(PlaceholderFormField, {
                  placeholder: placeholderInfo,
                  value: formValue,
                  onChange: (value: any) => {
                    this.options.onFormValueChange?.(currentFieldKey, value)
                  },
                  templateCategory: this.options.templateCategory,
                })
              )
            }
          }
        })
      }

      return {
        dom,
        ignoreMutation: () => true,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false
          }
          const newFieldKey = updatedNode.attrs.fieldKey
          // 只有当 fieldKey 变化时才强制重新创建
          const forceRecreate = newFieldKey !== currentFieldKey
          updateFormField(newFieldKey, forceRecreate)
          return true
        },
        destroy: () => {
          isDestroyed = true
          // 取消注册回调
          if (unregisterCallback) {
            unregisterCallback()
            unregisterCallback = null
          }
          // 异步卸载，避免在React渲染期间同步卸载
          safeUnmount()
        },
      }
    }
  },
})

