/**
 * 单元格ID生成工具
 * 基于ProseMirror JSON结构生成稳定的cellId
 */

import type { JSONContent } from "@tiptap/core"

export interface CellInfo {
  /** 单元格的稳定ID */
  cellId: string
  /** 表格索引 */
  tableIndex: number
  /** 行索引 */
  rowIndex: number
  /** 单元格索引 */
  cellIndex: number
  /** 单元格节点 */
  cellNode: JSONContent
  /** 单元格中的占位符列表 */
  placeholders: string[]
}

/**
 * 从单元格节点中提取占位符
 */
function extractPlaceholdersFromCell(cell: JSONContent): string[] {
  const placeholders: string[] = []
  
  const traverse = (node: JSONContent) => {
    if (node.type === "placeholder" && node.attrs?.fieldKey) {
      placeholders.push(node.attrs.fieldKey)
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse)
    }
  }
  
  traverse(cell)
  return placeholders
}

/**
 * 从ProseMirror JSON中提取所有单元格信息，生成稳定的cellId
 * 格式：table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}
 */
export function extractAllCells(content: JSONContent | null): CellInfo[] {
  if (!content) return []
  
  const cells: CellInfo[] = []
  let tableIndex = 0
  
  const traverse = (node: JSONContent, path: number[] = []): void => {
    if (node.type === "table") {
      // 遍历表格行
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((row, rowIdx) => {
          if (row.type === "tableRow") {
            // 遍历行中的单元格
            if (row.content && Array.isArray(row.content)) {
              row.content.forEach((cell, cellIdx) => {
                if (cell.type === "tableCell" || cell.type === "tableHeader") {
                  const placeholders = extractPlaceholdersFromCell(cell)
                  const cellId = `table-${tableIndex}-row-${rowIdx}-cell-${cellIdx}`
                  
                  cells.push({
                    cellId,
                    tableIndex,
                    rowIndex: rowIdx,
                    cellIndex: cellIdx,
                    cellNode: cell,
                    placeholders,
                  })
                }
              })
            }
          }
        })
      }
      tableIndex++
      // 注意：表格节点遍历后不再递归遍历其子节点（因为表格行已经在上面处理了）
      return
    }
    
    // 递归遍历子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        traverse(child, [...path, index])
      })
    }
  }
  
  traverse(content)
  return cells
}

/**
 * 根据cellId查找单元格信息
 */
export function findCellById(cells: CellInfo[], cellId: string): CellInfo | undefined {
  return cells.find(cell => cell.cellId === cellId)
}

/**
 * 根据表格、行、单元格索引查找单元格信息
 */
export function findCellByPosition(
  cells: CellInfo[],
  tableIndex: number,
  rowIndex: number,
  cellIndex: number
): CellInfo | undefined {
  return cells.find(
    cell =>
      cell.tableIndex === tableIndex &&
      cell.rowIndex === rowIndex &&
      cell.cellIndex === cellIndex
  )
}

