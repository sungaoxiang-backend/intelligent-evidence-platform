"use client"

import { mergeAttributes } from "@tiptap/core"
import { TableCellWithAttrs } from "@/components/template-editor/extensions"
import { Node } from "@tiptap/core"
import React from "react"
import { createRoot } from "react-dom/client"
import { ReplicableCell } from "./replicable-cell"
import { extractPlaceholdersFromCell, parseArrayFieldName } from "./replicable-cell-utils"
import type { JSONContent } from "@tiptap/core"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { createNarrativeTableCell } from "./narrative-table-cell"

export interface ReplicableTableCellWithAttrsOptions {
  getPlaceholderInfos?: () => PlaceholderInfo[]
  getFormData?: () => Record<string, any>
  onFormDataChange?: (formData: Record<string, any>) => void
  templateCategory?: string | null
  registerUpdateCallback?: (callback: () => void) => () => void
  getTemplateContent?: () => JSONContent | null
}

/**
 * 扩展 TableCellWithAttrs，支持可复制单元格
 */
export const ReplicableTableCellWithAttrs = TableCellWithAttrs.extend<ReplicableTableCellWithAttrsOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      getPlaceholderInfos: () => [],
      getFormData: () => ({}),
      onFormDataChange: () => {},
      templateCategory: null,
      registerUpdateCallback: () => () => {},
      getTemplateContent: () => null,
    }
  },

  addNodeView() {
    return ({ node, getPos, view }) => {
      const dom = document.createElement(node.attrs.isHeader ? "th" : "td")
      dom.setAttribute("data-type", "tableCell")
      
      // 关键修复：正确设置 colspan 和 rowspan 属性
      const attrs = node.attrs as any
      if (attrs.colspan && attrs.colspan > 1) {
        dom.setAttribute("colspan", String(attrs.colspan))
      }
      if (attrs.rowspan && attrs.rowspan > 1) {
        dom.setAttribute("rowspan", String(attrs.rowspan))
      }

      // 检查单元格内容和模板类型
      const cellNode = node.toJSON() as JSONContent
      const placeholders = extractPlaceholdersFromCell(cellNode)

      // 判断模板类型
      const isElementStyle = this.options.templateCategory &&
        (this.options.templateCategory.includes("要素") || this.options.templateCategory === "要素式")

      // 完全独立的处理逻辑：
      // 1. 陈述式模板（无论是否有占位符）-> 使用 narrative-table-cell 支持添加/删除功能
      // 2. 要素式模板且包含多个占位符 -> 使用 ReplicableCell
      // 3. 其他情况 -> 使用默认渲染

      if (!isElementStyle) {
        // 陈述式模板：所有单元格都使用 narrative-table-cell 支持添加/删除功能
        // 即使没有占位符，也要渲染为可复制的段落形式
        console.log("使用 narrative-table-cell 处理陈述式模板单元格", { placeholders: placeholders.length, hasPlaceholders: placeholders.length > 0 })

        // 关键修复：基于templateContent JSON生成稳定的cellId
        // 格式：table-{tableIndex}-row-{rowIndex}-cell-{cellIndex}
        // 优先从templateContent JSON直接匹配，如果失败则从ProseMirror state获取
        let stableCellId = `cell-${getPos?.() || Date.now()}`
        
        try {
          // 方法1：从templateContent JSON中直接匹配单元格（最可靠，同步）
          const templateContent = this.options.getTemplateContent?.()
          if (templateContent) {
            // 同步实现：直接从templateContent JSON中遍历，找到匹配的单元格
            // 通过比较单元格的结构（类型、占位符列表等）来匹配
            const extractPlaceholders = (cell: JSONContent): string[] => {
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
              return placeholders.sort()
            }
            
            const findCellInTemplate = (content: JSONContent, targetCell: JSONContent): { tableIndex: number, rowIndex: number, cellIndex: number } | null => {
              let tableIndex = 0
              const targetPlaceholders = extractPlaceholders(targetCell)
              
              const traverse = (node: JSONContent): { tableIndex: number, rowIndex: number, cellIndex: number } | null => {
                if (node.type === "table") {
                  if (node.content && Array.isArray(node.content)) {
                    for (let rowIdx = 0; rowIdx < node.content.length; rowIdx++) {
                      const row = node.content[rowIdx]
                      if (row.type === "tableRow" && row.content && Array.isArray(row.content)) {
                        for (let cellIdx = 0; cellIdx < row.content.length; cellIdx++) {
                          const cell = row.content[cellIdx]
                          // 对于没有占位符的单元格，使用更精确的匹配：比较单元格的文本内容
                          // 这样可以区分"诉讼请求"和"事实与理由"等相似的单元格
                          if (targetPlaceholders.length === 0) {
                            // 提取单元格的文本内容（用于匹配）
                            const extractText = (node: JSONContent): string => {
                              let text = ""
                              if (node.type === "text" && node.text) {
                                text += node.text
                              }
                              if (node.content && Array.isArray(node.content)) {
                                node.content.forEach(child => {
                                  text += extractText(child)
                                })
                              }
                              return text.trim()
                            }
                            
                            const cellText = extractText(cell)
                            const targetText = extractText(targetCell)
                            
                            // 如果文本内容匹配，且段落数量也匹配，则认为是同一个单元格
                            const cellParagraphs = (cell.content || []).filter((n: JSONContent) => n.type === "paragraph").length
                            const targetParagraphs = (targetCell.content || []).filter((n: JSONContent) => n.type === "paragraph").length
                            
                            if (cellText === targetText && cellParagraphs === targetParagraphs) {
                              return { tableIndex, rowIndex: rowIdx, cellIndex: cellIdx }
                            }
                          } else {
                            // 对于有占位符的单元格，使用占位符列表匹配
                            const cellPlaceholders = extractPlaceholders(cell)
                            if (cellPlaceholders.length === targetPlaceholders.length &&
                                cellPlaceholders.every((p, i) => p === targetPlaceholders[i])) {
                              return { tableIndex, rowIndex: rowIdx, cellIndex: cellIdx }
                            }
                          }
                        }
                      }
                    }
                  }
                  tableIndex++
                  return null
                }
                if (node.content && Array.isArray(node.content)) {
                  for (const child of node.content) {
                    const result = traverse(child)
                    if (result) return result
                  }
                }
                return null
              }
              
              return traverse(content)
            }
            
            const matched = findCellInTemplate(templateContent, cellNode)
            if (matched) {
              stableCellId = `table-${matched.tableIndex}-row-${matched.rowIndex}-cell-${matched.cellIndex}`
              console.log(`ReplicableTableCellWithAttrs: 从templateContent JSON匹配到cellId: ${stableCellId}`)
            } else {
              // 方法2：从ProseMirror state中获取位置信息（fallback）
              if (view && getPos) {
                const pos = getPos()
                if (pos !== undefined && pos >= 0) {
                  const $pos = view.state.doc.resolve(pos)
                  let tableIndex = -1
                  let rowIndex = -1
                  let cellIndex = -1
                  
                  // 向上查找表格、行、单元格的索引
                  let depth = $pos.depth
                  let foundTable = false
                  let foundRow = false
                  
                  while (depth >= 0) {
                    const currentNode = $pos.node(depth)
                    const index = $pos.index(depth)
                    
                    if (currentNode.type.name === "table" && !foundTable) {
                      // 计算这是第几个表格（从文档根节点开始计算）
                      tableIndex = 0
                      const doc = view.state.doc
                      
                      // 遍历文档，计算表格索引
                      const traverseDoc = (node: any): boolean => {
                        if (node.type.name === "table") {
                          if (node === currentNode) {
                            return true
                          }
                          tableIndex++
                        }
                        if (node.content && node.content.childCount > 0) {
                          for (let i = 0; i < node.content.childCount; i++) {
                            if (traverseDoc(node.content.child(i))) {
                              return true
                            }
                          }
                        }
                        return false
                      }
                      traverseDoc(doc)
                      foundTable = true
                    } else if (currentNode.type.name === "tableRow" && !foundRow) {
                      rowIndex = index
                      foundRow = true
                    } else if (currentNode.type.name === "tableCell" || currentNode.type.name === "tableHeader") {
                      cellIndex = index
                    }
                    
                    depth--
                  }
                  
                  if (tableIndex >= 0 && rowIndex >= 0 && cellIndex >= 0) {
                    // 同步生成cellId（不使用异步import，直接使用计算出的索引）
                    stableCellId = `table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`
                    console.log(`ReplicableTableCellWithAttrs: 从ProseMirror state生成稳定cellId: ${stableCellId}`, {
                      tableIndex,
                      rowIndex,
                      cellIndex
                    })
                  } else {
                    console.warn(`ReplicableTableCellWithAttrs: 无法从ProseMirror state获取完整的位置信息`, {
                      tableIndex,
                      rowIndex,
                      cellIndex,
                      pos: getPos?.(),
                      hasView: !!view
                    })
                  }
                }
              }
            }
          }
          
          // 如果方法1失败，尝试从DOM中获取（作为fallback）
          if (stableCellId.startsWith("cell-")) {
            // 使用setTimeout延迟，等待DOM渲染完成
            setTimeout(() => {
              const rowElement = dom.closest('tr')
              const tableElement = rowElement?.closest('table')
              if (tableElement && rowElement) {
                // 找到表格在文档中的索引
                const allTables = Array.from(document.querySelectorAll('.template-doc table, .ProseMirror table'))
                const tableIndex = allTables.indexOf(tableElement)
                
                // 找到行在表格中的索引
                const allRows = Array.from(tableElement.querySelectorAll('tr'))
                const rowIndex = allRows.indexOf(rowElement)
                
                // 找到单元格在行中的索引（排除checkbox单元格）
                const allCells = Array.from(rowElement.querySelectorAll('td, th'))
                const cellIndex = allCells.indexOf(dom)
                
                if (tableIndex >= 0 && rowIndex >= 0 && cellIndex >= 0) {
                  const newCellId = `table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`
                  console.log(`ReplicableTableCellWithAttrs: 从DOM生成稳定cellId: ${newCellId} (延迟)`)
                  // 注意：这里不能直接更新stableCellId，因为已经传递给createNarrativeTableCell了
                  // 但我们可以记录这个信息，用于后续的修复
                }
              }
            }, 100)
          }
        } catch (error) {
          console.warn("ReplicableTableCellWithAttrs: 无法获取单元格位置，使用默认cellId", error)
        }
        
        // 调试：检查cellId格式
        if (stableCellId.startsWith("cell-") && !stableCellId.includes("table-")) {
          console.warn(`ReplicableTableCellWithAttrs: 警告！cellId仍然是旧格式: ${stableCellId}，这会导致段落数量无法正确保存。尝试从templateContent匹配...`)
          
          // 最后的fallback：尝试从templateContent JSON中匹配单元格
          const templateContent = this.options.getTemplateContent?.()
          if (templateContent) {
            try {
              // 同步导入cell-id-utils（如果可能）
              // 由于无法同步import，我们直接实现一个简单的匹配逻辑
              const matchCellFromTemplate = (content: JSONContent, targetCell: JSONContent): string | null => {
                let tableIndex = 0
                const traverse = (node: JSONContent): string | null => {
                  if (node.type === "table") {
                    if (node.content && Array.isArray(node.content)) {
                      node.content.forEach((row, rowIdx) => {
                        if (row.type === "tableRow" && row.content && Array.isArray(row.content)) {
                          row.content.forEach((cell, cellIdx) => {
                            if (cell === targetCell || JSON.stringify(cell) === JSON.stringify(targetCell)) {
                              return `table-${tableIndex}-row-${rowIdx}-cell-${cellIdx}`
                            }
                          })
                        }
                      })
                    }
                    tableIndex++
                    return null
                  }
                  if (node.content && Array.isArray(node.content)) {
                    for (const child of node.content) {
                      const result = traverse(child)
                      if (result) return result
                    }
                  }
                  return null
                }
                return traverse(content)
              }
              
              // 尝试匹配（但这个方法不可靠，因为对象引用可能不同）
              // 更好的方法是使用cell-id-utils，但需要同步
              // 暂时保留旧格式，但记录警告
            } catch (e) {
              console.warn("ReplicableTableCellWithAttrs: 无法从templateContent匹配单元格", e)
            }
          }
        } else {
          console.log(`ReplicableTableCellWithAttrs: 使用cellId创建NarrativeTableCell: ${stableCellId}`)
        }
        
        return createNarrativeTableCell(
          dom,
          cellNode,
          this.options.getPlaceholderInfos?.() || [],
          this.options.getFormData?.() || {},
          (newFormData) => {
            if (this.options.onFormDataChange) {
              this.options.onFormDataChange(newFormData)
            }
          },
          this.options.templateCategory,
          stableCellId,
          this.options.registerUpdateCallback,
          this.options.getFormData
        )
      }

      // 检查是否有数组数据（用于判断是否需要使用 ReplicableCell）
      const hasArrayData = (): boolean => {
        const formData = this.options.getFormData?.() || {}
        // 检查是否有任何占位符存在数组格式的数据（如 fieldName[0], fieldName[1]）
        for (const placeholder of placeholders) {
          for (const key of Object.keys(formData)) {
            const parsed = parseArrayFieldName(key)
            if (parsed && parsed.baseName === placeholder && parsed.index >= 0) {
              console.log(`检测到数组数据: ${key}，使用 ReplicableCell`)
              return true
            }
          }
        }
        return false
      }

      if (isElementStyle && placeholders.length > 1 && hasArrayData()) {
        // 要素式模板多个占位符且有数组数据：使用 ReplicableCell（垂直排列多个副本）
        console.log("使用 ReplicableCell 处理要素式模板单元格（有数组数据）", { placeholders: placeholders.length })

        let root: ReturnType<typeof createRoot> | null = null
        let isDestroyed = false
        let unregisterCallback: (() => void) | null = null

        const safeUnmount = () => {
          if (!root) return
          const currentRoot = root
          root = null

          setTimeout(() => {
            try {
              currentRoot.unmount()
            } catch (error) {
              console.warn("Error unmounting ReplicableCell:", error)
            }
          }, 0)
        }

        try {
          root = createRoot(dom)
          root.render(
            React.createElement(ReplicableCell, {
              cellNode,
              placeholders,
              placeholderInfos: this.options.getPlaceholderInfos?.() || [],
              formData: this.options.getFormData?.() || {},
              onFormDataChange: (newFormData) => {
                if (this.options.onFormDataChange) {
                  this.options.onFormDataChange(newFormData)
                }
              },
              templateCategory: this.options.templateCategory,
              cellId: `cell-${getPos?.() || Date.now()}`,
            })
          )

          if (this.options.registerUpdateCallback) {
            unregisterCallback = this.options.registerUpdateCallback(() => {
              // 更新逻辑
              if (isDestroyed || !dom.parentNode) return

              const currentFormData = this.options.getFormData?.() || {}
              if (root) {
                try {
                  root.render(
                    React.createElement(ReplicableCell, {
                      cellNode,
                      placeholders,
                      placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                      formData: currentFormData,
                      onFormDataChange: (newFormData) => {
                        if (this.options.onFormDataChange) {
                          this.options.onFormDataChange(newFormData)
                        }
                      },
                      templateCategory: this.options.templateCategory,
                      cellId: `cell-${getPos?.() || Date.now()}`,
                    })
                  )
                } catch (error) {
                  console.error("Error updating ReplicableCell:", error)
                }
              }
            })
          }
        } catch (error) {
          console.error("Error rendering ReplicableCell:", error)
          dom.textContent = "渲染错误"
        }

        return {
          dom,
          contentDOM: null,
          destroy: () => {
            isDestroyed = true
            if (unregisterCallback) {
              unregisterCallback()
            }
            setTimeout(() => {
              safeUnmount()
            }, 0)
          },
          update: (updatedNode) => {
            if (isDestroyed || !dom.parentNode) return false

            const updatedCellNode = updatedNode.toJSON() as JSONContent
            const updatedPlaceholders = extractPlaceholdersFromCell(updatedCellNode)
            const formData = this.options.getFormData?.() || {}
            
            // 检查是否有数组数据
            const hasArrayData = (): boolean => {
              for (const placeholder of updatedPlaceholders) {
                for (const key of Object.keys(formData)) {
                  const parsed = parseArrayFieldName(key)
                  if (parsed && parsed.baseName === placeholder && parsed.index >= 0) {
                    return true
                  }
                }
              }
              return false
            }

            if (updatedPlaceholders.length > 1 && hasArrayData()) {
              // 更新渲染
              if (root) {
                try {
                  root.render(
                    React.createElement(ReplicableCell, {
                      cellNode: updatedCellNode,
                      placeholders: updatedPlaceholders,
                      placeholderInfos: this.options.getPlaceholderInfos?.() || [],
                      formData: formData,
                      onFormDataChange: (newFormData) => {
                        if (this.options.onFormDataChange) {
                          this.options.onFormDataChange(newFormData)
                        }
                      },
                      templateCategory: this.options.templateCategory,
                      cellId: `cell-${getPos?.() || Date.now()}`,
                    })
                  )
                } catch (error) {
                  console.error("Error updating ReplicableCell:", error)
                  return false
                }
              }
              return true
            } else {
              // 不再需要特殊渲染，卸载并使用默认渲染
              if (root) {
                safeUnmount()
              }
              return false // 让 TipTap 使用默认渲染
            }
          },
        }
      }

      // 使用默认渲染（返回一个简单的NodeView）
      return {
        dom,
        contentDOM: dom,
      }
    }
  },
})

