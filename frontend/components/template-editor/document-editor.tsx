"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import { useEffect, useRef } from "react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DocumentEditorProps {
  initialContent?: any
  onChange?: (content: any) => void
  isLoading?: boolean
}

const Toolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null

  const setHeading = (level: string) => {
    if (level === "paragraph") {
      editor.commands.setParagraph()
    } else {
      const headingLevel = parseInt(level.replace('heading', ''))
      editor.commands.toggleHeading({ level: headingLevel })
    }
  }

  const getCurrentHeading = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) return `heading${i}`
    }
    return "paragraph"
  }

  return (
    <div className="border border-gray-300 rounded-t-md p-2 bg-white">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <Select value={getCurrentHeading()} onValueChange={setHeading}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="样式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">正文</SelectItem>
              <SelectItem value="heading1">标题 1</SelectItem>
              <SelectItem value="heading2">标题 2</SelectItem>
              <SelectItem value="heading3">标题 3</SelectItem>
              <SelectItem value="heading4">标题 4</SelectItem>
              <SelectItem value="heading5">标题 5</SelectItem>
              <SelectItem value="heading6">标题 6</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.toggleBold()}
            className={cn("h-8 w-8 p-0", editor.isActive('bold') && 'bg-gray-100')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.toggleItalic()}
            className={cn("h-8 w-8 p-0", editor.isActive('italic') && 'bg-gray-100')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.toggleUnderline()}
            className={cn("h-8 w-8 p-0", editor.isActive('underline') && 'bg-gray-100')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.toggleStrike()}
            className={cn("h-8 w-8 p-0", editor.isActive('strike') && 'bg-gray-100')}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.setTextAlign('left')}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'left' }) && 'bg-gray-100')}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.setTextAlign('center')}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'center' }) && 'bg-gray-100')}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.setTextAlign('right')}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'right' }) && 'bg-gray-100')}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.setTextAlign('justify')}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'justify' }) && 'bg-gray-100')}
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.undo()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.commands.redo()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function DocumentEditor({
  initialContent,
  onChange,
  isLoading,
}: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const contentSetRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        table: {
          resizable: false,
          handleWidth: 5,
          cellMinWidth: 100,
          lastColumnResizable: false,
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: "border-collapse border border-gray-300 w-full my-4",
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: "border-b border-gray-300",
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-gray-300 bg-gray-100 font-bold p-2",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-gray-300 p-2",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph", "tableCell"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: 'left',
      }),
      Underline,
      Placeholder.configure({
        placeholder: "开始编辑文档...",
      }),
    ],
    content: { type: "doc", content: [] },
    editable: true,
    autofocus: false,
    onUpdate: ({ editor }) => {
      try {
        const json = editor.getJSON()
        onChange?.(json)
      } catch (error) {
        console.error("Editor error:", error)
      }
    },
    onCreate: ({ editor }) => {
      console.log("Editor created")
    },
    editorProps: {
      attributes: {
        style: "font-family: 'Times New Roman', serif; line-height: 1.6; padding: 16px;",
      },
    },
  })

  // 只设置一次内容，避免重复设置导致光标跳转
  useEffect(() => {
    if (editor && initialContent && !isLoading && !contentSetRef.current) {
      console.log("Setting content:", initialContent)

      try {
        // 使用 transaction 直接替换内容，避免触发额外的更新
        const tr = editor.state.tr
        const newDoc = editor.schema.nodeFromJSON(initialContent)

        if (newDoc.content) {
          tr.replaceWith(0, editor.state.doc.content.size, newDoc.content)
          editor.view.dispatch(tr)
          contentSetRef.current = true
          console.log("Content set successfully")
        }
      } catch (error) {
        console.error("Failed to set content:", error)
        // 备用方案
        editor.commands.setContent(initialContent)
        contentSetRef.current = true
      }
    }
  }, [editor, initialContent, isLoading])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  return (
    <div className="w-full border border-gray-300 rounded-md bg-white">
      <Toolbar editor={editor} />
      <div
        ref={editorRef}
        className="border-t border-gray-300 relative"
        style={{ height: '600px', overflow: 'auto' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}