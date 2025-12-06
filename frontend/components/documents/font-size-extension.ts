/**
 * 字体大小扩展
 * 基于 TextStyle 扩展，添加 fontSize 属性
 */
import { Extension } from "@tiptap/core"
import TextStyle from "@tiptap/extension-text-style"

export interface FontSizeOptions {
  types: string[]
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * 设置字体大小
       */
      setFontSize: (fontSize: string) => ReturnType
      /**
       * 取消字体大小
       */
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => {
              const fontSize = element.style.fontSize
              if (fontSize) {
                return fontSize
              }
              // 尝试从 font 标签的 size 属性解析
              const fontTag = element.closest("font")
              if (fontTag && fontTag.getAttribute("size")) {
                const size = fontTag.getAttribute("size")
                // 将 HTML font size (1-7) 转换为 pt
                const sizeMap: Record<string, string> = {
                  "1": "10pt",
                  "2": "13pt",
                  "3": "16pt",
                  "4": "18pt",
                  "5": "24pt",
                  "6": "32pt",
                  "7": "48pt",
                }
                return sizeMap[size || "3"] || "16pt"
              }
              return null
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
        },
    }
  },
})

