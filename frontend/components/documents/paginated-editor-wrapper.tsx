"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Editor } from "@tiptap/react"
import { EditorContent } from "@tiptap/react"
import { A4_PAGE_WIDTH, A4_PAGE_HEIGHT, A4_PAGE_MARGIN, A4_CONTENT_WIDTH } from "@/components/documents/shared/editor-extensions"
import { A4_CONTENT_HEIGHT, calculatePageCount } from "./page-break-utils"
import { cn } from "@/lib/utils"

interface PaginatedEditorWrapperProps {
  editor: Editor | null
  className?: string
}

/**
 * 分页编辑器包装组件
 * 自动将编辑器内容分割到多个A4页面
 * 使用CSS伪元素在每个页面位置添加白色背景和阴影，创建多个页面的视觉效果
 */
export function PaginatedEditorWrapper({ editor, className }: PaginatedEditorWrapperProps) {
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
    setTimeout(() => {
      const calculatedPageCount = calculatePageCount(contentElement)
      setPageCount(calculatedPageCount)
      
      // 设置CSS变量，用于CSS中创建多个页面
      if (containerRef.current) {
        containerRef.current.style.setProperty('--page-count', calculatedPageCount.toString())
      }
    }, 200)
  }, [editor])

  // 监听内容变化
  useEffect(() => {
    if (!editor) return

    // 初始计算
    const timeoutId = setTimeout(calculatePages, 300)

    // 监听编辑器更新
    const handleUpdate = () => {
      // 延迟计算，等待DOM更新
      setTimeout(calculatePages, 300)
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
      style={{
        '--page-count': pageCount,
      } as React.CSSProperties}
    >
      {/* 编辑器内容容器 - 使用CSS伪元素创建多个页面的视觉效果 */}
      <div
        ref={contentRef}
        className="template-doc-container paginated-content-wrapper"
        style={{
          width: `${A4_PAGE_WIDTH}px`,
          minHeight: `${A4_PAGE_HEIGHT}px`,
          height: 'auto',
          position: 'relative',
        }}
      >
        <EditorContent editor={editor} />
        
        {/* 动态创建页面背景和分隔线 */}
        {Array.from({ length: pageCount }).map((_, index) => (
          <React.Fragment key={`page-${index + 1}`}>
            {/* 页面背景 */}
            <div
              className="page-background"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${index * (A4_PAGE_HEIGHT + 16)}px`,
                height: `${A4_PAGE_HEIGHT}px`,
                background: 'white',
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
            {/* 页面分隔线 */}
            {index < pageCount - 1 && (
              <div
                className="page-break-line"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${(index + 1) * A4_PAGE_HEIGHT + index * 16}px`,
                  height: '16px',
                  zIndex: 1,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '1px',
                    background: 'linear-gradient(to right, transparent, #d1d5db 20%, #d1d5db 80%, transparent)',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
