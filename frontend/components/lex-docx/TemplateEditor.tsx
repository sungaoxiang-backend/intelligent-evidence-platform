"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import "@/app/lex-docx/docx-styles.css"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import TextStyle from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Table from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import { PlaceholderMark } from "./PlaceholderMark"
import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react"
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

export interface TemplateEditorRef {
  save: () => Promise<void>
}

interface TemplateEditorProps {
  template: DocumentTemplate | null
  onSave?: (content: string, placeholderMetadata: Record<string, PlaceholderMetadata>) => void | Promise<void>
  onCancel?: () => void
  onContentChange?: (content: string) => void
  className?: string
  isSaving?: boolean
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

export const TemplateEditor = forwardRef<TemplateEditorRef, TemplateEditorProps>(({
  template,
  onSave,
  onCancel,
  onContentChange,
  className,
  isSaving: externalIsSaving,
}, ref) => {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const isSavingState = externalIsSaving !== undefined ? externalIsSaving : isSaving
  const [showPlaceholderDialog, setShowPlaceholderDialog] = useState(false)
  const [placeholderName, setPlaceholderName] = useState("")
  const [placeholderMetadata, setPlaceholderMetadata] = useState<
    Record<string, PlaceholderMetadata>
  >({})
  const [placeholderNameError, setPlaceholderNameError] = useState("")
  const [editingPlaceholderName, setEditingPlaceholderName] = useState<string | null>(null)

  // 标记编辑器中的占位符（需要在编辑器初始化前定义）
  const markPlaceholdersInEditor = useCallback((editorInstance: typeof editor) => {
    if (!editorInstance) return

    try {
      const { state } = editorInstance
      const { doc, schema } = state
      const placeholderRegex = /\{\{([^}]+)\}\}/g
      const tr = state.tr
      let hasChanges = false

      // 收集所有需要标记的占位符位置
      const placeholderRanges: Array<{ from: number; to: number; name: string }> = []

      // 遍历文档中的所有文本节点
      doc.descendants((node, pos) => {
        // 只处理文本节点
        if (node.isText) {
          const text = node.text
          const matches = Array.from(text.matchAll(placeholderRegex))

          if (matches.length > 0) {
            for (const match of matches) {
              const placeholderName = match[1].trim()
              const fullMatch = match[0]
              const matchIndex = match.index!

              if (matchIndex !== undefined) {
                try {
                  // 计算在文档中的实际位置
                  const from = pos + matchIndex
                  const to = from + fullMatch.length

                  // 验证位置是否有效
                  if (from >= 0 && to <= doc.content.size) {
                    placeholderRanges.push({ from, to, name: placeholderName })
                  }
                } catch (e) {
                  // 忽略单个占位符标记失败的情况
                  console.warn("计算占位符位置失败:", e, { pos, matchIndex, fullMatch })
                }
              }
            }
          }
        }
      })

      // 从后往前处理，避免位置偏移
      for (let i = placeholderRanges.length - 1; i >= 0; i--) {
        const { from, to, name } = placeholderRanges[i]
        try {
          const $from = doc.resolve(from)
          const $to = doc.resolve(to)

          // 检查该位置是否已经有占位符标记
          const existingMark = doc.rangeHasMark($from.start(), $to.end(), schema.marks.placeholderMark)

          if (!existingMark) {
            tr.addMark(
              from,
              to,
              schema.marks.placeholderMark.create({ name })
            )
            hasChanges = true
          }
        } catch (e) {
          console.warn("标记占位符失败:", e, { from, to, name })
        }
      }

      if (hasChanges) {
        editorInstance.view.dispatch(tr)
      }
    } catch (error) {
      console.warn("标记占位符时出错:", error)
    }
  }, [])

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
      // 表格支持
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      PlaceholderMark,
    ],
    content: template?.content_html || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (onContentChange) {
        onContentChange(html)
      }
      // 自动保存（防抖）
      debouncedAutoSave(html)
      // 更新占位符标记
      setTimeout(() => {
        markPlaceholdersInEditor(editor)
      }, 50)
    },
    editorProps: {
      handleClick: (view, pos, event) => {
        // 检查是否点击了占位符
        const dom = event.target as HTMLElement
        
        // 方法1: 检查 DOM 元素
        if (dom.classList.contains("lex-docx-placeholder-editor") || dom.closest(".lex-docx-placeholder-editor")) {
          const placeholderElement = dom.classList.contains("lex-docx-placeholder-editor") 
            ? dom 
            : dom.closest(".lex-docx-placeholder-editor") as HTMLElement
          const placeholderName = placeholderElement?.getAttribute("data-placeholder")
          if (placeholderName) {
            event.preventDefault()
            event.stopPropagation()
            setEditingPlaceholderName(placeholderName)
            setPlaceholderName(placeholderName)
            setShowPlaceholderDialog(true)
            return true
          }
        }
        
        // 方法2: 检查点击位置的标记
        try {
          const { state } = view
          const $pos = state.doc.resolve(pos)
          const marks = $pos.marks()
          
          for (const mark of marks) {
            if (mark.type === state.schema.marks.placeholderMark && mark.attrs.name) {
              event.preventDefault()
              event.stopPropagation()
              setEditingPlaceholderName(mark.attrs.name)
              setPlaceholderName(mark.attrs.name)
              setShowPlaceholderDialog(true)
              return true
            }
          }
        } catch (e) {
          // 忽略错误，继续正常处理
        }
        
        return false
      },
    },
  })

  // 从模板内容中提取占位符并标记
  useEffect(() => {
    if (template?.content_html && editor) {
      editor.commands.setContent(template.content_html)
      
      // 延迟标记占位符，确保内容已加载
      setTimeout(() => {
        markPlaceholdersInEditor(editor)
      }, 100)
    }
  }, [template?.id, editor, markPlaceholdersInEditor])

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

    const savingState = externalIsSaving !== undefined
    if (!savingState) {
      setIsSaving(true)
    }

    try {
      const html = editor.getHTML()
      if (onSave) {
        await onSave(html, placeholderMetadata)
        if (!savingState) {
          toast({
            title: "保存成功",
            description: "模板内容已保存",
          })
        }
      }
    } catch (error) {
      if (!savingState) {
        handleApiError(error, "模板保存失败")
      }
      throw error // 重新抛出错误，让父组件处理
    } finally {
      if (!savingState) {
        setIsSaving(false)
      }
    }
  }

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    save: handleSave,
  }))

  // 插入占位符
  const handleInsertPlaceholder = () => {
    setPlaceholderName("")
    setPlaceholderNameError("")
    setEditingPlaceholderName(null) // 新插入的占位符
    setShowPlaceholderDialog(true)
  }

  // 编辑现有占位符时，设置占位符名称
  useEffect(() => {
    if (editingPlaceholderName && showPlaceholderDialog) {
      setPlaceholderName(editingPlaceholderName)
    }
  }, [editingPlaceholderName, showPlaceholderDialog])

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
    
    // 如果是新插入的占位符，插入到编辑器
    if (editingPlaceholderName === null) {
      if (editor) {
        editor.chain().focus().insertContent(`{{${name}}}`).run()
        // 标记新插入的占位符
        setTimeout(() => {
          markPlaceholdersInEditor(editor)
        }, 50)
      }
    } else {
      // 如果是编辑现有占位符，只需要更新元数据，占位符已经在编辑器中了
      // 重新标记占位符以确保样式正确
      setTimeout(() => {
        markPlaceholdersInEditor(editor)
      }, 50)
    }
    
    setShowPlaceholderDialog(false)
    setPlaceholderName("")
    setPlaceholderNameError("")
    setEditingPlaceholderName(null)
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
                  if (!editingPlaceholderName) {
                    // 只有新插入时才允许修改名称
                    setPlaceholderName(e.target.value)
                    setPlaceholderNameError("")
                  }
                }}
                placeholder="例如: client_name"
                disabled={!!editingPlaceholderName}
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
              validatePlaceholderName(placeholderName.trim()) && (
                <PlaceholderConfig
                  placeholderName={placeholderName.trim()}
                  metadata={placeholderMetadata[placeholderName.trim()]}
                  onSave={handleSavePlaceholderConfig}
                  onCancel={() => {
                    setShowPlaceholderDialog(false)
                    setPlaceholderName("")
                    setPlaceholderNameError("")
                    setEditingPlaceholderName(null)
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
})

TemplateEditor.displayName = "TemplateEditor"

