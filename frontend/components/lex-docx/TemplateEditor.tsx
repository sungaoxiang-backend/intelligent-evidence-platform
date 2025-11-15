"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  Save,
  Loader2,
  Hash,
} from "lucide-react"
import { type DocumentTemplate, type PlaceholderMetadata } from "@/lib/api/lex-docx"
import { PlaceholderConfig } from "./PlaceholderConfig"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { handleApiError } from "@/lib/utils/error-handler"

interface TemplateEditorProps {
  template: DocumentTemplate | null
  onSave?: (content: string, placeholderMetadata: Record<string, PlaceholderMetadata>) => void
  onContentChange?: (content: string) => void
  className?: string
}

// 防抖函数
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return function (this: any, ...args: Parameters<T>) {
    const context = this
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait)
  }
}

// 验证占位符名称
function validatePlaceholderName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

export function TemplateEditor({
  template,
  onSave,
  onContentChange,
  className,
}: TemplateEditorProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [showPlaceholderDialog, setShowPlaceholderDialog] = useState(false)
  const [placeholderName, setPlaceholderName] = useState("")
  const [placeholderMetadata, setPlaceholderMetadata] = useState<
    Record<string, PlaceholderMetadata>
  >({})
  const [placeholderNameError, setPlaceholderNameError] = useState("")

  // 初始化编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: "开始输入内容...",
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: template?.content_html || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (onContentChange) {
        onContentChange(html)
      }
      // 自动保存（防抖）
      debouncedAutoSave(html)
    },
  })

  // 从模板内容中提取占位符
  useEffect(() => {
    if (template?.content_html && editor) {
      editor.commands.setContent(template.content_html)
    }
  }, [template?.id, editor])

  // 从模板加载占位符元数据
  useEffect(() => {
    if (template?.placeholder_metadata) {
      setPlaceholderMetadata(template.placeholder_metadata)
    } else {
      setPlaceholderMetadata({})
    }
  }, [template?.placeholder_metadata])

  // 防抖自动保存
  const debouncedAutoSave = useCallback(
    debounce((html: string) => {
      // 自动保存逻辑（如果需要）
      // 这里可以调用 onSave，但通常自动保存只在手动保存时触发
    }, 2000),
    []
  )

  // 手动保存
  const handleSave = async () => {
    if (!editor || !template) {
      return
    }

    setIsSaving(true)
    try {
      const html = editor.getHTML()
      if (onSave) {
        await onSave(html, placeholderMetadata)
        toast({
          title: "保存成功",
          description: "模板内容已保存",
        })
      }
    } catch (error) {
      handleApiError(error, "模板保存失败")
    } finally {
      setIsSaving(false)
    }
  }

  // 插入占位符
  const handleInsertPlaceholder = () => {
    setPlaceholderName("")
    setPlaceholderNameError("")
    setShowPlaceholderDialog(true)
  }

  // 验证并插入占位符
  const handleConfirmPlaceholder = () => {
    // 验证占位符名称
    if (!placeholderName.trim()) {
      setPlaceholderNameError("占位符名称不能为空")
      return
    }

    const trimmedName = placeholderName.trim()
    if (!validatePlaceholderName(trimmedName)) {
      setPlaceholderNameError(
        "占位符名称只能包含字母、数字和下划线，且必须以字母或下划线开头"
      )
      return
    }

    // 如果占位符已存在元数据，直接插入
    // 如果不存在，需要先配置元数据
    if (!placeholderMetadata[trimmedName]) {
      setPlaceholderNameError("请先配置占位符属性")
      return
    }

    // 插入占位符文本
    if (editor) {
      editor.chain().focus().insertContent(`{{${trimmedName}}}`).run()
    }

    // 关闭对话框
    setShowPlaceholderDialog(false)
    setPlaceholderName("")
    setPlaceholderNameError("")
  }

  // 保存占位符配置
  const handleSavePlaceholderConfig = (
    name: string,
    metadata: PlaceholderMetadata
  ) => {
    setPlaceholderMetadata((prev) => ({
      ...prev,
      [name]: metadata,
    }))
    // 配置保存后，自动插入占位符
    if (editor) {
      editor.chain().focus().insertContent(`{{${name}}}`).run()
    }
    setShowPlaceholderDialog(false)
    setPlaceholderName("")
    setPlaceholderNameError("")
  }

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b bg-background">
        <div className="flex items-center gap-1 flex-wrap">
          {/* 文本格式 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={cn(editor.isActive("bold") && "bg-accent")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={cn(editor.isActive("italic") && "bg-accent")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.can().chain().focus().toggleUnderline().run()}
            className={cn(editor.isActive("underline") && "bg-accent")}
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={cn(editor.isActive("strike") && "bg-accent")}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 对齐 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={cn(editor.isActive({ textAlign: "left" }) && "bg-accent")}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={cn(editor.isActive({ textAlign: "center" }) && "bg-accent")}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={cn(editor.isActive({ textAlign: "right" }) && "bg-accent")}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 列表 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(editor.isActive("bulletList") && "bg-accent")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(editor.isActive("orderedList") && "bg-accent")}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          {/* 插入占位符 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInsertPlaceholder}
            className="text-primary"
          >
            <Hash className="h-4 w-4 mr-1" />
            插入占位符
          </Button>
        </div>

        {/* 保存按钮 */}
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !template}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              保存
            </>
          )}
        </Button>
      </div>

      {/* 编辑器内容 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none focus:outline-none"
          />
        </div>
      </div>

      {/* 插入占位符对话框 */}
      <Dialog open={showPlaceholderDialog} onOpenChange={setShowPlaceholderDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>插入占位符</DialogTitle>
            <DialogDescription>
              输入占位符名称，然后配置字段属性
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 占位符名称输入 */}
            <div>
              <Label htmlFor="placeholder-name">占位符名称 *</Label>
              <Input
                id="placeholder-name"
                value={placeholderName}
                onChange={(e) => {
                  setPlaceholderName(e.target.value)
                  setPlaceholderNameError("")
                }}
                placeholder="例如: client_name"
                className={cn(
                  "mt-1 font-mono",
                  placeholderNameError && "border-destructive"
                )}
              />
              {placeholderNameError && (
                <p className="text-sm text-destructive mt-1">
                  {placeholderNameError}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                只能包含字母、数字和下划线，且必须以字母或下划线开头
              </p>
            </div>

            {/* 占位符配置 */}
            {placeholderName.trim() &&
              validatePlaceholderName(placeholderName.trim()) &&
              !placeholderMetadata[placeholderName.trim()] && (
                <PlaceholderConfig
                  placeholderName={placeholderName.trim()}
                  metadata={placeholderMetadata[placeholderName.trim()]}
                  onSave={handleSavePlaceholderConfig}
                  onCancel={() => {
                    setShowPlaceholderDialog(false)
                    setPlaceholderName("")
                    setPlaceholderNameError("")
                  }}
                />
              )}

            {/* 如果占位符已存在，显示提示 */}
            {placeholderName.trim() &&
              validatePlaceholderName(placeholderName.trim()) &&
              placeholderMetadata[placeholderName.trim()] && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    该占位符已存在，可以直接插入到编辑器中。
                  </p>
                </div>
              )}
          </div>

          {/* 对话框操作按钮 */}
          {placeholderName.trim() &&
            validatePlaceholderName(placeholderName.trim()) &&
            placeholderMetadata[placeholderName.trim()] && (
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPlaceholderDialog(false)
                    setPlaceholderName("")
                    setPlaceholderNameError("")
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleConfirmPlaceholder}>插入占位符</Button>
              </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

