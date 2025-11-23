"use client"

import type { JSONContent } from "@tiptap/core"

/**
 * 识别单元格中的占位符
 */
export function extractPlaceholdersFromCell(cell: JSONContent): string[] {
  const placeholders: string[] = []
  
  const traverse = (node: JSONContent) => {
    if (node.type === "placeholder") {
      const fieldKey = (node.attrs as any)?.fieldKey
      if (fieldKey) {
        placeholders.push(fieldKey)
      }
    }
    
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(child => traverse(child))
    }
  }
  
  traverse(cell)
  return placeholders
}

/**
 * 识别可复制的单元格
 * 可复制的单元格：包含多个占位符的 tableCell
 */
export interface ReplicableCellInfo {
  /** 单元格在表格中的路径 */
  path: number[]
  /** 单元格中的占位符列表 */
  placeholders: string[]
  /** 单元格的完整 JSON 结构 */
  cellNode: JSONContent
  /** 单元格所在的行索引 */
  rowIndex: number
  /** 单元格在行中的索引 */
  cellIndex: number
}

/**
 * 从 ProseMirror JSON 中识别所有可复制的单元格
 */
export function identifyReplicableCells(content: JSONContent | null): ReplicableCellInfo[] {
  if (!content) return []
  
  const replicableCells: ReplicableCellInfo[] = []
  
  const traverse = (
    node: JSONContent,
    path: number[] = [],
    rowIndex: number = -1,
    cellIndex: number = -1
  ) => {
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
                  // 如果单元格包含多个占位符，标记为可复制
                  if (placeholders.length > 1) {
                    replicableCells.push({
                      path: [...path, rowIdx, cellIdx],
                      placeholders,
                      cellNode: cell,
                      rowIndex: rowIdx,
                      cellIndex: cellIdx,
                    })
                  }
                }
              })
            }
          }
        })
      }
    }
    
    // 递归遍历子节点
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        traverse(child, [...path, index], rowIndex, cellIndex)
      })
    }
  }
  
  traverse(content)
  return replicableCells
}

/**
 * 生成数组格式的字段名
 */
export function getArrayFieldName(fieldName: string, index: number): string {
  return `${fieldName}[${index}]`
}

/**
 * 从数组格式的字段名中提取原始字段名和索引
 */
export function parseArrayFieldName(fieldName: string): { baseName: string; index: number } | null {
  const match = fieldName.match(/^(.+)\[(\d+)\]$/)
  if (match) {
    return {
      baseName: match[1],
      index: parseInt(match[2], 10),
    }
  }
  return null
}

/**
 * 检查字段名是否为数组格式
 */
export function isArrayFieldName(fieldName: string): boolean {
  return /^.+\[\d+\]$/.test(fieldName)
}

