import Paragraph from "@tiptap/extension-paragraph"
import Heading from "@tiptap/extension-heading"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import { mergeAttributes } from "@tiptap/core"
import { findTable, isInTable, mergeCells as pmMergeCells, splitCell as pmSplitCell, CellSelection, findCell } from "@tiptap/pm/tables"

type ParagraphSpacing = {
  before?: number | null
  after?: number | null
}

type ParagraphList = {
  type?: "ordered" | "unordered"
  level?: number
}

type ParagraphAttrs = {
  textAlign?: string | null
  indent?: number | null
  firstLineIndent?: number | null
  spacing?: ParagraphSpacing | null
  lineHeight?: number | null
  list?: ParagraphList | null
}

type TableWidthAttr = {
  width?: number | null
  type?: string | null
}

type TableAttrs = {
  colWidths?: number[] | null
  tableWidth?: TableWidthAttr | null
  tableLayout?: string | null
  style?: string | null
}

type CellWidthAttr = {
  width?: number | null
  type?: string | null
}

type TableCellAttrs = {
  backgroundColor?: string | null
  cellWidth?: CellWidthAttr | null
  verticalAlign?: string | null
  textAlign?: string | null
}

type TableRowAttrs = {
  exportEnabled?: boolean | null
}

const PT_TO_PX = 96 / 72
const TWIPS_TO_PX = 96 / 1440

const ptToPx = (value?: number | null) =>
  typeof value === "number" ? `${value * PT_TO_PX}px` : undefined

const twipsToPx = (value?: number | null) =>
  typeof value === "number" ? `${value * TWIPS_TO_PX}px` : undefined

const styleObjectToString = (style: Record<string, string | undefined>) =>
  Object.entries(style)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ")

export const buildParagraphStyle = (attrs: ParagraphAttrs = {}) => {
  const style: Record<string, string | undefined> = {}

  if (attrs?.textAlign) {
    style["text-align"] = attrs.textAlign
  }
  if (attrs?.spacing) {
    if (attrs.spacing.before) {
      style["margin-top"] = ptToPx(attrs.spacing.before)
    }
    if (attrs.spacing.after) {
      style["margin-bottom"] = ptToPx(attrs.spacing.after)
    }
  }
  if (attrs?.indent) {
    style["margin-left"] = ptToPx(attrs.indent)
  }
  if (attrs?.firstLineIndent) {
    style["text-indent"] = ptToPx(attrs.firstLineIndent)
  }
  if (attrs?.lineHeight) {
    if (attrs.lineHeight < 5) {
      style["line-height"] = `${attrs.lineHeight}`
    } else {
      style["line-height"] = ptToPx(attrs.lineHeight)
    }
  }

  if (attrs?.list) {
    const level = attrs.list.level ?? 0
    style["display"] = "list-item"
    style["list-style-type"] =
      attrs.list.type === "ordered" ? "decimal" : "disc"
    const baseIndent = 18 * (level + 1)
    const existing = parseFloat(style["margin-left"] || "0")
    style["margin-left"] = `${existing + baseIndent}px`
  }

  style["white-space"] = "pre-line"

  return styleObjectToString(style)
}

export const buildTableStyle = (attrs: TableAttrs = {}) => {
  const style: Record<string, string | undefined> = {
    "table-layout": attrs?.tableLayout || (attrs?.colWidths ? "fixed" : undefined),
  }

  // 如果存在表格宽度，保留原始宽度（支持水平滚动）
  if (attrs?.tableWidth?.width) {
    const width = twipsToPx(attrs.tableWidth.width)
    style["width"] = width
    // 如果表格宽度超过容器宽度，使用 min-width 确保表格不被压缩
    const widthValue = parseFloat(width || "0")
    if (widthValue > A4_CONTENT_WIDTH) {
      style["min-width"] = width
    }
  }

  return styleObjectToString(style)
}

export const buildCellStyle = (attrs: TableCellAttrs = {}) => {
  const style: Record<string, string | undefined> = {}

  if (attrs?.backgroundColor) {
    style["background-color"] = attrs.backgroundColor
  }

  if (attrs?.cellWidth?.width) {
    style["width"] = twipsToPx(attrs.cellWidth.width)
  }

  // 所有单元格默认垂直居中，除非明确指定其他值
  // 用户要求：所有对齐方式都是垂直居中，水平对齐由 TextAlign 控制
  if (attrs?.verticalAlign) {
    const alignValue =
      attrs.verticalAlign === "center" ? "middle" : attrs.verticalAlign
    style["vertical-align"] = alignValue
  } else {
    // 默认垂直居中
    style["vertical-align"] = "middle"
  }

  // 处理单元格的水平对齐方式
  // 单元格的对齐方式由单元格本身控制，而不是段落
  // 这样可以避免单元格和段落同时存在对齐方式导致的冲突
  if (attrs?.textAlign) {
    style["text-align"] = attrs.textAlign
  }

  return styleObjectToString(style)
}

export const ParagraphWithAttrs = Paragraph.extend({
  addAttributes() {
    return {
      textAlign: {
        default: null,
        parseHTML: (element) => {
          // 关键修复：如果段落在表格单元格内，不要解析段落的对齐方式
          // 单元格的对齐方式应该由单元格本身控制，而不是段落
          // 这样可以避免单元格和段落同时有对齐方式导致的冲突
          let parent = element.parentElement
          while (parent) {
            if (parent.tagName === "TD" || parent.tagName === "TH") {
              // 段落在单元格内，不解析段落的对齐方式，避免冲突
              return null
            }
            parent = parent.parentElement
          }
          // 不在单元格内的段落，正常解析对齐方式
          const align = element.style.textAlign || element.getAttribute("align")
          return align || null
        },
      },
      indent: {
        default: null,
        parseHTML: (element) => {
          const marginLeft = element.style.marginLeft
          if (marginLeft) {
            // 将 px 转换为 pt (假设 96dpi)
            const px = parseFloat(marginLeft)
            return px ? px * 0.75 : null // 1px = 0.75pt (96dpi)
          }
          return null
        },
      },
      firstLineIndent: {
        default: null,
        parseHTML: (element) => {
          const textIndent = element.style.textIndent
          if (textIndent) {
            const px = parseFloat(textIndent)
            return px ? px * 0.75 : null
          }
          return null
        },
      },
      spacing: {
        default: null,
        parseHTML: (element) => {
          const marginTop = element.style.marginTop
          const marginBottom = element.style.marginBottom
          if (marginTop || marginBottom) {
            return {
              before: marginTop ? parseFloat(marginTop) * 0.75 : null,
              after: marginBottom ? parseFloat(marginBottom) * 0.75 : null,
            }
          }
          return null
        },
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => {
          const lineHeight = element.style.lineHeight
          if (lineHeight) {
            let value = parseFloat(lineHeight)
            // 处理百分比
            if (lineHeight.includes("%")) {
              value = value / 100
            }
            // 只保留合理的行高（1.0-1.8 相对值，或 12-25px 绝对值）
            // 忽略 WPS 粘贴时带来的过大行高
            if (value > 0) {
              if (value < 5) {
                // 相对值（如 1.5, 2.0）
                if (value >= 1.0 && value <= 1.8) {
                  return value
                }
              } else {
                // 绝对值（px）
                if (value >= 12 && value <= 25) {
                  return value
                }
              }
            }
          }
          return null
        },
      },
      list: { default: null },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const paragraphAttrs = node.attrs as ParagraphAttrs
    const style = buildParagraphStyle(paragraphAttrs)
    return [
      "p",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        style ? { style } : {}
      ),
      0,
    ]
  },
})

export const HeadingWithAttrs = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: null,
        parseHTML: (element) => {
          const align = element.style.textAlign || element.getAttribute("align")
          return align || null
        },
      },
      indent: {
        default: null,
        parseHTML: (element) => {
          const marginLeft = element.style.marginLeft
          if (marginLeft) {
            const px = parseFloat(marginLeft)
            return px ? px * 0.75 : null
          }
          return null
        },
      },
      spacing: {
        default: null,
        parseHTML: (element) => {
          const marginTop = element.style.marginTop
          const marginBottom = element.style.marginBottom
          if (marginTop || marginBottom) {
            return {
              before: marginTop ? parseFloat(marginTop) * 0.75 : null,
              after: marginBottom ? parseFloat(marginBottom) * 0.75 : null,
            }
          }
          return null
        },
      },
      lineHeight: {
        default: null,
        parseHTML: (element) => {
          const lineHeight = element.style.lineHeight
          if (lineHeight) {
            let value = parseFloat(lineHeight)
            // 处理百分比
            if (lineHeight.includes("%")) {
              value = value / 100
            }
            // 只保留合理的行高（1.0-1.8 相对值，或 12-25px 绝对值）
            // 忽略 WPS 粘贴时带来的过大行高
            if (value > 0) {
              if (value < 5) {
                // 相对值（如 1.5, 2.0）
                if (value >= 1.0 && value <= 1.8) {
                  return value
                }
              } else {
                // 绝对值（px）
                if (value >= 12 && value <= 25) {
                  return value
                }
              }
            }
          }
          return null
        },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const level = hasLevel ? node.attrs.level : this.options.levels[0]
    const tag = `h${level}`
    const headingAttrs = node.attrs as ParagraphAttrs
    
    // 为标题设置默认字号（参考常见标准，比WPS默认稍大）
    // 标题1=22pt, 标题2=18pt, 标题3=16pt
    // 这样即使从WPS复制的大字号内容（如22pt）应用标题后也不会变小
    const defaultFontSizes: Record<number, string> = {
      1: "22pt",
      2: "18pt",
      3: "16pt",
    }
    
    const baseStyle = buildParagraphStyle(headingAttrs)
    const fontSize = defaultFontSizes[level]
    
    // 合并样式，确保标题有字号和加粗（使用 !important 覆盖文本 mark 的 fontSize）
    let finalStyle = baseStyle
    if (fontSize) {
      const styleParts: string[] = []
      if (baseStyle) styleParts.push(baseStyle)
      // 使用内联样式设置字号，但文本 mark 的 fontSize 会覆盖它
      // 所以我们通过 CSS 的 !important 来确保标题字号生效
      styleParts.push(`font-weight: bold`)
      finalStyle = styleParts.join("; ")
    }
    
    return [
      tag,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        finalStyle ? { style: finalStyle } : {}
      ),
      0,
    ]
  },
})

export const TableWithAttrs = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colWidths: {
        default: null,
        parseHTML: (element) => {
          // 从 data-col-widths 属性中读取列宽信息
          const colWidthsStr = element.getAttribute("data-col-widths")
          if (colWidthsStr) {
            try {
              const colWidths = JSON.parse(colWidthsStr)
              if (Array.isArray(colWidths) && colWidths.length > 0) {
                return colWidths
              }
            } catch (e) {
              console.warn("Failed to parse colWidths:", e)
            }
          }
          
          // 如果没有 data 属性，尝试从 colgroup 中提取
          const colgroup = element.querySelector("colgroup")
          if (colgroup) {
            const cols = colgroup.querySelectorAll("col")
            const widths: number[] = []
            cols.forEach((col) => {
              const colEl = col as HTMLElement
              const widthStr = colEl.style.width || colEl.getAttribute("width") || ""
              const widthValue = parseFloat(widthStr)
              
              if (!isNaN(widthValue)) {
                // 转换为 twips
                let twips: number
                if (widthStr.includes("px")) {
                  twips = Math.round(widthValue * 1440 / 96) // 96 DPI
                } else if (widthStr.includes("pt")) {
                  twips = Math.round(widthValue * 20) // 1pt = 20 twips
                } else {
                  // 假设是 px
                  twips = Math.round(widthValue * 1440 / 96)
                }
                widths.push(twips)
              }
            })
            
            if (widths.length > 0) {
              return widths
            }
          }
          
          return null
        },
      },
      tableWidth: {
        default: null,
        parseHTML: (element) => {
          // 从 data-table-width 属性中读取表格宽度
          const tableWidthStr = element.getAttribute("data-table-width")
          if (tableWidthStr) {
            const width = parseFloat(tableWidthStr)
            if (!isNaN(width)) {
              return {
                width: width,
                type: element.getAttribute("data-table-width-type") || "twips",
              }
            }
          }
          
          // 如果没有 data 属性，尝试从 style 中提取
          const tableEl = element as HTMLElement
          if (tableEl.style.width) {
            const widthStr = tableEl.style.width
            const widthValue = parseFloat(widthStr)
            
            if (!isNaN(widthValue)) {
              let twips: number
              if (widthStr.includes("px")) {
                twips = Math.round(widthValue * 1440 / 96) // 96 DPI
              } else if (widthStr.includes("pt")) {
                twips = Math.round(widthValue * 20) // 1pt = 20 twips
              } else if (widthStr.includes("%")) {
                // 处理百分比宽度：基于 A4 内容区域宽度计算
                // A4_CONTENT_WIDTH = 794 - 96*2 = 602px
                const A4_CONTENT_WIDTH = 602
                const actualWidth = (widthValue / 100) * A4_CONTENT_WIDTH
                twips = Math.round(actualWidth * 1440 / 96)
              } else {
                // 假设是 px
                twips = Math.round(widthValue * 1440 / 96)
              }
              
              return {
                width: twips,
                type: "twips",
              }
            }
          }
          
          return null
        },
      },
      tableLayout: { default: null },
      style: { default: null },
    }
  },

  addCommands() {
    const parentCommands = this.parent?.() || {}
    
    // 检查父命令是否已经有 mergeCells 和 splitCell
    const hasMergeCells = parentCommands.mergeCells !== undefined
    const hasSplitCell = parentCommands.splitCell !== undefined
    
    return {
      ...parentCommands,
      insertCellAbove: () => ({ tr, state, dispatch }) => {
        if (!isInTable(state)) return false
        
        const table = findTable(state.selection)
        if (!table) return false

        // 在当前位置上方插入新行
        const addRowBefore = parentCommands.addRowBefore
        if (addRowBefore) {
          return addRowBefore()({ tr, state, dispatch })
        }
        return false
      },

      insertCellBelow: () => ({ tr, state, dispatch }) => {
        if (!isInTable(state)) return false
        
        // 在当前位置下方插入新行
        const addRowAfter = parentCommands.addRowAfter
        if (addRowAfter) {
          return addRowAfter()({ tr, state, dispatch })
        }
        return false
      },

      deleteCell: () => ({ tr, state, dispatch }) => {
        if (!isInTable(state)) return false
        
        const { selection } = state
        const table = findTable(state.selection)
        if (!table) return false

        // 找到当前单元格
        let cellPos = -1
        let cellNode = null
        
        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
            if (selection.from >= pos && selection.from <= pos + node.nodeSize) {
              cellPos = pos
              cellNode = node
            }
          }
        })

        if (cellPos === -1 || !cellNode) return false

        // 检查是否是合并单元格
        const colspan = cellNode.attrs.colspan || 1
        const rowspan = cellNode.attrs.rowspan || 1

        if (colspan > 1 || rowspan > 1) {
          // 如果是合并单元格，先拆分
          // 这里简化处理：直接删除整行
          const deleteRow = parentCommands.deleteRow
          if (deleteRow) {
            return deleteRow()({ tr, state, dispatch })
          }
          return false
        }

        // 删除单元格：实际上删除整行更简单
        // 但根据需求，我们应该只删除单元格
        // 由于 Tiptap 的限制，我们使用删除行作为临时方案
        const deleteRow = parentCommands.deleteRow
        if (deleteRow) {
          return deleteRow()({ tr, state, dispatch })
        }
        return false
      },

      mergeCells: hasMergeCells ? parentCommands.mergeCells : () => ({ tr, state, dispatch }) => {
        if (!isInTable(state)) return false
        
        const { selection } = state
        
        // 检查是否是单元格选择（CellSelection）
        if (selection instanceof CellSelection) {
          // 使用 Tiptap 内置的 mergeCells 函数
          if (dispatch) {
            try {
              // pmMergeCells 的签名: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
              const result = pmMergeCells(state, dispatch ? (tr) => dispatch(tr) : undefined)
              return result
            } catch (error) {
              console.error("合并单元格失败:", error)
              return false
            }
          }
          // 检查是否可以合并（至少选中2个单元格）
          return selection.ranges && selection.ranges.length >= 2
        }

        // 如果不是 CellSelection，无法合并
        // 用户需要先通过拖拽或 Shift+点击选中多个单元格
        return false
      },

      splitCell: hasSplitCell ? parentCommands.splitCell : () => ({ tr, state, dispatch }) => {
        if (!isInTable(state)) return false
        
        const { selection } = state
        
        // 找到当前单元格位置
        const cell = findCell(selection.$anchor)
        if (!cell) return false

        const cellNode = cell.node
        const colspan = cellNode.attrs.colspan || 1
        const rowspan = cellNode.attrs.rowspan || 1

        if (colspan === 1 && rowspan === 1) {
          // 不是合并单元格，无法拆分
          return false
        }

        // 使用 Tiptap 内置的 splitCell 函数
        // splitCell 的签名: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean
        // 它会自动从 selection 中获取单元格位置
        if (dispatch) {
          try {
            const result = pmSplitCell(state, dispatch ? (tr) => dispatch(tr) : undefined)
            return result
          } catch (error) {
            console.error("拆分单元格失败:", error)
            return false
          }
        }

        return true
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = (node.attrs || {}) as TableAttrs
    const colWidths: number[] | null = attrs.colWidths
    
    // 检查是否有 style 属性包含百分比宽度，但 tableWidth 不正确
    // 如果 tableWidth 太小（可能是之前保存时的错误），尝试从 style 中提取正确的宽度
    let correctedTableWidth = attrs.tableWidth
    if (attrs.style && attrs.tableWidth) {
      const styleStr = attrs.style
      const widthMatch = styleStr.match(/width:\s*([\d.]+)%/)
      if (widthMatch) {
        const percentage = parseFloat(widthMatch[1])
        const A4_CONTENT_WIDTH = 602 // 与 extensions.ts 中的值保持一致
        const expectedWidth = (percentage / 100) * A4_CONTENT_WIDTH
        const expectedTwips = Math.round(expectedWidth * 1440 / 96)
        
        // 如果 tableWidth 明显小于预期（差异超过 10%），使用从 style 计算的值
        const currentTwips = attrs.tableWidth.width
        if (currentTwips && expectedTwips > currentTwips * 1.1) {
          console.warn(`[TableWithAttrs] 检测到表格宽度不一致，从 style 中提取: ${currentTwips} twips -> ${expectedTwips} twips`)
          correctedTableWidth = {
            width: expectedTwips,
            type: "twips",
          }
        }
      }
    }
    
    // 使用修正后的 tableWidth 构建样式
    const correctedAttrs = { ...attrs, tableWidth: correctedTableWidth }
    const style = buildTableStyle(correctedAttrs)

    // 确保 colWidths 是数组且不为空
    const colgroup =
      Array.isArray(colWidths) && colWidths.length > 0
        ? [
            "colgroup",
            {},
            ...colWidths.map((width) => [
              "col",
              { style: `width: ${twipsToPx(width)}` },
            ]),
          ]
        : null

    const children = colgroup ? [colgroup, ["tbody", 0]] : [["tbody", 0]]

    return [
      "table",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        style ? { style } : {}
      ),
      ...children,
    ]
  },
})

export const TableRowWithAttrs = TableRow.extend<{ isComplexForm?: boolean }>({
  addOptions() {
    return {
      ...this.parent?.(),
      isComplexForm: false,
    }
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      exportEnabled: { default: true },
    }
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      console.log("TableRowWithAttrs: addNodeView called", { node, getPos, editor: !!editor })
      
      const dom = document.createElement("tr")
      dom.setAttribute("data-type", "tableRow")
      
      // 获取exportEnabled状态
      const exportEnabled = node.attrs.exportEnabled !== false
      console.log("TableRowWithAttrs: exportEnabled", exportEnabled)
      
      // 检查是否是复杂表单，如果是则禁用checkbox
      const isComplexForm = this.options.isComplexForm || false
      
      // 创建checkbox容器（作为第一个单元格，仅在非复杂表单时显示）
      const checkboxCell = document.createElement("td")
      checkboxCell.className = "export-control-checkbox-cell"
      checkboxCell.setAttribute("data-export-control", "true")
      if (isComplexForm) {
        checkboxCell.style.display = "none"
      }
      // 使用较小的宽度，减少占据空间
      checkboxCell.style.cssText = "width: 24px !important; min-width: 24px !important; max-width: 24px !important; padding: 0 !important; vertical-align: middle !important; text-align: center !important; border-right: 1px solid #e5e7eb !important; box-sizing: border-box !important; display: table-cell !important; visibility: visible !important; opacity: 1 !important;"
      
      // 创建checkbox包装器（用于自定义样式）
      const checkboxWrapper = document.createElement("label")
      checkboxWrapper.className = "custom-checkbox-wrapper"
      checkboxWrapper.style.cssText = "display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important; cursor: pointer !important; min-height: 40px !important;"
      
      // 创建checkbox
      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.checked = exportEnabled
      checkbox.className = "custom-checkbox"
      checkbox.style.cssText = "cursor: pointer !important; width: 18px !important; height: 18px !important; margin: 0 !important; display: none !important;"
      checkbox.title = "包含在导出中"
      checkbox.setAttribute("data-export-checkbox", "true")
      
      // 创建自定义checkbox外观
      const checkboxVisual = document.createElement("span")
      checkboxVisual.className = "custom-checkbox-visual"
      checkboxVisual.style.cssText = `
        display: inline-block !important;
        width: 18px !important;
        height: 18px !important;
        border: 2px solid #9ca3af !important;
        border-radius: 3px !important;
        background-color: ${exportEnabled ? '#3b82f6' : '#ffffff'} !important;
        position: relative !important;
        transition: all 0.2s ease !important;
        flex-shrink: 0 !important;
      `
      
      // 如果已选中，添加对号
      if (exportEnabled) {
        const checkmark = document.createElement("span")
        checkmark.style.cssText = `
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          transform: translate(-50%, -60%) rotate(45deg) !important;
          width: 4px !important;
          height: 10px !important;
          border: solid white !important;
          border-width: 0 2px 2px 0 !important;
        `
        checkboxVisual.appendChild(checkmark)
      }
      
      checkboxWrapper.appendChild(checkbox)
      checkboxWrapper.appendChild(checkboxVisual)
      
      console.log("TableRowWithAttrs: checkbox created", { checked: checkbox.checked })
      
      // 更新checkbox视觉状态
      const updateCheckboxVisual = (checked: boolean) => {
        if (checked) {
          checkboxVisual.style.backgroundColor = '#3b82f6'
          checkboxVisual.style.borderColor = '#3b82f6'
          // 如果还没有对号，添加对号
          if (!checkboxVisual.querySelector('span')) {
            const checkmark = document.createElement("span")
            checkmark.style.cssText = `
              position: absolute !important;
              left: 50% !important;
              top: 50% !important;
              transform: translate(-50%, -60%) rotate(45deg) !important;
              width: 4px !important;
              height: 10px !important;
              border: solid white !important;
              border-width: 0 2px 2px 0 !important;
            `
            checkboxVisual.appendChild(checkmark)
          }
        } else {
          checkboxVisual.style.backgroundColor = '#ffffff'
          checkboxVisual.style.borderColor = '#9ca3af'
          // 移除对号
          const checkmark = checkboxVisual.querySelector('span')
          if (checkmark) {
            checkmark.remove()
          }
        }
      }
      
      // 处理checkbox变化
      checkbox.addEventListener("change", (e) => {
        const newValue = (e.target as HTMLInputElement).checked
        updateCheckboxVisual(newValue)
        const pos = getPos?.()
        
        if (pos !== undefined && editor) {
          const isEditable = editor.isEditable
          
          if (isEditable) {
            // 可编辑模式：使用命令更新
            editor.commands.command(({ tr, dispatch }) => {
              if (dispatch) {
                const nodePos = tr.doc.resolve(pos)
                const rowNode = nodePos.nodeAfter || nodePos.nodeBefore
                if (rowNode && rowNode.type.name === "tableRow") {
                  tr.setNodeMarkup(pos, undefined, {
                    ...rowNode.attrs,
                    exportEnabled: newValue,
                  })
                }
              }
              return true
            })
          } else {
            // 只读模式：通过DOM找到行在表格中的位置，然后更新JSON
            try {
              const currentJson = editor.getJSON()
              
              // 通过DOM找到当前行在表格中的索引
              const rowElement = dom.closest('tr')
              if (rowElement) {
                const table = rowElement.closest('table')
                if (table) {
                  // 找到这个表格在文档中的位置
                  const allTables = Array.from(document.querySelectorAll('.template-doc table'))
                  const tableIndex = allTables.indexOf(table)
                  
                  // 找到这个行在当前表格中的索引（排除checkbox单元格）
                  const rows = Array.from(table.querySelectorAll('tr'))
                  const rowIndex = rows.indexOf(rowElement)
                  
                  // 遍历JSON找到对应的表格和行
                  let currentTableIndex = 0
                  let currentRowIndex = 0
                  
                  const updateRowInJson = (json: any): any => {
                    if (json.type === "table") {
                      if (currentTableIndex === tableIndex) {
                        // 这是目标表格
                        currentRowIndex = 0
                        if (json.content && Array.isArray(json.content)) {
                          return {
                            ...json,
                            content: json.content.map((row: any, rowIdx: number) => {
                              if (row.type === "tableRow") {
                                if (currentRowIndex === rowIndex) {
                                  // 这是目标行
                                  currentRowIndex++
                                  return {
                                    ...row,
                                    attrs: {
                                      ...row.attrs,
                                      exportEnabled: newValue,
                                    },
                                  }
                                }
                                currentRowIndex++
                              }
                              return row
                            }),
                          }
                        }
                      }
                      currentTableIndex++
                    }
                    
                    if (json.content && Array.isArray(json.content)) {
                      return {
                        ...json,
                        content: json.content.map(updateRowInJson),
                      }
                    }
                    
                    return json
                  }
                  
                  const updatedJson = updateRowInJson(currentJson)
                  // 更新编辑器内容，这会触发update事件，进而触发onContentChange
                  // 在只读模式下，使用setContent仍然可以工作
                  editor.commands.setContent(updatedJson, false, { emitUpdate: true })
                  return
                }
              }
              
              // 如果无法通过DOM找到，尝试使用位置信息
              console.warn("Could not find row in DOM, falling back to position-based update")
            } catch (error) {
              console.error("Error updating row export enabled in read-only mode:", error)
            }
          }
        }
      })
      
      checkboxCell.appendChild(checkboxWrapper)
      
      // 将checkbox单元格插入到行的最前面
      dom.appendChild(checkboxCell)
      console.log("TableRowWithAttrs: checkbox cell appended to dom", { 
        domChildren: dom.children.length,
        firstChild: dom.firstChild === checkboxCell 
      })
      
      // 创建一个容器来存放TipTap的单元格
      // 我们不使用contentDOM，而是手动管理单元格的插入
      const cellsContainer = document.createElement("tbody")
      cellsContainer.style.display = "contents" // 让容器不影响布局
      
      // 使用MutationObserver来确保checkbox始终在最前面
      // TipTap会在contentDOM中插入表格单元格，我们需要确保checkbox始终是第一个
      const observer = new MutationObserver((mutations) => {
        // 检查是否有新的单元格被添加
        const hasNewCells = mutations.some(m => 
          m.addedNodes.length > 0 && 
          Array.from(m.addedNodes).some((n: any) => n.tagName === 'TD' || n.tagName === 'TH')
        )
        
        if (hasNewCells || dom.firstChild !== checkboxCell) {
          // 确保checkbox始终在最前面
          if (checkboxCell.parentNode === dom && dom.firstChild !== checkboxCell) {
            console.log("TableRowWithAttrs: Moving checkbox to front")
            dom.insertBefore(checkboxCell, dom.firstChild)
          }
        }
      })
      
      // 立即检查并启动observer
      const ensureCheckboxFirst = () => {
        if (checkboxCell.parentNode === dom && dom.firstChild !== checkboxCell) {
          console.log("TableRowWithAttrs: Ensuring checkbox is first")
          dom.insertBefore(checkboxCell, dom.firstChild)
        }
      }
      
      // 延迟启动observer，等待TipTap完成初始渲染
      setTimeout(() => {
        observer.observe(dom, { 
          childList: true, 
          subtree: false 
        })
        ensureCheckboxFirst()
        console.log("TableRowWithAttrs: Observer started", {
          domChildren: dom.children.length,
          checkboxVisible: checkboxCell.offsetParent !== null
        })
      }, 0)
      
      // 也立即检查一次
      ensureCheckboxFirst()
      
      return {
        dom,
        contentDOM: dom, // TipTap会在dom中插入单元格
        destroy: () => {
          console.log("TableRowWithAttrs: destroy called")
          observer.disconnect()
        },
        update: (updatedNode) => {
          console.log("TableRowWithAttrs: update called", { 
            exportEnabled: updatedNode.attrs.exportEnabled 
          })
          // 更新checkbox状态
          const updatedExportEnabled = updatedNode.attrs.exportEnabled !== false
          if (checkbox.checked !== updatedExportEnabled) {
            checkbox.checked = updatedExportEnabled
            updateCheckboxVisual(updatedExportEnabled)
          }
          // 确保checkbox始终在最前面
          ensureCheckboxFirst()
          return true
        },
      }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as TableRowAttrs
    // 将exportEnabled作为data属性存储，但不影响渲染
    const dataAttrs: Record<string, string> = {}
    if (attrs.exportEnabled !== undefined && attrs.exportEnabled !== null) {
      dataAttrs["data-export-enabled"] = String(attrs.exportEnabled)
    }
    return [
      "tr",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        dataAttrs
      ),
      0,
    ]
  },
})

export const TableCellWithAttrs = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: { default: null },
      cellWidth: { default: null },
      verticalAlign: { default: null },
      textAlign: {
        default: null,
        parseHTML: (element) => {
          // 从粘贴的 HTML 中提取单元格的对齐方式
          // 支持从 element.style.textAlign 和 element.getAttribute("align") 中提取
          // 确保只解析单元格本身的对齐方式，不解析单元格内段落的对齐方式
          const align = element.style.textAlign || element.getAttribute("align")
          // 只返回有效的对齐值（left, center, right, justify）
          if (align && ["left", "center", "right", "justify"].includes(align.toLowerCase())) {
            return align.toLowerCase()
          }
          return null
        },
      },
      colspan: {
        default: 1,
        parseHTML: (element) => {
          const colspan = element.getAttribute("colspan")
          return colspan ? parseInt(colspan, 10) : 1
        },
        renderHTML: (attributes) => {
          if (!attributes.colspan || attributes.colspan === 1) {
            return {}
          }
          return {
            colspan: attributes.colspan,
          }
        },
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => {
          const rowspan = element.getAttribute("rowspan")
          return rowspan ? parseInt(rowspan, 10) : 1
        },
        renderHTML: (attributes) => {
          if (!attributes.rowspan || attributes.rowspan === 1) {
            return {}
          }
          return {
            rowspan: attributes.rowspan,
          }
        },
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as TableCellAttrs & { colspan?: number; rowspan?: number }
    const style = buildCellStyle(attrs)
    
    // 合并 colspan 和 rowspan 属性
    const cellAttrs: Record<string, any> = {}
    if (attrs.colspan && attrs.colspan > 1) {
      cellAttrs.colspan = attrs.colspan
    }
    if (attrs.rowspan && attrs.rowspan > 1) {
      cellAttrs.rowspan = attrs.rowspan
    }
    
    return [
      node.attrs.isHeader ? "th" : "td",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        cellAttrs,
        style ? { style } : {}
      ),
      0,
    ]
  },
})

// A4 页面尺寸常量（96 DPI，标准屏幕分辨率）
export const A4_PAGE_WIDTH = 794 // A4 宽度 210mm = 794px (96 DPI)
export const A4_PAGE_HEIGHT = 1123 // A4 高度 297mm = 1123px (96 DPI)
export const A4_PAGE_MARGIN = 96 // 标准页边距 25.4mm = 96px (96 DPI)
export const A4_CONTENT_WIDTH = A4_PAGE_WIDTH - (A4_PAGE_MARGIN * 2) // 内容区域宽度

export const templateBaseStyles = `
  /* 页面容器样式 - 模拟 A4 纸张 */
  .template-doc-container {
    width: ${A4_PAGE_WIDTH}px;
    min-height: ${A4_PAGE_HEIGHT}px;
    margin: 0 auto;
    background: white;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    padding: ${A4_PAGE_MARGIN}px;
    box-sizing: border-box;
    position: relative;
    pointer-events: auto;
    /* 允许表格超出容器宽度时使用水平滚动 */
    overflow-x: auto;
    overflow-y: visible;
  }
  
  .template-doc {
    font-family: "SimSun", "宋体", serif;
    /* 移除默认字体大小，让内联样式（来自 textStyle mark 的 fontSize）生效 */
    /* 如果没有内联样式，浏览器会使用默认字体大小 */
    /* font-size: 14px; */
    line-height: 1.5;
    color: #0f172a;
    width: ${A4_CONTENT_WIDTH}px;
    max-width: 100%;
    margin: 0 auto;
    position: relative;
    min-height: 100%;
  }
  
  /* 统一段落和标题的行高，避免 WPS 粘贴带来的过大行高 */
  .template-doc p {
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  /* 标题样式 - 参考常见标准（比WPS默认稍大，避免从WPS复制的大字号内容变小） */
  /* 常见约定：
   * - H1: 22-24pt（二号/小二号），用于文档主标题
   * - H2: 18-20pt（小三号），用于章节标题
   * - H3: 16-18pt（四号），用于小节标题
   * 普通文本通常是 12-14pt，标题应该明显更大
   */
  .template-doc h1 {
    font-size: 22pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h2 {
    font-size: 18pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h3 {
    font-size: 16pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  .template-doc h4,
  .template-doc h5,
  .template-doc h6 {
    font-size: 14pt !important;
    font-weight: bold !important;
    line-height: 1.5 !important;
    margin: 0.5em 0 !important;
  }
  
  /* 确保编辑器内容可交互 */
  .template-doc [contenteditable="true"],
  .template-doc [contenteditable="true"] * {
    cursor: text;
  }
  
  .template-doc [contenteditable="true"]:focus {
    outline: none;
  }
  
  /* 确保 ProseMirror 编辑器可以正常交互 */
  .template-doc .ProseMirror {
    outline: none;
    cursor: text;
    min-height: 200px;
  }
  
  .template-doc .ProseMirror:focus {
    outline: none;
  }
  
  .template-doc .ProseMirror p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #adb5bd;
    pointer-events: none;
    height: 0;
  }
  .template-doc table {
    /* 移除默认 width: 100%，让内联样式（来自 tableWidth 属性）生效 */
    /* width: 100%; */
    border-collapse: collapse;
    margin: 16px 0;
    /* 移除默认 table-layout: auto，让内联样式（来自 colWidths 属性）生效 */
    /* table-layout: auto; */
    /* 允许表格超出容器宽度时使用水平滚动 */
    min-width: fit-content;
  }
  /* 移除这个规则，它会覆盖内联样式中的 width */
  /* 如果表格有固定宽度，应该通过内联样式控制，而不是 CSS !important */
  /* .template-doc table[style*="width"] {
    width: auto !important;
  } */
  .template-doc td,
  .template-doc th {
    border: 1px solid #d4d4d8;
    padding: 8px;
    /* 所有单元格默认垂直居中 */
    vertical-align: middle;
    box-sizing: border-box;
    word-wrap: break-word;
    overflow-wrap: break-word;
    /* 移除强制左对齐，水平对齐由 TextAlign 扩展通过内联样式控制 */
    /* 统一表格字体，避免因字体导致的布局问题 */
    font-family: "SimSun", "宋体", serif;
    /* 移除默认字体大小，让内联样式（来自 textStyle mark 的 fontSize）生效 */
    /* font-size: 14px; */
  }
  
  /* 确保单元格内的段落不会继承单元格的对齐方式，避免冲突 */
  .template-doc td p,
  .template-doc th p,
  .template-doc td div,
  .template-doc th div {
    /* 段落的对齐方式由段落本身的 textAlign 属性控制，不继承单元格 */
    text-align: inherit;
  }
  .template-doc ul,
  .template-doc ol {
    padding-left: 20px;
  }
  .template-doc .template-placeholder-chip {
    display: inline-flex;
    align-items: center;
    padding: 0 4px;
    border-radius: 4px;
    background-color: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #1d4ed8;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  .template-doc .template-placeholder-chip--selected,
  .template-doc .template-placeholder-chip:hover {
    background-color: rgba(59, 130, 246, 0.3);
    border-color: rgba(37, 99, 235, 0.8);
  }
  .template-doc .template-placeholder-chip--highlighted {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  }
  /* 只在光标位于占位符后面时显示光标指示器 */
  .template-doc .template-placeholder-chip--cursor-after::after {
    content: "";
    display: inline-block;
    width: 1px;
    min-width: 1px;
    height: 1.2em;
    vertical-align: baseline;
    margin-left: 2px;
    background-color: currentColor;
    opacity: 0.6;
    animation: blink-cursor 1s infinite;
  }
  @keyframes blink-cursor {
    0%, 50% { opacity: 0.6; }
    51%, 100% { opacity: 0; }
  }
  /* 当编辑器失去焦点时，隐藏光标动画 */
  .template-doc:not(:focus-within) .template-placeholder-chip--cursor-after::after {
    animation: none;
    opacity: 0;
  }
  
  /* ============================================
     新增：轻量化占位符样式
     用于编辑模式，仅提供视觉高亮，不阻断编辑
     ============================================ */
  
  /* 编辑模式：轻量高亮（占位符是可编辑文本） */
  .template-doc .placeholder-highlight {
    background-color: #fef3c7;
    border-radius: 3px;
    padding: 1px 3px;
    color: #92400e;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.95em;
    transition: background-color 0.15s ease;
  }
  
  .template-doc .placeholder-highlight:hover {
    background-color: #fde68a;
  }
  
  /* 预览模式：chip 样式（通过伪元素渲染内容） */
  .template-doc .placeholder-chip-preview {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px 8px;
    margin: 0 2px;
    border-radius: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    cursor: pointer;
    user-select: none;
    font-size: 0;
    color: transparent;
    line-height: 1.5;
    white-space: nowrap;
  }

  .template-doc .placeholder-chip-preview::after {
    content: attr(data-placeholder-display);
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .template-doc .placeholder-chip-preview:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    background: linear-gradient(135deg, #5a67d8 0%, #6b3fa0 100%);
  }

  .template-doc .placeholder-chip-preview:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

`

