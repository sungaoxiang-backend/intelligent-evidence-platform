"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableWithAttrs,
  TableRowWithAttrs,
  templateBaseStyles,
} from "@/components/template-editor/extensions"
import { ReplicableTableCellWithAttrs } from "./replicable-table-cell-with-attrs"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { PlaceholderFormNode } from "./placeholder-form-node-extension"
import { PlaceholderInfo } from "./placeholder-form-fields"
import { identifyReplicableCells, type ReplicableCellInfo } from "./replicable-cell-utils"
import { createRoot } from "react-dom/client"
import { ReplicableCell } from "./replicable-cell"
import { updateRowExportEnabled, extractTableRows } from "./table-row-export-control"

interface DocumentPreviewFormProps {
  /** 文档内容（ProseMirror JSON） */
  content?: JSONContent | null
  
  /** 占位符信息列表 */
  placeholders?: PlaceholderInfo[]
  
  /** 表单数据 */
  formData?: Record<string, any>
  
  /** 表单数据变化回调 */
  onFormDataChange?: (formData: Record<string, any>) => void
  
  /** 模板类型（要素式/陈述式） */
  templateCategory?: string | null
  
  /** 自定义类名 */
  className?: string
  
  /** 内容变化回调（用于更新表格行导出状态） */
  onContentChange?: (content: JSONContent) => void
}

/**
 * 文档预览表单组件
 * 
 * 在文档预览中将占位符渲染为表单输入框
 */
export function DocumentPreviewForm({
  content,
  placeholders = [],
  formData = {},
  onFormDataChange,
  templateCategory,
  className,
  onContentChange,
}: DocumentPreviewFormProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const previousContentRef = useRef<string | null>(null)
  const formDataRef = useRef<Record<string, any>>(formData || {})
  const checkboxesInitializedRef = useRef(false) // 标记checkbox是否已初始化
  const checkboxStatesRef = useRef<Map<string, boolean>>(new Map()) // 存储每个checkbox的状态
  const latestContentRef = useRef<JSONContent | null>(content || null) // 存储最新的content
  
  // 保持 formDataRef 与 formData 同步
  useEffect(() => {
    formDataRef.current = formData || {}
  }, [formData])
  
  // 保持 latestContentRef 与 content 同步
  useEffect(() => {
    if (content) {
      latestContentRef.current = content
    }
  }, [content])
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
  }, [])
  
  // 获取占位符信息
  const getPlaceholderInfo = useCallback((fieldKey: string): PlaceholderInfo | undefined => {
    return placeholders.find((p) => p.name === fieldKey)
  }, [placeholders])
  
  // 获取表单值
  const getFormValue = useCallback((fieldKey: string) => {
    return formData[fieldKey]
  }, [formData])
  
  // 处理表单值变化
  const handleFormValueChange = useCallback((fieldKey: string, value: any) => {
    if (onFormDataChange) {
      // 使用函数式更新，确保使用最新的 formData
      onFormDataChange((prevFormData) => {
        const newFormData = {
          ...prevFormData,
          [fieldKey]: value,
        }
        console.log(`Form value changed: ${fieldKey} =`, value, "prevFormData:", prevFormData, "newFormData:", newFormData)
        return newFormData
      })
    }
  }, [onFormDataChange])
  
  // 存储值更新回调（用于外部数据加载时更新，不用于用户输入）
  const valueUpdateCallbacksRef = useRef<Set<() => void>>(new Set())
  const replicableCellUpdateCallbacksRef = useRef<Set<() => void>>(new Set())
  
  // 注册值更新回调
  const registerUpdateCallback = useCallback((callback: () => void) => {
    valueUpdateCallbacksRef.current.add(callback)
    // 返回清理函数
    return () => {
      valueUpdateCallbacksRef.current.delete(callback)
    }
  }, [])
  
  // 注册可复制单元格更新回调
  const registerReplicableCellUpdateCallback = useCallback((callback: () => void) => {
    replicableCellUpdateCallbacksRef.current.add(callback)
    // 返回清理函数
    return () => {
      replicableCellUpdateCallbacksRef.current.delete(callback)
    }
  }, [])
  
  // 当 formData 变化时，通知所有可复制单元格更新
  // 使用防抖来避免输入时频繁重新渲染导致输入框失去焦点
  useEffect(() => {
    console.log("DocumentPreviewForm: formData changed, scheduling update callbacks")
    console.log("DocumentPreviewForm: formData keys:", Object.keys(formData || {}))
    
    // 检查是否有输入框处于焦点状态
    const activeElement = document.activeElement
    const hasFocusedInput = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.closest('input, textarea')
    )
    
    // 使用防抖延迟更新，避免输入时频繁重新渲染
    // 如果有输入框处于焦点状态，使用更长的延迟
    const delay = hasFocusedInput ? 1500 : 800
    const timeoutId = setTimeout(() => {
      // 再次检查是否有输入框处于焦点状态
      const currentActiveElement = document.activeElement
      const stillHasFocusedInput = currentActiveElement && (
        currentActiveElement.tagName === 'INPUT' || 
        currentActiveElement.tagName === 'TEXTAREA' ||
        currentActiveElement.closest('input, textarea')
      )
      
      // 如果仍然有输入框处于焦点状态，再延迟一次
      if (stillHasFocusedInput) {
        setTimeout(() => {
          console.log("DocumentPreviewForm: calling", replicableCellUpdateCallbacksRef.current.size, "callbacks")
          replicableCellUpdateCallbacksRef.current.forEach(callback => {
            try {
              callback()
            } catch (error) {
              console.error("Error calling replicable cell update callback:", error)
            }
          })
        }, 500)
      } else {
        console.log("DocumentPreviewForm: calling", replicableCellUpdateCallbacksRef.current.size, "callbacks")
        replicableCellUpdateCallbacksRef.current.forEach(callback => {
          try {
            callback()
          } catch (error) {
            console.error("Error calling replicable cell update callback:", error)
          }
        })
      }
    }, delay)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [formData])
  
  // 注意：不在 formData 变化时触发更新，因为输入框使用内部状态管理
  // 只在占位符信息变化时更新（比如从服务器加载新数据）
  
  // 创建编辑器实例
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
        resizable: false,
        HTMLAttributes: {
          class: templateCategory && (templateCategory.includes("要素") || templateCategory === "要素式")
            ? "custom-table form-table"
            : "custom-table narrative-table",
        },
      }),
      TableRowWithAttrs.configure({
        HTMLAttributes: {},
      }),
      TableHeader.configure({
        HTMLAttributes: {},
      }),
      ReplicableTableCellWithAttrs.configure({
        HTMLAttributes: {},
        getPlaceholderInfos: () => placeholders,
        getFormData: () => {
          // 使用 ref 获取最新的 formData，避免闭包问题
          return formDataRef.current || {}
        },
        onFormDataChange: (newFormData: Record<string, any>) => {
          console.log("ReplicableCell onFormDataChange called:", newFormData)
          if (onFormDataChange) {
            onFormDataChange(newFormData)
          }
        },
        templateCategory,
        getTemplateContent: () => latestContentRef.current,
        registerUpdateCallback: registerReplicableCellUpdateCallback,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Underline,
      TextStyle,
      Color,
      PlaceholderFormNode.configure({
        getPlaceholderInfo,
        getFormValue,
        onFormValueChange: handleFormValueChange,
        registerUpdateCallback,
        templateCategory,
      }),
    ],
    content: { type: "doc", content: [] },
    editable: false, // 只读模式
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px; cursor: default;",
      },
    },
  })
  
  // 标记是否正在更新checkbox状态（避免循环更新）
  const isUpdatingCheckboxRef = useRef(false)
  
  // 更新内容
  useEffect(() => {
    if (!editor) return
    
    if (!content) return
    
    // 如果正在更新checkbox，跳过editor.setContent，避免触发update事件
    if (isUpdatingCheckboxRef.current) {
      console.log("DocumentPreviewForm: Skipping setContent (checkbox update in progress)")
      return
    }
    
    const contentKey = JSON.stringify(content)
    
    if (previousContentRef.current === contentKey) {
      return
    }
    
    previousContentRef.current = contentKey
    
    try {
      const normalizedContent = normalizeContent(content) || content
      // 使用emitUpdate: false，避免触发update事件
      editor.commands.setContent(normalizedContent, false, { emitUpdate: false })
    } catch (error) {
      console.error("Failed to set content:", error)
      previousContentRef.current = null
    }
  }, [editor, content, normalizeContent])
  
  // 监听编辑器内容变化，同步到onContentChange
  // 但要注意：checkbox变化时不应该触发这个，因为我们已经直接更新了JSON
  useEffect(() => {
    if (!editor || !onContentChange) return
    
    const handleUpdate = () => {
      // 如果正在更新checkbox，跳过（避免循环）
      if (isUpdatingCheckboxRef.current) {
        console.log("DocumentPreviewForm: Skipping editor update handler (checkbox update in progress)")
        return
      }
      
      const json = editor.getJSON()
      onContentChange(json)
    }
    
    editor.on("update", handleUpdate)
    
    return () => {
      editor.off("update", handleUpdate)
    }
  }, [editor, onContentChange])
  
  // 在表格渲染后添加checkbox（只在editor和content首次加载时运行一次）
  useEffect(() => {
    if (!editor || !content) return
    
    // 如果已经初始化过，完全跳过
    if (checkboxesInitializedRef.current) {
      console.log("DocumentPreviewForm: Checkboxes already initialized, skipping completely")
      return
    }
    
    const addCheckboxesToTableRows = () => {
      // 双重检查，确保不会重复初始化
      if (checkboxesInitializedRef.current) {
        console.log("DocumentPreviewForm: Checkboxes already initialized (double check), skipping")
        return
      }
      const editorElement = editorRef.current?.querySelector('.ProseMirror') || editorRef.current
      if (!editorElement) return
      
      // 从content中提取表格行信息，获取exportEnabled状态
      const tableRows = extractTableRows(content)
      console.log("DocumentPreviewForm: Extracted table rows", tableRows.length, tableRows)
      
      const tables = editorElement.querySelectorAll('table')
      console.log("DocumentPreviewForm: Found tables", tables.length)
      
      tables.forEach((table, domTableIndex) => {
        const rows = table.querySelectorAll('tr')
        console.log(`DocumentPreviewForm: Table ${domTableIndex} has ${rows.length} rows`)
        
        // 关键修复：通过表格内容匹配JSON中的表格，而不是依赖索引
        // 因为DOM中可能有其他表格（如控制面板），导致索引不匹配
        let jsonTableIndex = -1
        
        // 尝试通过表格的第一行内容来匹配JSON中的表格
        if (rows.length > 0) {
          const firstRow = rows[0]
          const firstRowText = firstRow.textContent?.trim() || ""
          
          // 在JSON中查找匹配的表格
          for (let i = 0; i < tableRows.length; i++) {
            const rowInfo = tableRows[i]
            if (rowInfo.tableIndex !== jsonTableIndex && jsonTableIndex === -1) {
              // 找到新的表格，检查第一行是否匹配
              const jsonFirstRow = tableRows.find(r => 
                r.tableIndex === rowInfo.tableIndex && r.rowIndex === 0
              )
              if (jsonFirstRow && firstRowText.includes(jsonFirstRow.previewText.substring(0, 20))) {
                jsonTableIndex = rowInfo.tableIndex
                console.log(`DocumentPreviewForm: Matched DOM table ${domTableIndex} to JSON table ${jsonTableIndex}`)
                break
              }
            }
          }
          
          // 如果没找到匹配，使用索引（向后兼容）
          if (jsonTableIndex === -1) {
            jsonTableIndex = domTableIndex
            console.warn(`DocumentPreviewForm: Could not match table, using index ${domTableIndex}`)
          }
        } else {
          jsonTableIndex = domTableIndex
        }
        
        rows.forEach((row, domRowIndex) => {
          // 跳过checkbox单元格本身（如果它被当作一行处理）
          if (row.classList?.contains('export-control-checkbox-cell')) {
            return
          }
          
          // 检查是否已经有checkbox单元格
          let checkboxCell = row.querySelector('.export-control-checkbox-cell') as HTMLElement
          let checkbox = checkboxCell?.querySelector('input[type="checkbox"]') as HTMLInputElement
          
          // 获取行的文本内容用于匹配（排除checkbox单元格）
          const rowText = Array.from(row.children)
            .filter((cell: any) => !cell.classList?.contains('export-control-checkbox-cell'))
            .map((cell: any) => cell.textContent?.trim() || '')
            .join(' ')
            .substring(0, 50)
          
          // 找到对应的行信息（使用JSON表格索引）
          // 如果通过索引找不到，尝试通过文本内容匹配
          let rowInfo = tableRows.find(r => r.tableIndex === jsonTableIndex && r.rowIndex === domRowIndex)
          
          if (!rowInfo && rowText) {
            // 通过文本内容匹配（用于处理索引不匹配的情况）
            rowInfo = tableRows.find(r => 
              r.tableIndex === jsonTableIndex && 
              r.previewText && 
              rowText.includes(r.previewText.substring(0, 30))
            )
            if (rowInfo) {
              console.log(`DocumentPreviewForm: Matched row by text content: "${rowText.substring(0, 30)}" -> "${rowInfo.previewText.substring(0, 30)}"`)
            }
          }
          
          const exportEnabled = rowInfo ? rowInfo.exportEnabled : true
          
          console.log(`DocumentPreviewForm: Row ${domRowIndex} in DOM table ${domTableIndex} (JSON table ${jsonTableIndex})`, {
            rowText: rowText.substring(0, 50),
            hasRowInfo: !!rowInfo,
            exportEnabled,
            rowPath: rowInfo?.path,
            previewText: rowInfo?.previewText?.substring(0, 30)
          })
          
          if (checkboxCell && checkbox) {
            // Checkbox已存在，不更新它的状态（让用户操作完全控制）
            // 从ref中恢复之前的状态（如果有）
            const checkboxKey = `table-${jsonTableIndex}-row-${domRowIndex}`
            const savedState = checkboxStatesRef.current.get(checkboxKey)
            if (savedState !== undefined && checkbox.checked !== savedState) {
              console.log(`DocumentPreviewForm: Restoring checkbox state from ref for ${checkboxKey}`, {
                saved: savedState,
                current: checkbox.checked
              })
              checkbox.checked = savedState
            }
            return
          }
          
          // 创建新的checkbox单元格
          checkboxCell = document.createElement('td')
          checkboxCell.className = 'export-control-checkbox-cell'
          checkboxCell.setAttribute('data-export-control', 'true')
          checkboxCell.style.cssText = 'width: 40px !important; min-width: 40px !important; max-width: 40px !important; padding: 8px 4px !important; vertical-align: top !important; text-align: center !important; border-right: 1px solid #e5e7eb !important; box-sizing: border-box !important; display: table-cell !important; visibility: visible !important; opacity: 1 !important;'
          
          // 创建checkbox，使用从JSON中读取的状态
          checkbox = document.createElement('input')
          checkbox.type = 'checkbox'
          
          // 优先使用ref中保存的状态，如果没有则使用JSON中的状态
          const checkboxKey = `table-${jsonTableIndex}-row-${domRowIndex}`
          const savedState = checkboxStatesRef.current.get(checkboxKey)
          checkbox.checked = savedState !== undefined ? savedState : exportEnabled
          
          // 保存初始状态到ref
          checkboxStatesRef.current.set(checkboxKey, checkbox.checked)
          
          checkbox.style.cssText = 'cursor: pointer !important; width: 16px !important; height: 16px !important; margin: 0 !important; display: block !important; visibility: visible !important; opacity: 1 !important;'
          checkbox.title = '包含在导出中'
          checkbox.setAttribute('data-export-checkbox', 'true')
          checkbox.setAttribute('data-table-index', String(jsonTableIndex))
          checkbox.setAttribute('data-row-index', String(domRowIndex))
          checkbox.setAttribute('data-dom-table-index', String(domTableIndex))
          checkbox.setAttribute('data-checkbox-key', checkboxKey)
          
          // 处理checkbox变化
          checkbox.addEventListener('change', (e) => {
            // 标记正在更新checkbox，避免触发editor.setContent和update事件
            isUpdatingCheckboxRef.current = true
            
            const newValue = (e.target as HTMLInputElement).checked
            const checkboxKey = checkbox.getAttribute('data-checkbox-key') || `table-${jsonTableIndex}-row-${domRowIndex}`
            
            // 立即更新ref中的状态
            checkboxStatesRef.current.set(checkboxKey, newValue)
            console.log(`DocumentPreviewForm: Checkbox state saved to ref: ${checkboxKey} = ${newValue}`)
            
            const storedJsonTableIndex = parseInt(checkbox.getAttribute('data-table-index') || '-1')
            const storedRowIndex = parseInt(checkbox.getAttribute('data-row-index') || '-1')
            const storedRowPath = rowInfo?.path // 使用当前找到的rowInfo的path
            
            // 获取行的文本内容用于匹配
            const rowText = Array.from(row.children)
              .filter((cell: any) => !cell.classList?.contains('export-control-checkbox-cell'))
              .map((cell: any) => cell.textContent?.trim() || '')
              .join(' ')
              .substring(0, 50)
            
            console.log(`DocumentPreviewForm: Checkbox changed (USER ACTION) for JSON table ${storedJsonTableIndex}, row ${storedRowIndex}`, {
              newValue,
              rowText: rowText.substring(0, 50),
              storedRowPath
            })
            
            if (onContentChange) {
              // 使用ref中存储的最新content，而不是可能过时的content prop
              const currentContent = latestContentRef.current || content
              if (!currentContent) {
                console.error("DocumentPreviewForm: No content available for update")
                isUpdatingCheckboxRef.current = false
                return
              }
              
              const currentTableRows = extractTableRows(currentContent)
              
              // 优先使用存储的path，如果找不到则通过索引或文本匹配
              let currentRowInfo = storedRowPath 
                ? currentTableRows.find(r => JSON.stringify(r.path) === JSON.stringify(storedRowPath))
                : null
              
              if (!currentRowInfo) {
                // 通过索引查找
                currentRowInfo = currentTableRows.find(r => 
                  r.tableIndex === storedJsonTableIndex && r.rowIndex === storedRowIndex
                )
              }
              
              if (!currentRowInfo && rowText) {
                // 通过文本内容匹配（最后的手段）
                currentRowInfo = currentTableRows.find(r => 
                  r.tableIndex === storedJsonTableIndex && 
                  r.previewText && 
                  rowText.includes(r.previewText.substring(0, 30))
                )
                if (currentRowInfo) {
                  console.log(`DocumentPreviewForm: Found row by text matching: "${rowText.substring(0, 30)}"`)
                }
              }
              
              if (currentRowInfo) {
                console.log(`DocumentPreviewForm: Found row info:`, {
                  tableIndex: currentRowInfo.tableIndex,
                  rowIndex: currentRowInfo.rowIndex,
                  path: currentRowInfo.path,
                  previewText: currentRowInfo.previewText.substring(0, 30),
                  currentExportEnabled: currentRowInfo.exportEnabled
                })
                
                const updatedContent = updateRowExportEnabled(currentContent, currentRowInfo.path, newValue)
                
                // 立即更新ref，确保下次使用最新值
                latestContentRef.current = updatedContent
                console.log(`DocumentPreviewForm: Updated content for JSON table ${storedJsonTableIndex}, row ${storedRowIndex}`, {
                  path: currentRowInfo.path,
                  newValue,
                  hasUpdatedContent: !!updatedContent
                })
                
                // 验证更新是否成功
                const verifyTableRows = extractTableRows(updatedContent)
                const verifyRowInfo = verifyTableRows.find(r => 
                  JSON.stringify(r.path) === JSON.stringify(currentRowInfo.path)
                )
                console.log(`DocumentPreviewForm: Verification - row exportEnabled after update:`, {
                  found: !!verifyRowInfo,
                  exportEnabled: verifyRowInfo?.exportEnabled,
                  expected: newValue,
                  path: verifyRowInfo?.path
                })
                
                if (verifyRowInfo?.exportEnabled !== newValue) {
                  console.error(`DocumentPreviewForm: State mismatch! Expected ${newValue}, got ${verifyRowInfo?.exportEnabled}`, {
                    path: verifyRowInfo?.path,
                    attrs: verifyRowInfo ? (updatedContent as any).content?.[verifyRowInfo.path[0]]?.content?.[verifyRowInfo.path[1]]?.attrs : null
                  })
                } else {
                  console.log(`DocumentPreviewForm: ✅ State update successful!`)
                }
                
                // 更新content，但标记这是checkbox更新，避免触发editor.setContent
                onContentChange(updatedContent)
                
                // 延迟清除标记，确保不会触发editor更新
                setTimeout(() => {
                  isUpdatingCheckboxRef.current = false
                  console.log("DocumentPreviewForm: Checkbox update flag cleared")
                }, 100)
              } else {
                console.error("DocumentPreviewForm: ❌ Could not find row path for JSON table", storedJsonTableIndex, "row", storedRowIndex, "in content", {
                  rowText: rowText.substring(0, 50),
                  availableRows: currentTableRows
                    .filter(r => r.tableIndex === storedJsonTableIndex)
                    .map(r => ({ 
                      tableIndex: r.tableIndex, 
                      rowIndex: r.rowIndex,
                      path: r.path,
                      previewText: r.previewText.substring(0, 30),
                      exportEnabled: r.exportEnabled
                    }))
                })
              }
            }
          })
          
          // 存储rowInfo的path到checkbox，以便后续使用
          if (rowInfo) {
            checkbox.setAttribute('data-row-path', JSON.stringify(rowInfo.path))
          }
          
          checkboxCell.appendChild(checkbox)
          
          // 插入到行的最前面
          row.insertBefore(checkboxCell, row.firstChild)
          console.log(`DocumentPreviewForm: Added checkbox to DOM table ${domTableIndex} (JSON table ${jsonTableIndex}), row ${domRowIndex}`, { 
            exportEnabled,
            rowPath: rowInfo?.path 
          })
        })
      })
      
      // 标记已初始化
      checkboxesInitializedRef.current = true
      console.log("DocumentPreviewForm: ✅ Checkboxes initialized and will not be recreated")
    }
    
    // 延迟执行，等待表格渲染完成（只在初始渲染时）
    const timeoutId = setTimeout(() => {
      addCheckboxesToTableRows()
    }, 500) // 增加延迟，确保表格完全渲染
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [editor]) // 只在editor初始化时运行一次，不依赖content变化
  
  // 当占位符变化时，刷新编辑器（但不响应formData变化，避免中断输入）
  useEffect(() => {
    if (!editor) return
    // 只在占位符列表变化时刷新
    const { tr } = editor.state
    editor.view.dispatch(tr)
  }, [editor, placeholders])
  
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }
  
  return (
    <div className={className}>
      <div ref={editorRef} className="relative">
        <EditorContent editor={editor} />
      </div>
      <style jsx global>{templateBaseStyles}</style>
      <style jsx global>{`
        /* 判断是否是要素式模板的函数式CSS类 */
        ${templateCategory && (templateCategory.includes("要素") || templateCategory === "要素式") ? `
          /* 要素式模板：表格单元格布局优化 - 50%:50%布局 */
          /* 表格单元格中包含占位符字段时，使用flex布局实现50%:50%分配 */
          .template-doc table td,
          .template-doc table th {
            position: relative;
          }
          
          /* 确保checkbox单元格不影响表格布局 */
          .template-doc table tr .export-control-checkbox-cell {
            width: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            padding: 8px 4px !important;
            box-sizing: border-box;
          }
          
          /* 确保其他单元格正常显示 */
          .template-doc table tr td:not(.export-control-checkbox-cell),
          .template-doc table tr th:not(.export-control-checkbox-cell) {
            width: auto;
          }

          /* 要素式模板：表格单元格中包含占位符时，使用flex布局 */
          .template-doc table td .placeholder-form-field,
          .template-doc table th .placeholder-form-field {
            display: inline-block;
            width: 50%;
            vertical-align: middle;
            margin-left: auto;
          }

          /* 要素式模板：确保输入框样式统一 */
          .template-doc table td .placeholder-form-field input,
          .template-doc table td .placeholder-form-field textarea,
          .template-doc table td .placeholder-form-field [role="combobox"],
          .template-doc table th .placeholder-form-field input,
          .template-doc table th .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field [role="combobox"] {
            width: 100%;
            height: 32px;
            padding: 4px 8px;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid #d1d5db;
            border-radius: 4px;
          }

          .template-doc table td .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field textarea {
            height: auto;
            min-height: 60px;
          }

          /* 要素式模板：表格单元格中的文本（字段名）应该在左侧，占50% */
          .template-doc table td,
          .template-doc table th {
            text-align: left;
          }
        ` : `
          /* 陈述式模板：表格保持原有的文档结构，不强制表单布局 */
          .template-doc table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
          }

          .template-doc table td,
          .template-doc table th {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
            position: relative;
          }
          
          /* 确保checkbox单元格不影响表格布局 */
          .template-doc table tr .export-control-checkbox-cell {
            width: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            padding: 8px 4px !important;
            box-sizing: border-box;
          }
          
          /* 确保其他单元格正常显示 */
          .template-doc table tr td:not(.export-control-checkbox-cell),
          .template-doc table tr th:not(.export-control-checkbox-cell) {
            width: auto;
          }

          /* 陈述式模板：表格中的占位符字段保持自然布局 */
          .template-doc table td .placeholder-form-field,
          .template-doc table th .placeholder-form-field {
            display: inline-block;
            width: auto;
            min-width: 120px;
            vertical-align: baseline;
          }

          /* 陈述式模板：表格中的输入框样式 */
          .template-doc table td .placeholder-form-field input,
          .template-doc table td .placeholder-form-field textarea,
          .template-doc table td .placeholder-form-field [role="combobox"],
          .template-doc table th .placeholder-form-field input,
          .template-doc table th .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field [role="combobox"] {
            width: 100%;
            min-width: 120px;
            height: 32px;
            padding: 4px 8px;
            font-size: 14px;
            line-height: 1.5;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            background-color: #ffffff;
          }

          .template-doc table td .placeholder-form-field textarea,
          .template-doc table th .placeholder-form-field textarea {
            height: auto;
            min-height: 60px;
            resize: vertical;
          }
        `}

        /* 通用样式：所有模板类型的输入框基础样式 */
        .template-doc .placeholder-form-field input,
        .template-doc .placeholder-form-field textarea,
        .template-doc .placeholder-form-field [role="combobox"] {
          width: 100%;
          height: 32px;
          padding: 4px 8px;
          font-size: 14px;
          line-height: 1.5;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background-color: #ffffff;
          transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }

        .template-doc .placeholder-form-field textarea {
          height: auto;
          min-height: 60px;
          resize: vertical;
        }

        /* 输入框焦点状态 */
        .template-doc .placeholder-form-field input:focus,
        .template-doc .placeholder-form-field textarea:focus,
        .template-doc .placeholder-form-field [role="combobox"]:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        /* 统一所有输入框的placeholder样式 */
        .template-doc .placeholder-form-field input::placeholder,
        .template-doc .placeholder-form-field textarea::placeholder {
          color: #9ca3af;
          opacity: 1;
        }
      `}</style>
    </div>
  )
}

