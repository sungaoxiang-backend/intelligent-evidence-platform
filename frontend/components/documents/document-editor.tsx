"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
// 扩展配置已移至 document-extensions.ts
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
  Plus,
  Minus,
  Merge,
  Split,
  Columns,
  Rows,
  ChevronDown as ChevronDownIcon,
} from "lucide-react"
import { X, Check, Download } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  templateBaseStyles,
  A4_PAGE_WIDTH,
  A4_PAGE_HEIGHT,
  A4_PAGE_MARGIN,
  A4_CONTENT_WIDTH,
} from "@/components/template-editor/extensions"
import { normalizeContent as normalizeContentUtil } from "@/components/template-editor/utils"
import { createDocumentExtensions } from "./document-extensions"
import { PlaceholderChipExtension } from "./placeholder-chip-extension"
import { PlaceholderMetadataDialog } from "./placeholder-metadata-dialog"
// import { TableContextMenu } from "./table-context-menu"
import { cn } from "@/lib/utils"
import { findTable, findCell } from "@tiptap/pm/tables"

interface DocumentEditorProps {
  initialContent?: JSONContent | null
  onChange?: (json: JSONContent) => void
  onSave?: () => void
  onCancel?: () => void
  onExport?: () => void
  isSaving?: boolean  // 保存中状态
  isDownloading?: boolean  // 下载中状态
  canSave?: boolean  // 是否允许保存（基于是否有变更）
  canExport?: boolean  // 是否允许导出/下载（基于是否有变更）
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
  isSaving = false,  // 保存中状态
  isDownloading = false,  // 下载中状态
  canSave = true,  // 默认允许保存
  canExport = true,  // 默认允许导出
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
    extensions: createDocumentExtensions({
      resizable: true, // 编辑模式，表格可调整大小
      allowTableNodeSelection: true, // 允许表格选择，支持单元格多选
      placeholderExtension: PlaceholderChipExtension.configure({
        onPlaceholderClick: handlePlaceholderClick,
      }),
    }),
    content: normalizeContent(initialContent) || { type: "doc", content: [] },
    editable: !isSaving && !isDownloading,
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
              } else if (widthStr.includes("%")) {
                // 处理百分比宽度：基于 A4 内容区域宽度计算
                // A4_CONTENT_WIDTH = 794 - 96*2 = 602px
                const A4_CONTENT_WIDTH = 602 // 与 extensions.ts 中的值保持一致
                const actualWidth = (widthValue / 100) * A4_CONTENT_WIDTH
                tableWidth = pxToTwips(actualWidth)
              }
            }
          }
          
          // 提取列宽信息
          const colWidths: number[] = []
          const colgroup = tableEl.querySelector("colgroup")
          
          // 辅助函数：将宽度字符串转换为 twips
          const parseWidthToTwips = (widthStr: string, tableWidthPx: number | null = null): number | null => {
            if (!widthStr) return null
            
            const widthValue = parseFloat(widthStr)
            if (isNaN(widthValue)) return null
            
            if (widthStr.includes("px")) {
              return pxToTwips(widthValue)
            } else if (widthStr.includes("pt")) {
              return ptToTwips(widthValue)
            } else if (widthStr.includes("cm")) {
              // 1cm = 37.8px (96 DPI)
              return pxToTwips(widthValue * 37.8)
            } else if (widthStr.includes("%")) {
              // 百分比需要根据表格宽度计算
              if (tableWidthPx !== null) {
                const actualWidth = (widthValue / 100) * tableWidthPx
                return pxToTwips(actualWidth)
              } else if (tableWidth) {
                // 如果表格宽度是 twips，先转换为 px
                const tableWidthPx = tableWidth / (1440 / 96)
                const actualWidth = (widthValue / 100) * tableWidthPx
                return pxToTwips(actualWidth)
              } else {
                // 如果没有表格宽度，使用 A4 内容区域宽度作为基准
                const A4_CONTENT_WIDTH = 602
                const actualWidth = (widthValue / 100) * A4_CONTENT_WIDTH
                return pxToTwips(actualWidth)
              }
            } else {
              // 假设是 px（无单位）
              return pxToTwips(widthValue)
            }
          }
          
          // 计算表格实际宽度（px），用于百分比计算
          let tableWidthPx: number | null = null
          if (tableWidth) {
            tableWidthPx = tableWidth / (1440 / 96) // twips 转 px
          } else if (tableEl.style.width) {
            const widthStr = tableEl.style.width
            const widthValue = parseFloat(widthStr)
            if (!isNaN(widthValue)) {
              if (widthStr.includes("px")) {
                tableWidthPx = widthValue
              } else if (widthStr.includes("pt")) {
                tableWidthPx = widthValue * 1.333 // pt 转 px (1pt = 1.333px)
              } else if (widthStr.includes("%")) {
                const A4_CONTENT_WIDTH = 602
                tableWidthPx = (widthValue / 100) * A4_CONTENT_WIDTH
              }
            }
          }
          
          if (colgroup) {
            // 从 colgroup 中提取列宽
            const cols = colgroup.querySelectorAll("col")
            cols.forEach((col) => {
              const colEl = col as HTMLElement
              const widthStr = colEl.style.width || colEl.getAttribute("width") || ""
              const twips = parseWidthToTwips(widthStr, tableWidthPx)
              if (twips !== null) {
                colWidths.push(twips)
              }
            })
          }
          
          // 如果没有 colgroup 或 colgroup 中没有足够的列宽信息，从第一行的单元格宽度提取
          if (colWidths.length === 0) {
            const firstRow = tableEl.querySelector("tr")
            if (firstRow) {
              const cells = firstRow.querySelectorAll("td, th")
              cells.forEach((cell) => {
                const cellEl = cell as HTMLElement
                // 检查是否是合并单元格（跳过合并的列）
                const colspan = cellEl.getAttribute("colspan")
                const colspanNum = colspan ? parseInt(colspan, 10) : 1
                
                // 尝试从多个来源获取宽度
                const widthStr = cellEl.style.width || 
                                 cellEl.getAttribute("width") || 
                                 cellEl.style.minWidth || 
                                 ""
                
                if (widthStr) {
                  const twips = parseWidthToTwips(widthStr, tableWidthPx)
                  if (twips !== null) {
                    // 如果是合并单元格，将宽度平均分配到各列
                    const widthPerCol = Math.round(twips / colspanNum)
                    for (let i = 0; i < colspanNum; i++) {
                      colWidths.push(widthPerCol)
                    }
                  }
                } else if (colspanNum > 1) {
                  // 合并单元格但没有宽度信息，为每列添加占位符（稍后会被实际宽度替换）
                  for (let i = 0; i < colspanNum; i++) {
                    colWidths.push(0) // 0 表示未知宽度
                  }
                }
              })
            }
          }
          
          // 验证列宽数组长度与表格列数匹配
          // 计算表格实际列数（考虑合并单元格）
          const firstRow = tableEl.querySelector("tr")
          if (firstRow && colWidths.length > 0) {
            const cells = firstRow.querySelectorAll("td, th")
            let actualColCount = 0
            cells.forEach((cell) => {
              const colspan = cell.getAttribute("colspan")
              const colspanNum = colspan ? parseInt(colspan, 10) : 1
              actualColCount += colspanNum
            })
            
            // 如果列宽数组长度不匹配，调整数组
            if (colWidths.length !== actualColCount) {
              if (colWidths.length < actualColCount) {
                // 如果列宽数组太短，用平均宽度填充
                const avgWidth = colWidths.length > 0 
                  ? Math.round(colWidths.reduce((a, b) => a + b, 0) / colWidths.length)
                  : pxToTwips(100) // 默认 100px
                while (colWidths.length < actualColCount) {
                  colWidths.push(avgWidth)
                }
              } else {
                // 如果列宽数组太长，截断
                colWidths.splice(actualColCount)
              }
            }
            
            // 移除占位符（值为 0 的列宽），用平均宽度替换
            const nonZeroWidths = colWidths.filter(w => w > 0)
            if (nonZeroWidths.length > 0) {
              const avgWidth = Math.round(nonZeroWidths.reduce((a, b) => a + b, 0) / nonZeroWidths.length)
              for (let i = 0; i < colWidths.length; i++) {
                if (colWidths[i] === 0) {
                  colWidths[i] = avgWidth
                }
              }
            }
          }
          
          // 将列宽信息保存到 data 属性中，供 Tiptap 解析
          if (colWidths.length > 0 && colWidths.every(w => w > 0)) {
            tableEl.setAttribute("data-col-widths", JSON.stringify(colWidths))
            console.log("[DocumentEditor] Extracted colWidths:", colWidths)
          } else {
            console.warn("[DocumentEditor] No valid colWidths extracted from table")
          }
          
          // 保存表格宽度
          if (tableWidth) {
            tableEl.setAttribute("data-table-width", tableWidth.toString())
            tableEl.setAttribute("data-table-width-type", "twips")
          }
          
          // 提取行高信息
          const rows = tableEl.querySelectorAll("tr")
          rows.forEach((row, rowIndex) => {
            const rowEl = row as HTMLElement
            
            // 辅助函数：将行高字符串转换为 twips
            const parseHeightToTwips = (heightStr: string): number | null => {
              if (!heightStr) return null
              const heightValue = parseFloat(heightStr)
              if (isNaN(heightValue)) return null
              
              if (heightStr.includes("px")) {
                return pxToTwips(heightValue)
              } else if (heightStr.includes("pt")) {
                return ptToTwips(heightValue)
              } else if (heightStr.includes("cm")) {
                // 1cm = 37.8px (96 DPI)
                return pxToTwips(heightValue * 37.8)
              } else {
                // 假设是 px（无单位）
                return pxToTwips(heightValue)
              }
            }
            
            // 尝试从多个来源提取行高：
            // 1. 从 tr 元素的 style.height 或 height 属性
            let heightStr = rowEl.style.height || rowEl.getAttribute("height") || ""
            let twips: number | null = null
            
            if (heightStr) {
              twips = parseHeightToTwips(heightStr)
            }
            
            // 2. 如果 tr 没有行高，尝试从第一个单元格的高度提取（WPS 可能将行高设置在单元格上）
            if (!twips) {
              const firstCell = rowEl.querySelector("td, th") as HTMLElement | null
              if (firstCell) {
                // 检查单元格的计算高度（包括 padding、border 等）
                const computedStyle = window.getComputedStyle(firstCell)
                const cellHeight = parseFloat(computedStyle.height)
                if (!isNaN(cellHeight) && cellHeight > 0) {
                  // 使用单元格高度作为行高
                  twips = pxToTwips(cellHeight)
                } else {
                  // 尝试从单元格的 style.height
                  const cellHeightStr = firstCell.style.height || firstCell.getAttribute("height") || ""
                  if (cellHeightStr) {
                    twips = parseHeightToTwips(cellHeightStr)
                  }
                }
              }
            }
            
            // 验证行高值的合理性（10-5000 twips，约 7-3333px）
            // 放宽范围以适应 WPS 导出的各种行高值
            if (twips !== null && twips >= 10 && twips <= 5000) {
              // 同时设置 data 属性和 style，确保 Tiptap 能够解析
              rowEl.setAttribute("data-row-height", twips.toString())
              // 直接将行高应用到 style，这样 Tiptap 在解析时就能看到
              const px = twips * (96 / 1440)
              rowEl.style.height = `${px}px`
              console.log(`[DocumentEditor] Extracted rowHeight for row ${rowIndex}:`, twips, "twips (≈", Math.round(px), "px), applied to style")
            } else if (twips !== null) {
              console.warn(`[DocumentEditor] Row height ${twips} twips is out of valid range (10-5000) for row ${rowIndex}`)
            }
          })
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
        // 检查 editor 是否存在且已初始化，避免在初始化过程中调用 getHTML()
        if (!editor || !editor.getHTML) {
          return ""
        }
        return editor.getHTML()
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      
      // 调试：检查 JSON 结构，特别是 marks 中的 fontSize
      if (process.env.NODE_ENV === "development") {
        const checkFontSize = (node: any, path: string = ""): void => {
          if (node.type === "text" && node.marks) {
            const fontSizeMark = node.marks.find((m: any) => m.type === "textStyle" && m.attrs?.fontSize)
            if (fontSizeMark) {
              console.log(`[DocumentEditor] Found fontSize at ${path}:`, fontSizeMark.attrs.fontSize)
            }
          }
          if (node.content && Array.isArray(node.content)) {
            node.content.forEach((child: any, idx: number) => {
              checkFontSize(child, `${path}.content[${idx}]`)
            })
          }
        }
        checkFontSize(json, "root")
      }
      
      // 在更新后立即同步行高（延迟执行，避免频繁更新）
      setTimeout(() => {
        const editorElement = editor.view.dom
        const pxToTwips = (px: number) => Math.round(px * 1440 / 96)
        
        const tables = editorElement.querySelectorAll("table")
        tables.forEach((table) => {
          const rows = table.querySelectorAll("tr")
          rows.forEach((row) => {
            const rowEl = row as HTMLElement
            const dataRowHeight = rowEl.getAttribute("data-row-height")
            const styleHeight = rowEl.style.height
            
            if (dataRowHeight || styleHeight) {
              // 如果 DOM 中有行高信息，但节点属性中没有，需要同步
              let rowHeightTwips: number | null = null
              
              if (dataRowHeight) {
                rowHeightTwips = parseFloat(dataRowHeight)
              } else if (styleHeight) {
                const px = parseFloat(styleHeight)
                if (!isNaN(px) && px > 0) {
                  rowHeightTwips = pxToTwips(px)
                }
              }
              
              if (rowHeightTwips !== null && rowHeightTwips >= 10 && rowHeightTwips <= 5000) {
                try {
                  const rowPos = editor.view.posAtDOM(row, 0)
                  if (rowPos !== null && rowPos >= 0) {
                    const $pos = editor.state.doc.resolve(rowPos)
                    let rowNode = $pos.nodeAfter
                    
                    if (!rowNode || rowNode.type.name !== "tableRow") {
                      const parent = $pos.parent
                      if (parent && parent.type.name === "tableRow") {
                        rowNode = parent
                      }
                    }
                    
                    if (rowNode && rowNode.type.name === "tableRow") {
                      const currentRowHeight = rowNode.attrs.rowHeight
                      if (!currentRowHeight || Math.abs(currentRowHeight - rowHeightTwips) > 1) {
                        editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
                          if (node.type.name === "tableRow" && node === rowNode) {
                            const tr = editor.state.tr
                            tr.setNodeMarkup(pos, undefined, {
                              ...node.attrs,
                              rowHeight: rowHeightTwips,
                            })
                            editor.view.dispatch(tr)
                            console.log(`[DocumentEditor] onUpdate - Synced rowHeight for row at pos ${pos}:`, rowHeightTwips, "twips")
                            return false
                          }
                          return true
                        })
                      }
                    }
                  }
                } catch (error) {
                  if (process.env.NODE_ENV === "development") {
                    console.warn("[DocumentEditor] onUpdate - Failed to sync rowHeight:", error)
                  }
                }
              }
            }
          })
        })
      }, 150)
      
      // 调试：检查表格行的行高属性
      if (process.env.NODE_ENV === "development") {
        const checkRowHeights = (node: any, path: string = ""): void => {
          if (node.type === "tableRow") {
            console.log(`[DocumentEditor] Found tableRow at ${path}, rowHeight:`, node.attrs?.rowHeight)
          }
          if (node.content && Array.isArray(node.content)) {
            node.content.forEach((child: any, idx: number) => {
              checkRowHeights(child, `${path}.content[${idx}]`)
            })
          }
        }
        checkRowHeights(json, "root")
      }
      
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

  // 监听表格列宽变化，同步到 JSON
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom
    const pxToTwips = (px: number) => Math.round(px * 1440 / 96)

    // 同步表格列宽的函数
    const syncTableColWidths = () => {
      const tables = editorElement.querySelectorAll("table")
      
      tables.forEach((table) => {
        const colgroup = table.querySelector("colgroup")
        if (colgroup) {
          const cols = colgroup.querySelectorAll("col")
          const colWidths: number[] = []
          
          cols.forEach((col) => {
            const colEl = col as HTMLElement
            const widthStr = colEl.style.width || ""
            const widthValue = parseFloat(widthStr)
            
            if (!isNaN(widthValue) && widthStr.includes("px")) {
              colWidths.push(pxToTwips(widthValue))
            }
          })
          
          // 如果检测到列宽，尝试更新表格节点的 colWidths 属性
          if (colWidths.length > 0) {
            try {
              // 找到表格节点
              const tablePos = editor.view.posAtDOM(table, 0)
              if (tablePos !== null && tablePos >= 0) {
                const $pos = editor.state.doc.resolve(tablePos)
                let tableNode = $pos.nodeAfter
                
                // 如果 nodeAfter 不是表格，尝试向上查找
                if (!tableNode || tableNode.type.name !== "table") {
                  const parent = $pos.parent
                  if (parent && parent.type.name === "table") {
                    tableNode = parent
                  } else {
                    // 尝试从 table 元素向上查找
                    let current = table.parentElement
                    while (current && current !== editorElement) {
                      const pos = editor.view.posAtDOM(current, 0)
                      if (pos !== null && pos >= 0) {
                        const $p = editor.state.doc.resolve(pos)
                        if ($p.nodeAfter?.type.name === "table") {
                          tableNode = $p.nodeAfter
                          break
                        }
                      }
                      current = current.parentElement
                    }
                  }
                }
                
                if (tableNode && tableNode.type.name === "table") {
                  const currentColWidths = tableNode.attrs.colWidths
                  // 检查列宽是否发生变化（允许 1 twips 的误差）
                  const hasChanged = !currentColWidths || 
                    currentColWidths.length !== colWidths.length ||
                    currentColWidths.some((w: number, i: number) => 
                      colWidths[i] !== undefined && Math.abs(w - colWidths[i]) > 1
                    )
                  
                  if (hasChanged) {
                    // 找到表格节点的确切位置
                    editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
                      if (node.type.name === "table" && node === tableNode) {
                        // 使用 setNodeMarkup 更新特定表格节点的属性
                        const tr = editor.state.tr
                        tr.setNodeMarkup(pos, undefined, {
                          ...node.attrs,
                          colWidths: colWidths,
                        })
                        editor.view.dispatch(tr)
                        return false // 停止遍历
                      }
                      return true
                    })
                  }
                }
              }
            } catch (error) {
              // 忽略错误，避免干扰正常编辑
              if (process.env.NODE_ENV === "development") {
                console.warn("[DocumentEditor] Failed to sync table colWidths:", error)
              }
            }
          }
        }
      })
    }

    // 使用 MutationObserver 监听表格列宽变化
    const observer = new MutationObserver((mutations) => {
      let shouldSync = false
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const target = mutation.target as HTMLElement
          if (target.tagName === "COL" || target.closest("colgroup")) {
            shouldSync = true
          }
        } else if (mutation.type === "childList") {
          if (mutation.target instanceof HTMLElement && 
              (mutation.target.tagName === "COLGROUP" || mutation.target.closest("colgroup"))) {
            shouldSync = true
          }
        }
      })
      
      if (shouldSync) {
        // 延迟执行，避免频繁更新
        setTimeout(syncTableColWidths, 100)
      }
    })

    // 监听整个编辑器 DOM 的变化
    observer.observe(editorElement, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true,
    })

    // 也监听鼠标释放事件（列宽调整完成时）
    const handleMouseUp = () => {
      setTimeout(syncTableColWidths, 50)
    }
    editorElement.addEventListener("mouseup", handleMouseUp)

    return () => {
      observer.disconnect()
      editorElement.removeEventListener("mouseup", handleMouseUp)
    }
  }, [editor])

  // 同步表格行高到节点属性
  useEffect(() => {
    if (!editor) return

    const editorElement = editor.view.dom
    const pxToTwips = (px: number) => Math.round(px * 1440 / 96)

    // 同步表格行高的函数
    const syncTableRowHeights = () => {
      const tables = editorElement.querySelectorAll("table")
      
      tables.forEach((table) => {
        const rows = table.querySelectorAll("tr")
        
        rows.forEach((row) => {
          const rowEl = row as HTMLElement
          // 检查是否有 data-row-height 属性或 style.height
          const dataRowHeight = rowEl.getAttribute("data-row-height")
          const styleHeight = rowEl.style.height
          
          let rowHeightTwips: number | null = null
          
          if (dataRowHeight) {
            rowHeightTwips = parseFloat(dataRowHeight)
          } else if (styleHeight) {
            const px = parseFloat(styleHeight)
            if (!isNaN(px) && px > 0) {
              rowHeightTwips = pxToTwips(px)
            }
          }
          
          // 如果检测到行高，尝试更新表格行节点的 rowHeight 属性
          if (rowHeightTwips !== null && rowHeightTwips >= 10 && rowHeightTwips <= 5000) {
            try {
              // 找到表格行节点
              const rowPos = editor.view.posAtDOM(row, 0)
              if (rowPos !== null && rowPos >= 0) {
                const $pos = editor.state.doc.resolve(rowPos)
                let rowNode = $pos.nodeAfter
                
                // 如果 nodeAfter 不是表格行，尝试向上查找
                if (!rowNode || rowNode.type.name !== "tableRow") {
                  const parent = $pos.parent
                  if (parent && parent.type.name === "tableRow") {
                    rowNode = parent
                  }
                }
                
                if (rowNode && rowNode.type.name === "tableRow") {
                  const currentRowHeight = rowNode.attrs.rowHeight
                  // 检查行高是否发生变化（允许 1 twips 的误差）
                  const hasChanged = currentRowHeight !== rowHeightTwips &&
                    (!currentRowHeight || Math.abs(currentRowHeight - rowHeightTwips) > 1)
                  
                  if (hasChanged) {
                    // 找到表格行节点的确切位置
                    editor.state.doc.nodesBetween(0, editor.state.doc.content.size, (node, pos) => {
                      if (node.type.name === "tableRow" && node === rowNode) {
                        // 使用 setNodeMarkup 更新特定表格行节点的属性
                        const tr = editor.state.tr
                        tr.setNodeMarkup(pos, undefined, {
                          ...node.attrs,
                          rowHeight: rowHeightTwips,
                        })
                        editor.view.dispatch(tr)
                        console.log(`[DocumentEditor] Synced rowHeight for row at pos ${pos}:`, rowHeightTwips, "twips")
                        return false // 停止遍历
                      }
                      return true
                    })
                  }
                }
              }
            } catch (error) {
              // 忽略错误，避免干扰正常编辑
              if (process.env.NODE_ENV === "development") {
                console.warn("[DocumentEditor] Failed to sync table rowHeight:", error)
              }
            }
          }
        })
      })
    }

    // 在粘贴后延迟同步行高
    const handlePaste = () => {
      setTimeout(() => {
        syncTableRowHeights()
      }, 200)
    }

    // 监听粘贴事件
    editorElement.addEventListener("paste", handlePaste)

    // 也监听内容更新事件
    const handleUpdate = () => {
      setTimeout(() => {
        syncTableRowHeights()
      }, 100)
    }
    
    // 使用 MutationObserver 监听表格行高变化
    const observer = new MutationObserver((mutations) => {
      let shouldSync = false
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          const target = mutation.target as HTMLElement
          if (target.tagName === "TR" && target.style.height) {
            shouldSync = true
          }
        } else if (mutation.type === "attributes" && mutation.attributeName === "data-row-height") {
          shouldSync = true
        }
      })
      
      if (shouldSync) {
        // 延迟执行，避免频繁更新
        setTimeout(syncTableRowHeights, 100)
      }
    })

    // 监听整个编辑器 DOM 的变化
    observer.observe(editorElement, {
      attributes: true,
      attributeFilter: ["style", "data-row-height"],
      childList: true,
      subtree: true,
    })

    return () => {
      observer.disconnect()
      editorElement.removeEventListener("paste", handlePaste)
    }
  }, [editor])

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
        {/* 工具栏 - 与A4容器宽度对齐，两行布局 */}
        <div className="flex justify-center border-b bg-gray-50">
          <div className="flex flex-col p-2 gap-2" style={{ width: '794px', maxWidth: '100%' }}>
            {/* 第一行：文本格式、字号、标题、对齐、取消和保存 */}
            <div className="flex items-center gap-1.5 justify-evenly">
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
          {/* 取消和保存按钮 */}
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} title="取消" className="whitespace-nowrap">
              <X className="h-4 w-4" />
            </Button>
          )}
          {onSave && (
            <Button 
              size="sm" 
              onClick={onSave} 
              disabled={isSaving || !canSave} 
              title={isSaving ? "保存中..." : canSave ? "保存草稿" : "无变更"} 
              variant={canSave && !isSaving ? "default" : "outline"}
              className={cn(
                "whitespace-nowrap",
                (!canSave || isSaving) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <span className="text-xs">保存中...</span>
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          )}
          {onExport && (
            <Button 
              size="sm" 
              onClick={onExport} 
              disabled={!canExport || isDownloading} 
              title={isDownloading ? "下载中..." : canExport ? "下载文书" : "请先保存变更"} 
              variant={canExport && !isDownloading ? "default" : "outline"}
              className={cn(
                "whitespace-nowrap",
                (!canExport || isDownloading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isDownloading ? (
                <span className="text-xs">下载中...</span>
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          )}
            </div>
            
            {/* 第二行：表格操作按钮 */}
            <div className="flex items-center gap-1.5 justify-evenly">
          {/* 列操作 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 如果不在表格中，先插入一个表格，然后再添加列
              if (!editor.isActive("table")) {
                editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()
              }
              // Tiptap 的 addColumnBefore 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnBefore().run()
            }}
            title="在左侧添加列"
          >
            <div className="flex items-center gap-1.5">
              {/* 垂直矩形，左半部分高亮 */}
              <div className="relative w-3 h-4 border border-gray-400 rounded">
                <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-gray-600 rounded-l" />
              </div>
              <Plus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 如果不在表格中，先插入一个表格，然后再添加列
              if (!editor.isActive("table")) {
                editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()
              }
              // Tiptap 的 addColumnAfter 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnAfter().run()
            }}
            title="在右侧添加列"
          >
            <div className="flex items-center gap-1.5">
              {/* 垂直矩形，右半部分高亮 */}
              <div className="relative w-3 h-4 border border-gray-400 rounded">
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gray-600 rounded-r" />
              </div>
              <Plus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!editor.can().deleteColumn()}
            title="删除列"
          >
            <div className="flex items-center gap-1.5">
              {/* 垂直矩形，无高亮 */}
              <div className="w-3 h-4 border border-gray-400 rounded" />
              <Minus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {/* 行操作 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (editor.isActive("table")) {
                // 如果在表格中，直接在上方添加行
                editor.chain().focus().addRowBefore().run()
              } else {
                // 如果不在表格中，尝试查找下方是否有表格
                // 使用 DOM 方法更可靠
                const editorElement = editor.view.dom
                const currentSelection = window.getSelection()
                const range = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null
                
                if (range) {
                  // 从当前光标位置向下查找表格元素
                  let currentElement: Node | null = range.endContainer
                  
                  // 如果是文本节点，获取其父元素
                  if (currentElement.nodeType === Node.TEXT_NODE) {
                    currentElement = currentElement.parentElement
                  }
                  
                  // 向下查找表格
                  while (currentElement && currentElement !== editorElement) {
                    // 检查当前元素的兄弟节点中是否有表格
                    let sibling = currentElement.nextSibling
                    while (sibling) {
                      if (sibling.nodeType === Node.ELEMENT_NODE) {
                        const element = sibling as Element
                        if (element.tagName === 'TABLE') {
                          // 找到表格，移动到第一个单元格
                          const firstCell = element.querySelector('td, th')
                          if (firstCell) {
                            try {
                              const cellPos = editor.view.posAtDOM(firstCell, 0)
                              if (cellPos !== null && cellPos >= 0) {
                                editor.chain()
                                  .setTextSelection(cellPos + 1)
                                  .focus()
                                  .addRowBefore()
                                  .run()
                                return
                              }
                            } catch (error) {
                              console.error('Error positioning in table:', error)
                            }
                          }
                        }
                      }
                      sibling = sibling.nextSibling
                    }
                    
                    // 向上查找父元素
                    currentElement = currentElement.parentElement
                  }
                }
                
                // 如果没找到表格，插入新表格（insertTable已经创建了一行，不需要再添加行）
                editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()
              }
            }}
            title="在上方添加行"
          >
            <div className="flex items-center gap-1.5">
              {/* 水平矩形，上半部分高亮 */}
              <div className="relative w-4 h-3 border border-gray-400 rounded">
                <div className="absolute left-0 top-0 right-0 h-1/2 bg-gray-600 rounded-t" />
              </div>
              <Plus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (editor.isActive("table")) {
                // 如果在表格中，直接在下方添加行
                // addRowAfter 会自动匹配当前行的列数，创建一个空行（与当前行相同的列数）
                const { state } = editor
                const table = findTable(state.selection)
                if (table) {
                  // 获取当前行的列数
                  const $pos = state.selection.$anchor
                  let currentRow = null
                  let rowColCount = 0
                  
                  // 向上查找当前行
                  for (let depth = $pos.depth; depth >= 0; depth--) {
                    const node = $pos.node(depth)
                    if (node.type.name === 'tableRow') {
                      currentRow = node
                      // 计算行的实际列数（考虑 colspan）
                      rowColCount = 0
                      node.forEach((cell) => {
                        const colspan = cell.attrs?.colspan || 1
                        rowColCount += colspan
                      })
                      break
                    }
                  }
                  
                  // 使用 addRowAfter，它会自动匹配当前行的列数
                  editor.chain().focus().addRowAfter().run()
                } else {
                  editor.chain().focus().addRowAfter().run()
                }
              } else {
                // 如果不在表格中，尝试查找下方是否有表格
                // 使用 DOM 方法更可靠
                const editorElement = editor.view.dom
                const currentSelection = window.getSelection()
                const range = currentSelection?.rangeCount ? currentSelection.getRangeAt(0) : null
                
                if (range) {
                  // 从当前光标位置向下查找表格元素
                  let currentElement: Node | null = range.endContainer
                  
                  // 如果是文本节点，获取其父元素
                  if (currentElement.nodeType === Node.TEXT_NODE) {
                    currentElement = currentElement.parentElement
                  }
                  
                  // 向下查找表格
                  while (currentElement && currentElement !== editorElement) {
                    // 检查当前元素的兄弟节点中是否有表格
                    let sibling = currentElement.nextSibling
                    while (sibling) {
                      if (sibling.nodeType === Node.ELEMENT_NODE) {
                        const element = sibling as Element
                        if (element.tagName === 'TABLE') {
                          // 找到表格，移动到第一个单元格
                          // 在段落下方添加行，应该在表格第一行上方添加（addRowBefore）
                          const firstCell = element.querySelector('td, th')
                          if (firstCell) {
                            try {
                              const cellPos = editor.view.posAtDOM(firstCell, 0)
                              if (cellPos !== null && cellPos >= 0) {
                                editor.chain()
                                  .setTextSelection(cellPos + 1)
                                  .focus()
                                  .addRowBefore()
                                  .run()
                                return
                              }
                            } catch (error) {
                              console.error('Error positioning in table:', error)
                            }
                          }
                        }
                      }
                      sibling = sibling.nextSibling
                    }
                    
                    // 向上查找父元素
                    currentElement = currentElement.parentElement
                  }
                }
                
                // 如果没找到表格，插入新表格（insertTable已经创建了一行，不需要再添加行）
                editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()
              }
            }}
            title="在下方添加行"
          >
            <div className="flex items-center gap-1.5">
              {/* 水平矩形，下半部分高亮 */}
              <div className="relative w-4 h-3 border border-gray-400 rounded">
                <div className="absolute left-0 bottom-0 right-0 h-1/2 bg-gray-600 rounded-b" />
              </div>
              <Plus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!editor.can().deleteRow()}
            title="删除行"
          >
            <div className="flex items-center gap-1.5">
              {/* 水平矩形，无高亮 */}
              <div className="w-4 h-3 border border-gray-400 rounded" />
              <Minus className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {/* 单元格操作 */}
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
          </div>
        </div>

      {/* 编辑器内容 - 带页面容器，与预览模式保持一致 */}
      <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#f5f5f5', minHeight: 0 }} onClick={() => editor?.commands.focus()}>
        <div className="flex justify-center">
          <div className="template-doc-container">
            <EditorContent editor={editor} />
          </div>
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

