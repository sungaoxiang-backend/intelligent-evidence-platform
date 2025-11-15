/**
 * Tiptap 自定义 Mark 扩展：用于标记和高亮占位符
 */
import { Mark, mergeAttributes } from "@tiptap/core"

export interface PlaceholderMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    placeholderMark: {
      /**
       * 设置占位符标记
       */
      setPlaceholderMark: (attributes: { name: string }) => ReturnType
      /**
       * 切换占位符标记
       */
      togglePlaceholderMark: (attributes: { name: string }) => ReturnType
      /**
       * 取消占位符标记
       */
      unsetPlaceholderMark: () => ReturnType
    }
  }
}

export const PlaceholderMark = Mark.create<PlaceholderMarkOptions>({
  name: "placeholderMark",

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-placeholder"),
        renderHTML: (attributes) => {
          if (!attributes.name) {
            return {}
          }
          return {
            "data-placeholder": attributes.name,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder]',
        getAttrs: (node) => {
          if (typeof node === "string") return false
          const name = node.getAttribute("data-placeholder")
          return name ? { name } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "lex-docx-placeholder-editor",
        style: "background-color: #fef3c7; color: #92400e; padding: 2px 4px; border-radius: 3px; font-weight: 500; font-family: 'Courier New', monospace; cursor: pointer; user-select: none;",
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setPlaceholderMark:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      togglePlaceholderMark:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes)
        },
      unsetPlaceholderMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

