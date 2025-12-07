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
              // 首先检查元素本身的字体大小
              const fontSize = element.style.fontSize
              if (fontSize) {
                // 标准化字体大小格式
                let normalized = fontSize.trim()
                // 如果已经是 pt、px 或 em，直接返回
                if (normalized.includes("pt") || normalized.includes("px") || normalized.includes("em")) {
                  return normalized
                }
                // 如果是纯数字，假设是 pt
                const numValue = parseFloat(normalized)
                if (!isNaN(numValue)) {
                  return `${numValue}pt`
                }
                return normalized
              }
              
              // 检查父元素的字体大小（WPS 可能将字体大小设置在父元素上）
              let parent = element.parentElement
              while (parent && parent !== document.body) {
                if (parent.style.fontSize) {
                  const parentFontSize = parent.style.fontSize.trim()
                  if (parentFontSize) {
                    return parentFontSize
                  }
                }
                parent = parent.parentElement
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
              // 返回样式对象，Tiptap 会自动合并到 textStyle mark 的渲染中
              // 注意：这里返回的是对象格式，Tiptap 会将其合并到最终的 style 属性中
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

