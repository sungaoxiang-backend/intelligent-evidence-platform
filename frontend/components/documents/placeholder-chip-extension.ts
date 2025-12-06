"use client"

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export const placeholderChipPluginKey = new PluginKey("placeholder-chip")

const PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g

interface PlaceholderChipOptions {
  onPlaceholderClick?: (fieldKey: string) => void
}

export const PlaceholderChipExtension = Extension.create<PlaceholderChipOptions>({
  name: "placeholderChip",

  addOptions() {
    return {
      onPlaceholderClick: undefined,
    }
  },

  addProseMirrorPlugins() {
    const { onPlaceholderClick } = this.options

    return [
      new Plugin({
        key: placeholderChipPluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, set) {
            if (!tr.doc) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const docSize = tr.doc.content.size

            tr.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return

              let match: RegExpExecArray | null
              const regex = new RegExp(PLACEHOLDER_REGEX)

              while ((match = regex.exec(node.text)) !== null) {
                try {
                  const fieldKey = match[1].trim()
                  const start = pos + (match.index ?? 0)
                  const end = start + match[0].length

                  if (start < 0 || end > docSize || start >= end) {
                    continue
                  }

                  decorations.push(
                    Decoration.inline(start, end, {
                      class: "placeholder-chip-editor",
                      "data-placeholder-field": fieldKey,
                      title: `点击编辑占位符: ${fieldKey}`,
                      style: "cursor: pointer;",
                    })
                  )
                } catch (error) {
                  console.error("Failed to create placeholder decoration:", error)
                }
              }
            })

            return DecorationSet.create(tr.doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          handleClick: (view, pos, event) => {
            const target = event.target as HTMLElement | null
            const span = target?.closest?.("[data-placeholder-field]") as HTMLElement | null
            if (!span) {
              return false
            }

            const fieldKey = span.getAttribute("data-placeholder-field")
            if (fieldKey && onPlaceholderClick) {
              onPlaceholderClick(fieldKey)
              event.preventDefault()
              event.stopPropagation()
              return true
            }
            return false
          },
        },
      }),
    ]
  },
})

