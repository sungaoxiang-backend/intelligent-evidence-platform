"use client"

import { Node, mergeAttributes } from "@tiptap/core"

export interface PlaceholderNodeMeta {
  label?: string
  fieldType?: string
  description?: string
  required?: boolean
}

export interface PlaceholderNodeOptions {
  getPlaceholderMeta?: (fieldKey: string) => PlaceholderNodeMeta | undefined
  onPlaceholderClick?: (fieldKey: string, event: MouseEvent) => void
  onPlaceholderHover?: (fieldKey: string | null) => void
}

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: "📝",
  date: "📅",
  number: "🔢",
  select: "📋",
  multiline: "📄",
  boolean: "☑️",
  list: "📑",
}

const getFieldTypeIcon = (fieldType?: string) => {
  if (!fieldType) return FIELD_TYPE_ICONS.text
  return FIELD_TYPE_ICONS[fieldType] ?? FIELD_TYPE_ICONS.text
}

const buildDisplayLabel = (fieldKey: string, meta?: PlaceholderNodeMeta) => {
  const label = meta?.label || fieldKey
  const icon = getFieldTypeIcon(meta?.fieldType)
  return `${icon} ${label}${meta?.required ? " *" : ""}`
}

const applyMetaToChip = (
  chip: HTMLElement,
  fieldKey: string,
  meta?: PlaceholderNodeMeta
) => {
  chip.setAttribute("data-field-key", fieldKey)
  chip.setAttribute("data-placeholder-display", buildDisplayLabel(fieldKey, meta))
  chip.setAttribute("data-placeholder-label", meta?.label || fieldKey)
  if (meta?.required) {
    chip.setAttribute("data-placeholder-required", "true")
  } else {
    chip.removeAttribute("data-placeholder-required")
  }
  if (meta?.description) {
    chip.title = `${meta.label || fieldKey}\n${meta.description}\n\n点击显示操作菜单`
  } else {
    chip.title = `${meta?.label || fieldKey}\n\n点击显示操作菜单`
  }
}

export const PlaceholderNode = Node.create<PlaceholderNodeOptions>({
  name: "placeholder",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addOptions() {
    return {
      getPlaceholderMeta: () => undefined,
      onPlaceholderClick: undefined,
      onPlaceholderHover: undefined,
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
        class: "placeholder-chip-preview",
        contenteditable: "false",
      }),
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span")
      dom.className = "placeholder-chip-preview"
      dom.contentEditable = "false"

      const updateChip = (fieldKey: string) => {
        const meta = this.options.getPlaceholderMeta?.(fieldKey)
        applyMetaToChip(dom, fieldKey, meta)
      }

      updateChip(node.attrs.fieldKey)

      const handleClick = (event: MouseEvent) => {
        if (!this.options.onPlaceholderClick) return
        event.preventDefault()
        event.stopPropagation()
        this.options.onPlaceholderClick(node.attrs.fieldKey, event)
      }

      const handleMouseEnter = () => {
        this.options.onPlaceholderHover?.(node.attrs.fieldKey)
      }

      const handleMouseLeave = () => {
        this.options.onPlaceholderHover?.(null)
      }

      dom.addEventListener("click", handleClick)
      dom.addEventListener("mouseenter", handleMouseEnter)
      dom.addEventListener("mouseleave", handleMouseLeave)

      return {
        dom,
        ignoreMutation: () => true,
        selectNode: () => {
          dom.classList.add("placeholder-chip-preview--hover")
        },
        deselectNode: () => {
          dom.classList.remove("placeholder-chip-preview--hover")
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false
          }
          updateChip(updatedNode.attrs.fieldKey)
          return true
        },
        destroy: () => {
          dom.removeEventListener("click", handleClick)
          dom.removeEventListener("mouseenter", handleMouseEnter)
          dom.removeEventListener("mouseleave", handleMouseLeave)
        },
      }
    }
  },
})


