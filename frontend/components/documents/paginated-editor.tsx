"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Editor } from "@tiptap/react"
import { A4_PAGE_WIDTH, A4_PAGE_HEIGHT, A4_PAGE_MARGIN, A4_CONTENT_WIDTH } from "@/components/documents/shared/editor-extensions"
import { A4_CONTENT_HEIGHT, calculatePageCount } from "./page-break-utils"
import { cn } from "@/lib/utils"

interface PaginatedEditorProps {
  editor: Editor | null
  children: React.ReactNode
  className?: string
}

/**
 * 分页编辑器包装组件
 * 自动将编辑器内容分割到多个A4页面
 * 使用CSS的page-break属性来实现分页效果
 */
export function PaginatedEditor({ editor, children, className }: PaginatedEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)

  // 计算分页
  const calculatePages = useCallback(() => {
    if (!contentRef.current || !editor) {
      setPageCount(1)
      return
    }

    const contentElement = contentRef.current.querySelector('.ProseMirror') as HTMLElement
    if (!contentElement) {
      setPageCount(1)
      return
    }

    // 等待DOM更新完成
    requestAnimationFrame(() => {
      const calculatedPageCount = calculatePageCount(contentElement)
      setPageCount(calculatedPageCount)
      
      // 动态插入分页标记
      const proseMirror = contentElement
      const totalHeight = proseMirror.scrollHeight
      
      // 清除之前的分页标记
      proseMirror.querySelectorAll('.page-break-marker').forEach(marker => marker.remove())
      
      // 为每个页面（除了第一页）插入分页标记
      for (let i = 1; i < calculatedPageCount; i++) {
        const breakPosition = i * A4_CONTENT_HEIGHT
        
        // 查找最佳分页位置（在段落、标题等自然断点）
        const walker = document.createTreeWalker(
          proseMirror,
          NodeFilter.SHOW_ELEMENT,
          null
        )
        
        let currentHeight = 0
        let lastBreakableElement: HTMLElement | null = null
        
        while (walker.nextNode()) {
          const element = walker.currentNode as HTMLElement
          const elementHeight = element.offsetHeight || 0
          const tagName = element.tagName.toLowerCase()
          
          // 记录可分页的元素
          if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'ul', 'ol', 'li', 'table'].includes(tagName)) {
            if (currentHeight + elementHeight >= breakPosition) {
              lastBreakableElement = element
              break
            }
          }
          
          currentHeight += elementHeight
        }
        
        // 在找到的元素前插入分页标记
        if (lastBreakableElement) {
          const marker = document.createElement('div')
          marker.className = 'page-break-marker'
          marker.style.cssText = 'page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0;'
          lastBreakableElement.parentNode?.insertBefore(marker, lastBreakableElement)
        }
      }
    })
  }, [editor])

  // 监听内容变化
  useEffect(() => {
    if (!editor) return

    // 初始计算
    const timeoutId = setTimeout(calculatePages, 200)

    // 监听编辑器更新
    const handleUpdate = () => {
      // 延迟计算，等待DOM更新
      setTimeout(calculatePages, 200)
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    // 使用ResizeObserver监听内容高度变化
    const contentElement = contentRef.current?.querySelector('.ProseMirror')
    if (contentElement) {
      const resizeObserver = new ResizeObserver(() => {
        calculatePages()
      })
      resizeObserver.observe(contentElement as HTMLElement)

      return () => {
        clearTimeout(timeoutId)
        editor.off('update', handleUpdate)
        editor.off('selectionUpdate', handleUpdate)
        resizeObserver.disconnect()
      }
    }

    return () => {
      clearTimeout(timeoutId)
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor, calculatePages])

  return (
    <div
      ref={containerRef}
      className={cn("paginated-editor-container", className)}
    >
      <div
        ref={contentRef}
        className="template-doc-container paginated-content"
        style={{
          width: `${A4_PAGE_WIDTH}px`,
          minHeight: `${A4_PAGE_HEIGHT}px`,
          height: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
