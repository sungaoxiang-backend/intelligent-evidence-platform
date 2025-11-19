"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core"
import { useEffect, useRef } from "react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import HardBreak from "@tiptap/extension-hard-break"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "./extensions"
import { normalizeHardBreaks } from "./utils"

interface DocumentEditorProps {
  initialContent?: JSONContent | null
  onChange?: (content: JSONContent) => void
  isLoading?: boolean
}

const FONT_FAMILIES = [
  "SimSun",
  "SimHei",
  "FangSong",
  "KaiTi",
  "Arial",
  "Times New Roman",
]

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"]

const Toolbar = ({ editor }: { editor: TiptapEditor | null }) => {
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

  const normalizeContent = (content?: JSONContent | null) => {
    if (!content) return content
    return normalizeHardBreaks(
      JSON.parse(JSON.stringify(content))
    )
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        paragraph: false,
      }),
      HardBreak.configure({
        keepMarks: true,
      }),
      ParagraphWithAttrs,
      HeadingWithAttrs,
      TableWithAttrs.configure({
        resizable: false,
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
        defaultAlignment: 'left',
      }),
      Underline,
      TextStyle,
      Color,
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
        const normalized = normalizeHardBreaks(
          JSON.parse(JSON.stringify(json))
        )
        if (normalized) {
          onChange?.(normalized)
        }
      } catch (error) {
        console.error("Editor error:", error)
      }
    },
    onCreate: () => {
      console.log("Editor created")
    },
    editorProps: {
      attributes: {
        class: "template-doc",
        style: "padding: 16px;",
      },
    },
  })

  const paragraphAttrs = editor?.getAttributes("paragraph") ?? {}
  const spacingAttrs = paragraphAttrs.spacing ?? {}
  const textStyleAttrs = editor?.getAttributes("textStyle") ?? {}

  const updateTextStyle = (attrs: Record<string, string>) => {
    if (!editor) return
    editor.chain().focus().setMark("textStyle", { ...textStyleAttrs, ...attrs }).run()
  }

  const updateParagraphAttrs = (attrs: Record<string, unknown>) => {
    if (!editor) return
    editor.chain().focus().updateAttributes("paragraph", { ...paragraphAttrs, ...attrs }).run()
  }

  const handleFontFamilyChange = (value: string) => {
    updateTextStyle({ fontFamily: value })
  }

  const handleFontSizeChange = (value: string) => {
    const size = value.endsWith("pt") ? value : `${value}pt`
    updateTextStyle({ fontSize: size })
  }

  const handleColorChange = (value: string) => {
    updateTextStyle({ color: value })
  }

  const handleLineHeightChange = (value: string) => {
    const numeric = parseFloat(value)
    if (!Number.isNaN(numeric)) {
      updateParagraphAttrs({ lineHeight: numeric })
    }
  }

  const handleSpacingChange = (key: "before" | "after", value: string) => {
    const numeric = parseFloat(value)
    if (!Number.isNaN(numeric)) {
      updateParagraphAttrs({
        spacing: { ...spacingAttrs, [key]: numeric },
      })
    }
  }

  const handleIndentChange = (key: "indent" | "firstLineIndent", value: string) => {
    const numeric = parseFloat(value)
    if (!Number.isNaN(numeric)) {
      updateParagraphAttrs({ [key]: numeric })
    }
  }

  // 只设置一次内容，避免重复设置导致光标跳转
  useEffect(() => {
    if (editor && initialContent && !isLoading && !contentSetRef.current) {
      console.log("Setting content:", initialContent)

      const normalized = normalizeContent(initialContent) || initialContent

      try {
        const tr = editor.state.tr
        const newDoc = editor.schema.nodeFromJSON(normalized)

        if (newDoc.content) {
          tr.replaceWith(0, editor.state.doc.content.size, newDoc.content)
          editor.view.dispatch(tr)
          contentSetRef.current = true
          console.log("Content set successfully")
        }
      } catch (error) {
        console.error("Failed to set content:", error)
        editor.commands.setContent(normalized)
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
      <Tabs defaultValue="content">
        <TabsList className="w-full">
          <TabsTrigger value="content" className="flex-1">
            内容
          </TabsTrigger>
          <TabsTrigger value="styles" className="flex-1">
            样式
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <div
            ref={editorRef}
            className="border-t border-gray-300 relative"
            style={{ height: "600px", overflow: "auto" }}
          >
            <EditorContent editor={editor} />
          </div>
        </TabsContent>
        <TabsContent value="styles">
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>字体</Label>
              <Select
                value={textStyleAttrs.fontFamily || "SimSun"}
                onValueChange={handleFontFamilyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择字体" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font} value={font}>
                      {font}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>字号 (pt)</Label>
              <Select
                value={(textStyleAttrs.fontSize || "14pt").replace("pt", "")}
                onValueChange={handleFontSizeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择字号" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>字体颜色</Label>
              <Input
                type="color"
                value={textStyleAttrs.color || "#000000"}
                onChange={(e) => handleColorChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>行距 (pt)</Label>
              <Input
                type="number"
                min={1}
                step={1}
                defaultValue={paragraphAttrs.lineHeight ?? 16}
                onBlur={(e) => handleLineHeightChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>段前 (pt)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                defaultValue={spacingAttrs.before ?? 0}
                onBlur={(e) => handleSpacingChange("before", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>段后 (pt)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                defaultValue={spacingAttrs.after ?? 0}
                onBlur={(e) => handleSpacingChange("after", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>左缩进 (pt)</Label>
              <Input
                type="number"
                step={1}
                defaultValue={paragraphAttrs.indent ?? 0}
                onBlur={(e) => handleIndentChange("indent", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>首行缩进 (pt)</Label>
              <Input
                type="number"
                step={1}
                defaultValue={paragraphAttrs.firstLineIndent ?? 0}
                onBlur={(e) =>
                  handleIndentChange("firstLineIndent", e.target.value)
                }
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <style jsx global>{templateBaseStyles}</style>
    </div>
  )
}