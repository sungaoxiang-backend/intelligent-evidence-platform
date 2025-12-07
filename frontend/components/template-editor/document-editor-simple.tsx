"use client"

/**
 * 简化版文档编辑器
 * 
 * 设计原则：
 * 1. 占位符是普通文本 {{fieldKey}}，可以像普通文本一样编辑
 * 2. 不附加任何装饰或事件，彻底避免 ProseMirror 装饰崩溃
 * 3. 移除复杂的占位符交互逻辑
 * 4. 关注点分离：编辑器负责编辑，占位符管理通过侧边栏完成
 */

import React, { useEffect, useRef, useCallback, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import HardBreak from "@tiptap/extension-hard-break"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ListOrdered,
  List,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Plus,
} from "lucide-react"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "./extensions"
import { normalizeContent as normalizeContentUtil } from "./utils"
import { usePlaceholderManager } from "./placeholder-manager"
import { cn } from "@/lib/utils"

interface DocumentEditorSimpleProps {
  /** 初始文档内容（ProseMirror JSON） */
  initialContent?: JSONContent | null
  
  /** 内容变化回调 */
  onChange?: (json: JSONContent) => void
  
  /** 是否加载中 */
  isLoading?: boolean
  
  /** 是否禁用编辑 */
  disabled?: boolean
  
  /** 自定义类名 */
  className?: string
}

/**
 * 简化版文档编辑器组件
 * 
 * 占位符作为普通文本，不再附加任何装饰
 */
export function DocumentEditorSimple({
  initialContent,
  onChange,
  isLoading = false,
  disabled = false,
  className,
}: DocumentEditorSimpleProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const contentSetRef = useRef(false)
  const placeholderManager = usePlaceholderManager()
  
  // 规范化内容
  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeContentUtil(JSON.parse(JSON.stringify(value)))
  }, [])
  
  // 创建编辑器实例
  const editor = useEditor({
    immediatelyRender: false, // 修复 SSR hydration 问题
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
        hardBreak: false, // 禁用 StarterKit 中的 hardBreak，避免重复扩展
      }),
      HardBreak.configure({
        keepMarks: true,
      }),
      ParagraphWithAttrs,
      HeadingWithAttrs,
      TableWithAttrs.configure({
        resizable: true,
        HTMLAttributes: {},
      }),
      TableRow.configure({
        HTMLAttributes: {},
      }),
      TableHeader.configure({
        HTMLAttributes: {},
      }),
      TableCellWithAttrs.configure({
        HTMLAttributes: {},
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "left",
      }),
      Underline,
      TextStyle,
      Color,
    ],
    content: normalizeContent(initialContent) || { type: "doc", content: [] },
    editable: !disabled && !isLoading,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px; min-height: 500px; outline: none;",
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      onChange?.(json)
      
      // 同步占位符列表
      placeholderManager.syncFromDoc(json)
    },
  })
  
  // 设置初始内容（只在首次加载时）
  useEffect(() => {
    if (editor && initialContent && !contentSetRef.current) {
      try {
        const normalizedContent = normalizeContent(initialContent) || initialContent
        // 使用emitUpdate: false避免不必要的更新事件
        editor.commands.setContent(normalizedContent, false)
        contentSetRef.current = true
      } catch (error) {
        console.error("Failed to set initial content:", error)
        // 如果失败，重置标志以便重试
        contentSetRef.current = false
      }
    }
  }, [editor, initialContent, normalizeContent])
  
  // 更新可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled && !isLoading)
    }
  }, [editor, disabled, isLoading])
  
  // 工具栏按钮组件
  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title?: string
  }) => (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 p-0",
        isActive && "bg-blue-100 text-blue-700 hover:bg-blue-200"
      )}
    >
      {children}
    </Button>
  )
  
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载编辑器...</div>
      </div>
    )
  }
  
  return (
    <div className={cn("border rounded-lg bg-white", className)}>
      {/* 工具栏 */}
      <div className="border-b bg-gray-50 p-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* 文本格式 */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="粗体"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="斜体"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive("underline")}
              title="下划线"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* 标题 */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive("heading", { level: 1 })}
              title="标题 1"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive("heading", { level: 2 })}
              title="标题 2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive("heading", { level: 3 })}
              title="标题 3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* 对齐 */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              isActive={editor.isActive({ textAlign: "left" })}
              title="左对齐"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              isActive={editor.isActive({ textAlign: "center" })}
              title="居中"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              isActive={editor.isActive({ textAlign: "right" })}
              title="右对齐"
            >
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              isActive={editor.isActive({ textAlign: "justify" })}
              title="两端对齐"
            >
              <AlignJustify className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* 列表 */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive("bulletList")}
              title="无序列表"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive("orderedList")}
              title="有序列表"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-1" />
          
          {/* 表格 */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 1, cols: 1, withHeaderRow: false }).run()
              }
              title="插入表格"
            >
              <Table className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          {isLoading && (
            <div className="ml-auto text-sm text-gray-500">
              保存中...
            </div>
          )}
        </div>
      </div>
      
      {/* 编辑器内容区域 */}
      <div ref={editorRef} className="relative">
        <EditorContent editor={editor} />
      </div>
      
      {/* 样式 */}
      <style jsx global>{templateBaseStyles}</style>
      
      {/* 帮助提示 */}
      <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <span className="font-medium">提示：</span>
        使用 <code className="bg-yellow-100 px-1 rounded">{"{{占位符名称}}"}</code> 格式插入占位符，
        如 <code className="bg-yellow-100 px-1 rounded">{"{{姓名}}"}</code>、
        <code className="bg-yellow-100 px-1 rounded">{"{{日期}}"}</code>
      </div>
    </div>
  )
}

