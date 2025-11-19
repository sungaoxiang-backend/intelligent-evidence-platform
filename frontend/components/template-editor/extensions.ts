import Paragraph from "@tiptap/extension-paragraph"
import Heading from "@tiptap/extension-heading"
import Table from "@tiptap/extension-table"
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
`

