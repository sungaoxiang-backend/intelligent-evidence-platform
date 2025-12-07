"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  Table,
  PlusCircle,
  MinusCircle,
  Merge,
  Split,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Columns,
  Rows,
  ChevronDown as ChevronDownIcon,
} from "lucide-react"
import { X, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
  A4_PAGE_WIDTH,
  A4_PAGE_HEIGHT,
  A4_PAGE_MARGIN,
  A4_CONTENT_WIDTH,
} from "@/components/template-editor/extensions"
import { normalizeContent as normalizeContentUtil } from "@/components/template-editor/utils"
import { FontSize } from "./font-size-extension"
import { PlaceholderChipExtension } from "./placeholder-chip-extension"
import { PlaceholderMetadataDialog } from "./placeholder-metadata-dialog"
// import { TableContextMenu } from "./table-context-menu"
import { cn } from "@/lib/utils"

interface DocumentEditorProps {
  initialContent?: JSONContent | null
  onChange?: (json: JSONContent) => void
  onSave?: () => void
  onCancel?: () => void
  onExport?: () => void
  isLoading?: boolean
  className?: string
  placeholderMetadata?: Record<string, {
    name: string
    type: "text" | "radio" | "checkbox" | ""
    options: string[]
  }>
  onPlaceholderMetadataUpdate?: (metadata: Record<string, any>) => void
}

export function DocumentEditor({
  initialContent,
  onChange,
  onSave,
  onCancel,
  onExport,
  isLoading = false,
  className,
  placeholderMetadata,
  onPlaceholderMetadataUpdate,
}: DocumentEditorProps) {
  const contentSetRef = useRef(false)
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<string | null>(null)
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false)
  // 用于强制重新渲染工具栏，以便字号选择器能同步更新
  const [, forceUpdate] = useState({})
  const updateToolbar = useCallback(() => {
    forceUpdate({})
  }, [])

  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeContentUtil(JSON.parse(JSON.stringify(value)))
  }, [])

  const handlePlaceholderClick = useCallback((fieldKey: string) => {
    setSelectedPlaceholder(fieldKey)
    setIsMetadataDialogOpen(true)
  }, [])

  const handleSaveMetadata = useCallback((metadata: {
    name: string
    type: "text" | "radio" | "checkbox" | ""
    options: string[]
  }) => {
    if (!placeholderMetadata || !onPlaceholderMetadataUpdate || !selectedPlaceholder) return

    const updated = {
      ...placeholderMetadata,
      [selectedPlaceholder]: metadata,
    }
    onPlaceholderMetadataUpdate(updated)
    setIsMetadataDialogOpen(false)
    setSelectedPlaceholder(null)
  }, [placeholderMetadata, onPlaceholderMetadataUpdate, selectedPlaceholder])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        hardBreak: false,
      }),
      HardBreak.configure({
        keepMarks: true,
      }),
      ParagraphWithAttrs,
      HeadingWithAttrs,
      TableWithAttrs.configure({
        resizable: true,
        allowTableNodeSelection: true, // 允许表格选择，支持单元格多选
        HTMLAttributes: {},
      }),
      TableRow.configure({
        HTMLAttributes: {},
      }),
      TableHeader.configure({
        HTMLAttributes: {},
      }),
      TableCellWithAttrs.configure({
        HTMLAttributes: {},
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Underline,
      TextStyle, // 必须在 FontSize 之前
      Color,
      FontSize, // 依赖于 TextStyle，必须在之后加载
      PlaceholderChipExtension.configure({
        onPlaceholderClick: handlePlaceholderClick,
      }),
    ],
    content: normalizeContent(initialContent) || { type: "doc", content: [] },
    editable: !isLoading,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "outline: none;",
      },
      // 优化粘贴处理：基于 A4 页面尺寸 1:1 保留 WPS 样式
      transformPastedHTML(html, view) {
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html
        
        // 辅助函数：将各种单位转换为 twips
        const pxToTwips = (px: number) => Math.round(px * 1440 / 96) // 96 DPI
        const ptToTwips = (pt: number) => Math.round(pt * 20) // 1pt = 20 twips
        
        // 处理表格：提取列宽信息和表格宽度
        const tables = tempDiv.querySelectorAll("table")
        tables.forEach((table) => {
          const tableEl = table as HTMLElement
          
          // 提取表格宽度
          let tableWidth: number | null = null
          if (tableEl.style.width) {
            const widthStr = tableEl.style.width
            const widthValue = parseFloat(widthStr)
            if (!isNaN(widthValue)) {
              if (widthStr.includes("px")) {
                tableWidth = pxToTwips(widthValue)
              } else if (widthStr.includes("pt")) {
                tableWidth = ptToTwips(widthValue)
              }
            }
          }
          
          // 提取列宽信息
          const colWidths: number[] = []
          const colgroup = tableEl.querySelector("colgroup")
          
          if (colgroup) {
            // 从 colgroup 中提取列宽
            const cols = colgroup.querySelectorAll("col")
            cols.forEach((col) => {
              const colEl = col as HTMLElement
              const widthStr = colEl.style.width || colEl.getAttribute("width") || ""
              const widthValue = parseFloat(widthStr)
              
              if (!isNaN(widthValue)) {
                let twips: number
                if (widthStr.includes("px")) {
                  twips = pxToTwips(widthValue)
                } else if (widthStr.includes("pt")) {
                  twips = ptToTwips(widthValue)
                } else if (widthStr.includes("%")) {
                  // 百分比需要根据表格宽度计算，这里先跳过
                  return
                } else {
                  // 假设是 px
                  twips = pxToTwips(widthValue)
                }
                colWidths.push(twips)
              }
            })
          } else {
            // 如果没有 colgroup，尝试从第一行的单元格宽度提取
            const firstRow = tableEl.querySelector("tr")
            if (firstRow) {
              const cells = firstRow.querySelectorAll("td, th")
              cells.forEach((cell) => {
                const cellEl = cell as HTMLElement
                const widthStr = cellEl.style.width || ""
                const widthValue = parseFloat(widthStr)
                
                if (!isNaN(widthValue) && widthStr.includes("px")) {
                  colWidths.push(pxToTwips(widthValue))
                }
              })
            }
          }
          
          // 将列宽信息保存到 data 属性中，供 Tiptap 解析
          if (colWidths.length > 0) {
            tableEl.setAttribute("data-col-widths", JSON.stringify(colWidths))
          }
          
          // 保存表格宽度
          if (tableWidth) {
            tableEl.setAttribute("data-table-width", tableWidth.toString())
            tableEl.setAttribute("data-table-width-type", "twips")
          }
        })
        
        // 处理所有元素，基于 A4 页面尺寸保留样式
        const allElements = tempDiv.querySelectorAll("*")
        
        allElements.forEach((element) => {
          const el = element as HTMLElement
          
          // 1. 处理 <center> 标签：将样式应用到子元素
          if (el.tagName === "CENTER") {
            const children = el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, div")
            children.forEach((child) => {
              const childEl = child as HTMLElement
              childEl.style.textAlign = "center"
            })
            if (["P", "H1", "H2", "H3", "H4", "H5", "H6"].includes(el.tagName)) {
              el.style.textAlign = "center"
            }
          }
          
          // 2. 处理 font 标签的 size 属性，转换为 CSS 样式（保留原始字体大小）
          if (el.tagName === "FONT" && el.getAttribute("size")) {
            const size = el.getAttribute("size")
            const sizeMap: Record<string, string> = {
              "1": "10pt", "2": "13pt", "3": "16pt", "4": "18pt",
              "5": "24pt", "6": "32pt", "7": "48pt",
            }
            el.style.fontSize = sizeMap[size || "3"] || "16pt"
            el.removeAttribute("size")
          }
          
          // 3. 处理所有元素的字体大小：确保保留 WPS 中的字体大小样式
          // WPS 的"小四"字号是 12pt，需要正确保留
          // 关键：将字体大小从父元素传递到文本节点，确保 Tiptap 能正确解析
          
          // 首先检查元素本身是否有字体大小
          let elementFontSize = el.style.fontSize
          
          // 如果没有，检查父元素的字体大小（WPS 可能将字体大小设置在父元素上）
          if (!elementFontSize) {
            let parent = el.parentElement
            while (parent && parent !== document.body) {
              if (parent.style.fontSize) {
                elementFontSize = parent.style.fontSize
                break
              }
              parent = parent.parentElement
            }
          }
          
          if (elementFontSize) {
            const fontSizeStr = elementFontSize.trim()
            // 标准化字体大小格式，确保单位正确
            let normalizedFontSize = fontSizeStr
            if (!fontSizeStr.includes("pt") && !fontSizeStr.includes("px") && !fontSizeStr.includes("em")) {
              const fontSizeValue = parseFloat(fontSizeStr)
              if (!isNaN(fontSizeValue)) {
                // 假设是 pt
                normalizedFontSize = `${fontSizeValue}pt`
              }
            }
            
            // 将字体大小应用到当前元素
            el.style.fontSize = normalizedFontSize
            
            // 关键修复：将字体大小样式应用到所有文本子节点（span 等）
            // 这样 Tiptap 的 parseHTML 才能正确解析字体大小
            // 注意：只应用到 span 和 font 标签，不要应用到 p、div、td、th 等块级元素
            const textNodes = el.querySelectorAll("span, font")
            if (textNodes.length > 0) {
              textNodes.forEach((node) => {
                const nodeEl = node as HTMLElement
                // 如果子元素没有字体大小，继承父元素的
                if (!nodeEl.style.fontSize) {
                  nodeEl.style.fontSize = normalizedFontSize
                }
              })
            }
          }
          
          // 4. 检查父元素的 text-align，传递到子元素
          const parent = el.parentElement
          if (parent && parent.style.textAlign && !el.style.textAlign) {
            if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV"].includes(el.tagName)) {
              el.style.textAlign = parent.style.textAlign
            }
          }
          
          // 5. 清理所有行高样式（WPS 粘贴的内容经常带有行高，导致"隐形空白"）
          // 对于段落和标题，统一移除行高，使用默认的 1.6
          if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "SPAN"].includes(el.tagName)) {
            if (el.style.lineHeight) {
              const lineHeight = el.style.lineHeight
              let value = parseFloat(lineHeight)
              if (lineHeight.includes("%")) {
                value = value / 100
              }
              // 如果行高不是标准的 1.0-1.8 范围，或者绝对值 > 25px，移除它
              // 这样可以避免 WPS 粘贴时带来的过大行高
              if (value < 1.0 || value > 1.8 || (value > 5 && value > 25)) {
                el.style.lineHeight = ""
              }
            }
          }
          
          // 6. 处理表格单元格：保留字体大小，只处理宽度和溢出
          if (el.tagName === "TD" || el.tagName === "TH") {
            // 移除可能导致溢出的宽度样式
            if (el.style.width === "auto" || el.style.minWidth) {
              // 移除 auto 宽度和过大的 min-width
              const minWidth = el.style.minWidth
              if (minWidth) {
                const minWidthValue = parseFloat(minWidth)
                // 如果 min-width 超过 500px，移除它（通常是不合理的值）
                if (minWidthValue > 500) {
                  el.style.minWidth = ""
                }
              }
              el.style.width = ""
            }
            
            // 确保 box-sizing
            el.style.boxSizing = "border-box"
            
            // 添加自动换行样式，防止内容溢出
            el.style.wordWrap = "break-word"
            el.style.overflowWrap = "break-word"
            
            // 移除可能导致溢出的 max-width（如果设置得过大）
            if (el.style.maxWidth) {
              const maxWidthValue = parseFloat(el.style.maxWidth)
              if (maxWidthValue > 1000) {
                el.style.maxWidth = ""
              }
            }
            
            // 修复单元格对齐方式冲突问题：
            // 1. 如果单元格本身没有对齐样式，但单元格内的段落有对齐样式，将段落的对齐样式提升到单元格
            // 2. 清理单元格内段落的对齐样式，确保单元格的对齐方式由单元格本身控制
            const cellAlign = el.style.textAlign || el.getAttribute("align")
            const paragraphs = el.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6")
            
            if (paragraphs.length > 0) {
              let paragraphAlign: string | null = null
              
              // 查找第一个有对齐样式的段落
              for (const para of Array.from(paragraphs)) {
                const paraEl = para as HTMLElement
                const paraAlign = paraEl.style.textAlign || paraEl.getAttribute("align")
                if (paraAlign && ["left", "center", "right", "justify"].includes(paraAlign.toLowerCase())) {
                  paragraphAlign = paraAlign.toLowerCase()
                  break
                }
              }
              
              // 如果单元格本身没有对齐样式，但段落有，将段落的对齐样式提升到单元格
              if (!cellAlign && paragraphAlign) {
                el.style.textAlign = paragraphAlign
                if (el.hasAttribute("align")) {
                  el.setAttribute("align", paragraphAlign)
                }
              }
              
              // 清理单元格内所有段落的对齐样式，避免冲突
              paragraphs.forEach((para) => {
                const paraEl = para as HTMLElement
                paraEl.style.textAlign = ""
                if (paraEl.hasAttribute("align")) {
                  paraEl.removeAttribute("align")
                }
              })
            }
          }
        })
        
        return tempDiv.innerHTML
      },
      transformPastedText(text, view) {
        // 对于纯文本，保持原样
        return text
      },
      clipboardTextSerializer: ({ editor }) => {
        // 自定义剪贴板文本序列化，保留格式
        return editor.getHTML()
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const normalized = normalizeContentUtil(JSON.parse(JSON.stringify(json)))
      if (normalized) {
        onChange?.(normalized)
      }
      // 更新工具栏状态，确保字号选择器同步
      updateToolbar()
    },
    onSelectionUpdate: () => {
      // 当选择变化时，更新工具栏状态
      updateToolbar()
    },
  })

  useEffect(() => {
    if (editor && initialContent && !contentSetRef.current) {
      try {
        const normalizedContent = normalizeContent(initialContent) || initialContent
        editor.commands.setContent(normalizedContent)
        contentSetRef.current = true
      } catch (error) {
        console.error("设置初始内容失败:", error)
      }
    }
  }, [editor, initialContent, normalizeContent])

  if (!editor) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <>
      <style jsx global>{templateBaseStyles}</style>
      <div className={cn("flex flex-col h-full", className)}>
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b gap-4">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0">
          <Button
            variant={editor.isActive("bold") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("italic") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("underline") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {/* 字号选择器 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 min-w-[60px]">
                {(() => {
                  const fontSize = editor.getAttributes("textStyle").fontSize
                  if (fontSize) {
                    // 提取数字部分显示
                    const match = fontSize.match(/(\d+(?:\.\d+)?)/)
                    if (match) {
                      const num = parseFloat(match[1])
                      // 转换为中文字号（正确的中文字号对应关系）
                      // 初号=42pt, 小初=36pt, 一号=26pt, 小一=24pt, 二号=22pt, 小二=18pt
                      // 三号=16pt, 小三=15pt, 四号=14pt, 小四=12pt, 五号=10.5pt, 小五=9pt
                      // 六号=7.5pt, 小六=6.5pt
                      if (num >= 42) return "初号"
                      if (num >= 36 && num < 42) return "小初"
                      if (num >= 26 && num < 36) return "一号"
                      if (num >= 24 && num < 26) return "小一"
                      if (num >= 22 && num < 24) return "二号"
                      if (num >= 18 && num < 22) return "小二"
                      if (num >= 16 && num < 18) return "三号"
                      if (num >= 15 && num < 16) return "小三"
                      if (num >= 14 && num < 15) return "四号"
                      if (num >= 12 && num < 14) return "小四"  // 12pt = 小四
                      if (num >= 10.5 && num < 12) return "五号"
                      if (num >= 9 && num < 10.5) return "小五"
                      if (num >= 7.5 && num < 9) return "六号"
                      if (num >= 6.5 && num < 7.5) return "小六"
                      return `${num}pt`
                    }
                    return fontSize
                  }
                  return "字号"
                })()}
                <ChevronDownIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuLabel>字号</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { label: "初号", size: "42pt" },
                { label: "小初", size: "36pt" },
                { label: "一号", size: "26pt" },
                { label: "小一", size: "24pt" },
                { label: "二号", size: "22pt" },
                { label: "小二", size: "18pt" },
                { label: "三号", size: "16pt" },
                { label: "小三", size: "15pt" },
                { label: "四号", size: "14pt" },
                { label: "小四", size: "12pt" },
                { label: "五号", size: "10.5pt" },
                { label: "小五", size: "9pt" },
                { label: "六号", size: "7.5pt" },
                { label: "小六", size: "6.5pt" },
              ].map((item) => {
                const currentFontSize = editor.getAttributes("textStyle").fontSize
                const isActive = currentFontSize === item.size
                return (
                  <DropdownMenuItem
                    key={item.size}
                    onClick={() => {
                      if (isActive) {
                        editor.chain().focus().unsetFontSize().run()
                      } else {
                        editor.chain().focus().setFontSize(item.size).run()
                      }
                    }}
                    className={isActive ? "bg-accent" : ""}
                  >
                    {item.label} ({item.size})
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6" />
          {/* 标题下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {editor.isActive("heading", { level: 1 }) ? (
                  <Heading1 className="h-4 w-4" />
                ) : editor.isActive("heading", { level: 2 }) ? (
                  <Heading2 className="h-4 w-4" />
                ) : editor.isActive("heading", { level: 3 }) ? (
                  <Heading3 className="h-4 w-4" />
                ) : (
                  <Heading1 className="h-4 w-4" />
                )}
                <ChevronDownIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>标题</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  // 应用标题时，清除文本上的 fontSize mark，让标题的 CSS 样式生效
                  editor.chain()
                    .focus()
                    .toggleHeading({ level: 1 })
                    .unsetFontSize()
                    .run()
                }}
                className={editor.isActive("heading", { level: 1 }) ? "bg-accent" : ""}
              >
                <Heading1 className="h-4 w-4 mr-2" />
                标题 1
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // 应用标题时，清除文本上的 fontSize mark，让标题的 CSS 样式生效
                  editor.chain()
                    .focus()
                    .toggleHeading({ level: 2 })
                    .unsetFontSize()
                    .run()
                }}
                className={editor.isActive("heading", { level: 2 }) ? "bg-accent" : ""}
              >
                <Heading2 className="h-4 w-4 mr-2" />
                标题 2
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // 应用标题时，清除文本上的 fontSize mark，让标题的 CSS 样式生效
                  editor.chain()
                    .focus()
                    .toggleHeading({ level: 3 })
                    .unsetFontSize()
                    .run()
                }}
                className={editor.isActive("heading", { level: 3 }) ? "bg-accent" : ""}
              >
                <Heading3 className="h-4 w-4 mr-2" />
                标题 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "justify" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="插入表格"
          >
            <Table className="h-4 w-4" />
          </Button>
          {/* 表格操作按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addColumnBefore 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnBefore().run()
            }}
            disabled={!editor.can().addColumnBefore()}
            title="在左侧添加列"
          >
            <div className="flex items-center gap-0.5">
              <ChevronLeft className="h-3 w-3" />
              <PlusCircle className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addColumnAfter 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnAfter().run()
            }}
            disabled={!editor.can().addColumnAfter()}
            title="在右侧添加列"
          >
            <div className="flex items-center gap-0.5">
              <PlusCircle className="h-3.5 w-3.5" />
              <ChevronRight className="h-3 w-3" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!editor.can().deleteColumn()}
            title="删除列"
          >
            <Columns className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addRowBefore 会自动将焦点设置到新添加的行
              editor.chain().focus().addRowBefore().run()
            }}
            disabled={!editor.can().addRowBefore()}
            title="在上方添加行"
          >
            <div className="flex flex-col items-center gap-0.5">
              <ChevronUp className="h-3 w-3" />
              <PlusCircle className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addRowAfter 会自动将焦点设置到新添加的行
              editor.chain().focus().addRowAfter().run()
            }}
            disabled={!editor.can().addRowAfter()}
            title="在下方添加行"
          >
            <div className="flex flex-col items-center gap-0.5">
              <PlusCircle className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!editor.can().deleteRow()}
            title="删除行"
          >
            <Rows className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 尝试合并单元格
              // 注意：需要先选中多个单元格（可以通过拖拽或 Shift+点击）
              editor.chain().focus().mergeCells().run()
            }}
            disabled={!editor.can().mergeCells?.()}
            title="合并单元格（需要选中至少2个单元格，可通过拖拽或 Shift+点击选择）"
          >
            <Merge className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().splitCell().run()}
            disabled={!editor.can().splitCell?.()}
            title="拆分单元格（需要选中已合并的单元格）"
          >
            <Split className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} title="取消">
              <X className="h-4 w-4" />
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={isLoading} title={isLoading ? "保存中..." : "保存"}>
              {isLoading ? (
                <span className="text-xs">保存中...</span>
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 编辑器内容 - 带页面容器 */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-4" onClick={() => editor?.commands.focus()}>
        <div className="template-doc-container">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
      <style jsx global>{`
        .placeholder-chip-editor {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          margin: 0 2px;
          border-radius: 4px;
          background-color: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.4);
          color: #1d4ed8;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
          font-size: 0.9em;
        }
        .placeholder-chip-editor:hover {
          background-color: rgba(59, 130, 246, 0.3);
          border-color: rgba(37, 99, 235, 0.8);
        }
      `}</style>
      {selectedPlaceholder && (
        <PlaceholderMetadataDialog
          open={isMetadataDialogOpen}
          placeholderName={selectedPlaceholder}
          metadata={placeholderMetadata?.[selectedPlaceholder] || null}
          onClose={() => {
            setIsMetadataDialogOpen(false)
            setSelectedPlaceholder(null)
          }}
          onSave={handleSaveMetadata}
        />
      )}
    </>
  )
}

