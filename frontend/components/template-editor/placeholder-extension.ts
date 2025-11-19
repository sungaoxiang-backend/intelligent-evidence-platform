"use client"

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import {
  PLACEHOLDER_REGEX,
  PlaceholderMeta,
  createPlaceholderId,
} from "./placeholder-manager"

export const placeholderPluginKey = new PluginKey<PlaceholderPluginState>(
  "placeholder-interactions"
)

export interface PlaceholderExtensionOptions {
  getPlaceholderMetaById?: (id: string) => PlaceholderMeta | undefined
  onPlaceholderClick?: (id: string) => void
  onPlaceholderHover?: (id: string | null) => void
  onPlaceholderSelect?: (id: string) => void
  onPlaceholderDelete?: (range: { id: string; fieldKey: string }) => void
  getSelectedId?: () => string | null
  getHighlightedId?: () => string | null
}

interface PlaceholderRange {
  id: string
  fieldKey: string
  from: number
  to: number
}

interface PlaceholderPluginState {
  decorations: DecorationSet
  ranges: PlaceholderRange[]
}

const shouldBlockKey = (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false
  }
  const blockedKeys = [
    "Backspace",
    "Delete",
    "Enter",
    "Tab",
  ]
  if (blockedKeys.includes(event.key)) {
    return true
  }
  return event.key.length === 1
}

const buildPluginState = (
  doc: Parameters<typeof DecorationSet.create>[0],
  options: PlaceholderExtensionOptions,
  selection?: { from: number; to: number } | null
): PlaceholderPluginState => {
  const decorations: Decoration[] = []
  const ranges: PlaceholderRange[] = []
  let globalIndex = 0

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    let match: RegExpExecArray | null
    PLACEHOLDER_REGEX.lastIndex = 0

    while ((match = PLACEHOLDER_REGEX.exec(node.text)) !== null) {
      const matchText = match[0]
      const fieldKey = match[1]
      const start = pos + (match.index ?? 0)
      const end = start + matchText.length
      const id = createPlaceholderId(fieldKey, globalIndex++)

      ranges.push({ id, fieldKey, from: start, to: end })

      const meta = options.getPlaceholderMetaById?.(id)
      const selectedId = options.getSelectedId?.() ?? null
      const highlightedId = options.getHighlightedId?.() ?? null

      const classes = ["template-placeholder-chip"]
      if (meta?.id && meta.id === selectedId) {
        classes.push("template-placeholder-chip--selected")
      }
      if (meta?.id && meta.id === highlightedId) {
        classes.push("template-placeholder-chip--highlighted")
      }

      // 检查光标是否正好在这个占位符后面
      const cursorAfterPlaceholder = selection && 
        selection.from === selection.to && 
        selection.from === end

      if (cursorAfterPlaceholder) {
        classes.push("template-placeholder-chip--cursor-after")
      }

      decorations.push(
        Decoration.inline(start, end, {
          nodeName: "span",
          class: classes.join(" "),
          "data-placeholder-id": meta?.id ?? id,
          "data-placeholder-field": fieldKey,
          title: meta?.label ?? fieldKey,
          contenteditable: "false",
        })
      )
    }
  })

  return {
    decorations: DecorationSet.create(doc, decorations),
    ranges,
  }
}

const findRangeContainingPos = (
  ranges: PlaceholderRange[],
  pos: number
): PlaceholderRange | null =>
  ranges.find((range) => pos > range.from && pos < range.to) ?? null

const findRangeEndingAtPos = (
  ranges: PlaceholderRange[],
  pos: number
): PlaceholderRange | null => ranges.find((range) => range.to === pos) ?? null

const findRangeStartingAtPos = (
  ranges: PlaceholderRange[],
  pos: number
): PlaceholderRange | null => ranges.find((range) => range.from === pos) ?? null

const findRangeById = (
  ranges: PlaceholderRange[],
  id: string
): PlaceholderRange | null =>
  ranges.find((range) => range.id === id) ?? null

export const PlaceholderExtension = Extension.create<PlaceholderExtensionOptions>({
  name: "placeholderInteractions",

  addOptions() {
    return {
      getPlaceholderMetaById: () => undefined,
      onPlaceholderClick: () => {},
      onPlaceholderHover: () => {},
      onPlaceholderSelect: () => {},
      onPlaceholderDelete: () => {},
      getSelectedId: () => null,
      getHighlightedId: () => null,
    }
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin<PlaceholderPluginState>({
      key: placeholderPluginKey,
      state: {
        init: (_, state) => {
          const selection = state.selection
          return buildPluginState(state.doc, this.options, {
            from: selection.from,
            to: selection.to,
          })
        },
        apply: (tr, prev, _oldState, newState) => {
          const forceUpdate = tr.getMeta(placeholderPluginKey)?.forceUpdate
          const selectionChanged = !_oldState.selection.eq(newState.selection)
          if (tr.docChanged || forceUpdate || selectionChanged) {
            const selection = newState.selection
            return buildPluginState(newState.doc, this.options, {
              from: selection.from,
              to: selection.to,
            })
          }
          return prev
        },
      },
      props: {
        decorations: (state) => plugin.getState(state)?.decorations ?? null,
        handleClick: (view, _pos, event) => {
          const target = event.target as HTMLElement | null
          const span = target?.closest?.("[data-placeholder-id]") as HTMLElement | null
          if (!span) {
            return false
          }

          const id = span.getAttribute("data-placeholder-id")
          if (!id) return false

          const pluginState = plugin.getState(view.state)
          const range = pluginState?.ranges
            ? findRangeById(pluginState.ranges, id)
            : null
          if (range) {
            let collapsePos = range.to
            const rect = span.getBoundingClientRect?.()
            if (rect && rect.width > 0) {
              const relative = event.clientX - rect.left
              collapsePos = relative <= rect.width / 2 ? range.from : range.to
            }
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, collapsePos)
            )
            view.dispatch(tr)
          }

          this.options.onPlaceholderSelect?.(id)
          this.options.onPlaceholderClick?.(id)

          event.preventDefault()
          return true
        },
        handleDOMEvents: {
          mouseover: (_view, event) => {
            const target = event.target as HTMLElement | null
            const span = target?.closest?.("[data-placeholder-id]") as HTMLElement | null
            const id = span?.getAttribute("data-placeholder-id") ?? null
            this.options.onPlaceholderHover?.(id)
            return false
          },
          mouseleave: () => {
            this.options.onPlaceholderHover?.(null)
            return false
          },
        },
        handleKeyDown: (view, event) => {
          const pluginState = plugin.getState(view.state)
          if (!pluginState) return false

          const { from, to } = view.state.selection

          const triggerDelete = (targetRange: PlaceholderRange | null) => {
            if (!targetRange) return false
            event.preventDefault()
            this.options.onPlaceholderDelete?.({
              id: targetRange.id,
              fieldKey: targetRange.fieldKey,
            })
            return true
          }

          // 查找光标所在或相邻的占位符
          const findAdjacentRange = (pos: number): PlaceholderRange | null => {
            // 首先检查光标是否在占位符内部
            const rangeWithin = pluginState.ranges.find(
              (range) => pos >= range.from && pos <= range.to
            )
            if (rangeWithin) return rangeWithin

            // 检查光标是否紧邻占位符（允许1个字符的容差）
            for (const range of pluginState.ranges) {
              // Backspace: 光标在占位符后面（允许在 range.to 或 range.to - 1）
              if (event.key === "Backspace" && pos >= range.to - 1 && pos <= range.to + 1) {
                return range
              }
              // Delete: 光标在占位符前面（允许在 range.from 或 range.from + 1）
              if (event.key === "Delete" && pos >= range.from - 1 && pos <= range.from + 1) {
                return range
              }
            }
            return null
          }

          // 检查光标位置是否在占位符内部或相邻
          const rangeAtCursor = findAdjacentRange(from)
          if (rangeAtCursor) {
            const isEntirePlaceholder = from <= rangeAtCursor.from && to >= rangeAtCursor.to
            
            // 如果选择了整个占位符，或者光标在占位符内部/相邻位置，允许删除
            if (isEntirePlaceholder || event.key === "Backspace" || event.key === "Delete") {
              if (event.key === "Backspace" || event.key === "Delete") {
                return triggerDelete(rangeAtCursor)
              }
            }

            // 如果光标在占位符内部但不是全选，阻止其他按键输入
            if (!isEntirePlaceholder && shouldBlockKey(event)) {
              event.preventDefault()
              return true
            }
          }

          return false
        },
      },
    })

    return [plugin]
  },
})

export const requestPlaceholderRefresh = (editor: { view: any; state: any }) => {
  editor?.view?.dispatch?.(
    editor.state.tr.setMeta(placeholderPluginKey, { forceUpdate: true })
  )
}

