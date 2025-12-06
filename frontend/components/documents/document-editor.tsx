"use client"

import React, { useEffect, useRef, useCallback } from "react"
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
  PlusCircle,
  MinusCircle,
  Merge,
  Split,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Columns,
  Rows,
} from "lucide-react"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
  A4_PAGE_WIDTH,
  A4_PAGE_HEIGHT,
  A4_PAGE_MARGIN,
  A4_CONTENT_WIDTH,
} from "@/components/template-editor/extensions"
import { normalizeHardBreaks } from "@/components/template-editor/utils"
import { FontSize } from "./font-size-extension"
// import { TableContextMenu } from "./table-context-menu"
import { cn } from "@/lib/utils"

interface DocumentEditorProps {
  initialContent?: JSONContent | null
  onChange?: (json: JSONContent) => void
  onSave?: () => void
  onCancel?: () => void
  onExport?: () => void
  isLoading?: boolean
  className?: string
}

export function DocumentEditor({
  initialContent,
  onChange,
  onSave,
  onCancel,
  onExport,
  isLoading = false,
  className,
}: DocumentEditorProps) {
  const contentSetRef = useRef(false)

  const normalizeContent = useCallback((value?: JSONContent | null) => {
    if (!value) return value
    return normalizeHardBreaks(JSON.parse(JSON.stringify(value)))
  }, [])

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
        resizable: true,
        allowTableNodeSelection: true, // 允许表格选择，支持单元格多选
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
      TextStyle, // 必须在 FontSize 之前
      Color,
      FontSize, // 依赖于 TextStyle，必须在之后加载
    ],
    content: normalizeContent(initialContent) || { type: "doc", content: [] },
    editable: !isLoading,
    autofocus: false,
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "outline: none;",
      },
      // 优化粘贴处理：基于 A4 页面尺寸 1:1 保留 WPS 样式
      transformPastedHTML(html, view) {
        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = html
        
        // 处理所有元素，基于 A4 页面尺寸保留样式
        const allElements = tempDiv.querySelectorAll("*")
        allElements.forEach((element) => {
          const el = element as HTMLElement
          
          // 1. 处理 <center> 标签：将样式应用到子元素
          if (el.tagName === "CENTER") {
            const children = el.querySelectorAll("p, h1, h2, h3, h4, h5, h6, div")
            children.forEach((child) => {
              const childEl = child as HTMLElement
              childEl.style.textAlign = "center"
            })
            if (["P", "H1", "H2", "H3", "H4", "H5", "H6"].includes(el.tagName)) {
              el.style.textAlign = "center"
            }
          }
          
          // 2. 处理 font 标签的 size 属性，转换为 CSS 样式（1:1 保留）
          if (el.tagName === "FONT" && el.getAttribute("size")) {
            const size = el.getAttribute("size")
            const sizeMap: Record<string, string> = {
              "1": "10pt", "2": "13pt", "3": "16pt", "4": "18pt",
              "5": "24pt", "6": "32pt", "7": "48pt",
            }
            el.style.fontSize = sizeMap[size || "3"] || "16pt"
            el.removeAttribute("size")
          }
          
          // 3. 检查父元素的 text-align，传递到子元素
          const parent = el.parentElement
          if (parent && parent.style.textAlign && !el.style.textAlign) {
            if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV"].includes(el.tagName)) {
              el.style.textAlign = parent.style.textAlign
            }
          }
          
          // 4. 清理所有行高样式（WPS 粘贴的内容经常带有行高，导致"隐形空白"）
          // 对于段落和标题，统一移除行高，使用默认的 1.6
          if (["P", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "SPAN"].includes(el.tagName)) {
            if (el.style.lineHeight) {
              const lineHeight = el.style.lineHeight
              let value = parseFloat(lineHeight)
              if (lineHeight.includes("%")) {
                value = value / 100
              }
              // 如果行高不是标准的 1.0-1.8 范围，或者绝对值 > 25px，移除它
              // 这样可以避免 WPS 粘贴时带来的过大行高
              if (value < 1.0 || value > 1.8 || (value > 5 && value > 25)) {
                el.style.lineHeight = ""
              }
            }
          }
          
          // 5. 处理表格单元格：防止内容溢出
          if (el.tagName === "TD" || el.tagName === "TH") {
            // 移除可能导致溢出的宽度样式
            if (el.style.width === "auto" || el.style.minWidth) {
              // 移除 auto 宽度和过大的 min-width
              const minWidth = el.style.minWidth
              if (minWidth) {
                const minWidthValue = parseFloat(minWidth)
                // 如果 min-width 超过 500px，移除它（通常是不合理的值）
                if (minWidthValue > 500) {
                  el.style.minWidth = ""
                }
              }
              el.style.width = ""
            }
            
            // 确保 box-sizing
            el.style.boxSizing = "border-box"
            
            // 添加自动换行样式，防止内容溢出
            el.style.wordWrap = "break-word"
            el.style.overflowWrap = "break-word"
            
            // 移除可能导致溢出的 max-width（如果设置得过大）
            if (el.style.maxWidth) {
              const maxWidthValue = parseFloat(el.style.maxWidth)
              if (maxWidthValue > 1000) {
                el.style.maxWidth = ""
              }
            }
          }
        })
        
        return tempDiv.innerHTML
      },
      transformPastedText(text, view) {
        // 对于纯文本，保持原样
        return text
      },
      clipboardTextSerializer: ({ editor }) => {
        // 自定义剪贴板文本序列化，保留格式
        return editor.getHTML()
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const normalized = normalizeHardBreaks(JSON.parse(JSON.stringify(json)))
      if (normalized) {
        onChange?.(normalized)
      }
    },
  })

  useEffect(() => {
    if (editor && initialContent && !contentSetRef.current) {
      try {
        const normalizedContent = normalizeContent(initialContent) || initialContent
        editor.commands.setContent(normalizedContent)
        contentSetRef.current = true
      } catch (error) {
        console.error("设置初始内容失败:", error)
      }
    }
  }, [editor, initialContent, normalizeContent])

  if (!editor) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <>
      <style jsx global>{templateBaseStyles}</style>
      <div className={cn("flex flex-col h-full", className)}>
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-1">
          <Button
            variant={editor.isActive("bold") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("italic") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("underline") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={editor.isActive("bulletList") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive("orderedList") ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            variant={editor.isActive({ textAlign: "justify" }) ? "default" : "ghost"}
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="插入表格"
          >
            <Table className="h-4 w-4" />
          </Button>
          {/* 表格操作按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addColumnBefore 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnBefore().run()
            }}
            disabled={!editor.can().addColumnBefore()}
            title="在左侧添加列"
          >
            <div className="flex items-center gap-0.5">
              <ChevronLeft className="h-3 w-3" />
              <PlusCircle className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addColumnAfter 会自动将焦点设置到新添加的列
              editor.chain().focus().addColumnAfter().run()
            }}
            disabled={!editor.can().addColumnAfter()}
            title="在右侧添加列"
          >
            <div className="flex items-center gap-0.5">
              <PlusCircle className="h-3.5 w-3.5" />
              <ChevronRight className="h-3 w-3" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            disabled={!editor.can().deleteColumn()}
            title="删除列"
          >
            <Columns className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addRowBefore 会自动将焦点设置到新添加的行
              editor.chain().focus().addRowBefore().run()
            }}
            disabled={!editor.can().addRowBefore()}
            title="在上方添加行"
          >
            <div className="flex flex-col items-center gap-0.5">
              <ChevronUp className="h-3 w-3" />
              <PlusCircle className="h-3.5 w-3.5" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Tiptap 的 addRowAfter 会自动将焦点设置到新添加的行
              editor.chain().focus().addRowAfter().run()
            }}
            disabled={!editor.can().addRowAfter()}
            title="在下方添加行"
          >
            <div className="flex flex-col items-center gap-0.5">
              <PlusCircle className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </div>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteRow().run()}
            disabled={!editor.can().deleteRow()}
            title="删除行"
          >
            <Rows className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // 尝试合并单元格
              // 注意：需要先选中多个单元格（可以通过拖拽或 Shift+点击）
              editor.chain().focus().mergeCells().run()
            }}
            disabled={!editor.can().mergeCells?.()}
            title="合并单元格（需要选中至少2个单元格，可通过拖拽或 Shift+点击选择）"
          >
            <Merge className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().splitCell().run()}
            disabled={!editor.can().splitCell?.()}
            title="拆分单元格（需要选中已合并的单元格）"
          >
            <Split className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              导出 PDF
            </Button>
          )}
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              取消
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={onSave} disabled={isLoading}>
              {isLoading ? "保存中..." : "保存"}
            </Button>
          )}
        </div>
      </div>

      {/* 编辑器内容 - 带页面容器 */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-4" onClick={() => editor?.commands.focus()}>
        <div className="template-doc-container">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
    </>
  )
}

