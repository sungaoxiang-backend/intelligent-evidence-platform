"use client"

import React, { useMemo, useCallback } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { JSONContent } from "@tiptap/core"

export interface TableRowInfo {
  /** 行在文档中的路径（用于定位） */
  path: number[]
  /** 行的唯一标识符 */
  id: string
  /** 行的exportEnabled状态 */
  exportEnabled: boolean
  /** 行的预览文本（从第一个单元格提取） */
  previewText: string
  /** 表格索引（第几个表格） */
  tableIndex: number
  /** 行在表格中的索引 */
  rowIndex: number
}

/**
 * 从ProseMirror JSON中提取所有表格行信息
 */
export function extractTableRows(content: JSONContent | null): TableRowInfo[] {
  if (!content) return []
  
  const rows: TableRowInfo[] = []
  let tableIndex = 0
  
  const traverse = (node: JSONContent, path: number[] = []): void => {
    if (node.type === "table") {
      // 表格的路径就是当前path
      const tablePath = [...path]
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach((row, rowIdx) => {
          if (row.type === "tableRow") {
            // 提取行的预览文本（从第一个单元格）
            let previewText = ""
            if (row.content && Array.isArray(row.content) && row.content.length > 0) {
              const firstCell = row.content[0]
              previewText = extractTextFromNode(firstCell).trim()
              if (previewText.length > 50) {
                previewText = previewText.substring(0, 50) + "..."
              }
            }
            
            // 获取exportEnabled状态（默认为true）
            const exportEnabled = row.attrs?.exportEnabled !== false
            
            // 行的路径是表格路径 + 行在表格中的索引
            rows.push({
              path: [...tablePath, rowIdx],
              id: `table-${tableIndex}-row-${rowIdx}`,
              exportEnabled,
              previewText: previewText || `表格 ${tableIndex + 1} - 行 ${rowIdx + 1}`,
              tableIndex,
              rowIndex: rowIdx,
            })
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
  return rows
}

/**
 * 从节点中提取文本内容
 */
function extractTextFromNode(node: JSONContent): string {
  if (!node) return ""
  
  if (node.type === "text") {
    return node.text || ""
  }
  
  if (node.type === "placeholder") {
    return `{{${node.attrs?.fieldKey || ""}}}`
  }
  
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join("")
  }
  
  return ""
}

/**
 * 根据路径更新ProseMirror JSON中表格行的exportEnabled属性
 */
export function updateRowExportEnabled(
  content: JSONContent,
  path: number[],
  enabled: boolean
): JSONContent {
  const newContent = JSON.parse(JSON.stringify(content)) as JSONContent
  
  const navigateToPath = (node: JSONContent, currentPath: number[], targetPath: number[]): JSONContent | null => {
    if (currentPath.length === targetPath.length) {
      return node
    }
    
    const nextIndex = targetPath[currentPath.length]
    if (node.content && Array.isArray(node.content) && node.content[nextIndex]) {
      return navigateToPath(node.content[nextIndex], [...currentPath, nextIndex], targetPath)
    }
    
    return null
  }
  
  // 找到目标行
  const targetRow = navigateToPath(newContent, [], path)
  if (targetRow && targetRow.type === "tableRow") {
    if (!targetRow.attrs) {
      targetRow.attrs = {}
    }
    // 明确设置为布尔值
    targetRow.attrs.exportEnabled = enabled === true
    
    console.log(`updateRowExportEnabled: Updated row at path [${path.join(',')}]`, {
      type: targetRow.type,
      exportEnabled: targetRow.attrs.exportEnabled,
      enabled,
      attrs: targetRow.attrs
    })
  } else {
    console.error(`updateRowExportEnabled: Could not find tableRow at path [${path.join(',')}]`, {
      foundNode: targetRow ? { type: targetRow.type } : null,
      path
    })
  }
  
  return newContent
}

interface TableRowExportControlProps {
  /** 文档内容 */
  content: JSONContent | null
  /** 内容变化回调 */
  onContentChange?: (content: JSONContent) => void
  /** 是否折叠（默认展开） */
  defaultCollapsed?: boolean
}

/**
 * 表格行导出控制面板组件
 */
export function TableRowExportControl({
  content,
  onContentChange,
  defaultCollapsed = false,
}: TableRowExportControlProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)
  
  // 提取所有表格行
  const tableRows = useMemo(() => {
    return extractTableRows(content)
  }, [content])
  
  // 如果没有表格行，不显示控制面板
  if (tableRows.length === 0) {
    return null
  }
  
  // 处理checkbox变化
  const handleExportEnabledChange = useCallback((rowId: string, enabled: boolean) => {
    if (!content || !onContentChange) return
    
    const row = tableRows.find(r => r.id === rowId)
    if (!row) return
    
    const updatedContent = updateRowExportEnabled(content, row.path, enabled)
    onContentChange(updatedContent)
  }, [content, onContentChange, tableRows])
  
  // 按表格分组
  const rowsByTable = useMemo(() => {
    const grouped: Record<number, TableRowInfo[]> = {}
    tableRows.forEach(row => {
      if (!grouped[row.tableIndex]) {
        grouped[row.tableIndex] = []
      }
      grouped[row.tableIndex].push(row)
    })
    return grouped
  }, [tableRows])
  
  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50">
      <CardHeader 
        className="cursor-pointer hover:bg-blue-100/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-700">
            表格行导出控制
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {tableRows.filter(r => r.exportEnabled).length} / {tableRows.length} 行将导出
            </span>
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          {Object.entries(rowsByTable).map(([tableIndex, rows]) => (
            <div key={tableIndex} className="space-y-2">
              <div className="text-xs font-medium text-gray-600 mb-2">
                表格 {parseInt(tableIndex) + 1}
              </div>
              <div className="space-y-1 pl-2">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-2 py-1 hover:bg-blue-100/30 rounded px-2"
                  >
                    <Checkbox
                      id={row.id}
                      checked={row.exportEnabled}
                      onCheckedChange={(checked) => {
                        handleExportEnabledChange(row.id, checked === true)
                      }}
                    />
                    <Label
                      htmlFor={row.id}
                      className="text-sm text-gray-700 cursor-pointer flex-1"
                    >
                      <span className="text-xs text-gray-500 mr-2">
                        行 {row.rowIndex + 1}:
                      </span>
                      {row.previewText || "（空行）"}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  )
}

