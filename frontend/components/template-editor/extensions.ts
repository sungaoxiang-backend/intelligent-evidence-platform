import Paragraph from "@tiptap/extension-paragraph"
import Heading from "@tiptap/extension-heading"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import { mergeAttributes } from "@tiptap/core"

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
}

type CellWidthAttr = {
  width?: number | null
  type?: string | null
}

type TableCellAttrs = {
  backgroundColor?: string | null
  cellWidth?: CellWidthAttr | null
  verticalAlign?: string | null
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

  if (attrs?.tableWidth?.width) {
    style["width"] = twipsToPx(attrs.tableWidth.width)
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

  if (attrs?.verticalAlign) {
    const alignValue =
      attrs.verticalAlign === "center" ? "middle" : attrs.verticalAlign
    style["vertical-align"] = alignValue
  }

  return styleObjectToString(style)
}

export const ParagraphWithAttrs = Paragraph.extend({
  addAttributes() {
    return {
      textAlign: { default: null },
      indent: { default: null },
      firstLineIndent: { default: null },
      spacing: { default: null },
      lineHeight: { default: null },
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
      textAlign: { default: null },
      indent: { default: null },
      spacing: { default: null },
      lineHeight: { default: null },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level)
    const tag = hasLevel ? `h${node.attrs.level}` : this.options.levels[0]
    const headingAttrs = node.attrs as ParagraphAttrs
    const style = buildParagraphStyle(headingAttrs)
    return [
      tag,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        style ? { style } : {}
      ),
      0,
    ]
  },
})

export const TableWithAttrs = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colWidths: { default: null },
      tableWidth: { default: null },
      tableLayout: { default: null },
      style: { default: null },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = (node.attrs || {}) as TableAttrs
    const style = buildTableStyle(attrs)
    const colWidths: number[] | null = attrs.colWidths

    const colgroup =
      colWidths && colWidths.length
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

export const TableRowWithAttrs = TableRow.extend({
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
      
      // 创建checkbox容器（作为第一个单元格）
      const checkboxCell = document.createElement("td")
      checkboxCell.className = "export-control-checkbox-cell"
      checkboxCell.setAttribute("data-export-control", "true")
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
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as TableCellAttrs
    const style = buildCellStyle(attrs)
    return [
      node.attrs.isHeader ? "th" : "td",
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        style ? { style } : {}
      ),
      0,
    ]
  },
})

export const templateBaseStyles = `
  .template-doc {
    font-family: "SimSun", "宋体", serif;
    font-size: 14px;
    line-height: 1.6;
    color: #0f172a;
  }
  .template-doc table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }
  .template-doc td,
  .template-doc th {
    border: 1px solid #d4d4d8;
    padding: 8px;
    vertical-align: top;
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

