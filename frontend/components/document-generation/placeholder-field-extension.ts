"use client"

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { PLACEHOLDER_REGEX } from "../template-editor/placeholder-manager"
import type { PlaceholderInfo } from "@/lib/document-generation-api"

export const placeholderFieldPluginKey = new PluginKey("placeholder-fields")

export interface PlaceholderFieldExtensionOptions {
  placeholders: PlaceholderInfo[]
  formData: Record<string, any>
  onFieldChange: (fieldName: string, value: any) => void
  readOnly?: boolean
}

interface PlaceholderRange {
  fieldKey: string
  from: number
  to: number
}

interface PlaceholderPluginState {
  decorations: DecorationSet
  ranges: PlaceholderRange[]
}

const buildPluginState = (
  doc: Parameters<typeof DecorationSet.create>[0],
  options: PlaceholderFieldExtensionOptions
): PlaceholderPluginState => {
  const decorations: Decoration[] = []
  const ranges: PlaceholderRange[] = []

  // 创建占位符映射表
  const placeholderMap = new Map<string, PlaceholderInfo>()
  options.placeholders.forEach((p) => placeholderMap.set(p.placeholder_name, p))

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    let match: RegExpExecArray | null
    PLACEHOLDER_REGEX.lastIndex = 0

    while ((match = PLACEHOLDER_REGEX.exec(node.text)) !== null) {
      const matchText = match[0]
      const fieldKey = match[1]
      const start = pos + (match.index ?? 0)
      const end = start + matchText.length

      ranges.push({ fieldKey, from: start, to: end })

      const placeholder = placeholderMap.get(fieldKey)

      if (!placeholder) {
        // 未定义的占位符，显示为红色错误提示
        decorations.push(
          Decoration.inline(start, end, {
            nodeName: "span",
            class: "template-placeholder-field template-placeholder-field--error",
            "data-placeholder-field": fieldKey,
            title: `未定义的占位符: ${fieldKey}`,
            contenteditable: "false",
          })
        )
      } else {
        // 隐藏原始占位符文本 {{xxx}}
        decorations.push(
          Decoration.inline(start, end, {
            nodeName: "span",
            class: "template-placeholder-hidden",
            style: "font-size: 0; line-height: 0; display: none;",
            contenteditable: "false",
          })
        )

        // 在占位符位置插入一个 widget 来挂载 React 表单组件
        decorations.push(
          Decoration.widget(
            start,
            () => {
              const wrapper = document.createElement("span")
              wrapper.className = "template-placeholder-widget"
              wrapper.contentEditable = "false"
              wrapper.style.display = "inline"
              wrapper.style.verticalAlign = "baseline"
              
              // 创建挂载点
              const field = document.createElement("span")
              field.className = "placeholder-field-mount"
              field.setAttribute("data-field-name", fieldKey)
              field.style.display = "inline"
              
              wrapper.appendChild(field)
              return wrapper
            },
            {
              side: 0,
            }
          )
        )
      }
    }
  })

  return {
    decorations: DecorationSet.create(doc, decorations),
    ranges,
  }
}

export const PlaceholderFieldExtension = Extension.create<PlaceholderFieldExtensionOptions>({
  name: "placeholderFields",

  addOptions() {
    return {
      placeholders: [],
      formData: {},
      onFieldChange: () => {},
      readOnly: false,
    }
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin<PlaceholderPluginState>({
      key: placeholderFieldPluginKey,
      state: {
        init: (_, state) => {
          return buildPluginState(state.doc, this.options)
        },
        apply: (tr, prev, _oldState, newState) => {
          const forceUpdate = tr.getMeta(placeholderFieldPluginKey)?.forceUpdate
          if (tr.docChanged || forceUpdate) {
            return buildPluginState(newState.doc, this.options)
          }
          return prev
        },
      },
      props: {
        decorations: (state) => plugin.getState(state)?.decorations ?? null,
      },
    })

    return [plugin]
  },
})

export const requestPlaceholderFieldRefresh = (editor: { view: any; state: any }) => {
  editor?.view?.dispatch?.(
    editor.state.tr.setMeta(placeholderFieldPluginKey, { forceUpdate: true })
  )
}

