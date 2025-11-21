"use client"

import React, { useEffect, useMemo, useRef, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
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
  ListPlus,
  Plus,
  Loader2,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  HeadingWithAttrs,
  ParagraphWithAttrs,
  TableCellWithAttrs,
  TableWithAttrs,
  templateBaseStyles,
} from "./extensions"
import { normalizeHardBreaks } from "./utils"
import { PlaceholderExtension, placeholderPluginKey, requestPlaceholderRefresh } from "./placeholder-extension"
import {
  usePlaceholderManager,
  usePlaceholderDocumentBridge,
  type PlaceholderPayload,
  type PlaceholderPosition,
  type PlaceholderMeta,
} from "./placeholder-manager"
import {
  PlaceholderFormFields,
  PlaceholderFormState,
  createEmptyPlaceholderForm,
  normalizePlaceholderOptions,
  isValidFieldKey,
  buildFormStateFromMeta,
} from "./placeholder-form"
import { useToast } from "@/hooks/use-toast"

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

interface ToolbarProps {
  editor: TiptapEditor | null
  placeholderOptions: PlaceholderMeta[]
  onInsertPlaceholder: (fieldKey: string) => Promise<void>
  onCreatePlaceholder: () => void
  isBusy?: boolean
}

const Toolbar = ({
  editor,
  placeholderOptions,
  onInsertPlaceholder,
  onCreatePlaceholder,
  isBusy,
}: ToolbarProps) => {
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
        <PlaceholderPicker
          placeholders={placeholderOptions}
          onInsert={onInsertPlaceholder}
          onCreate={onCreatePlaceholder}
          disabled={isBusy}
        />
      </div>
    </div>
  )
}
interface PlaceholderPickerProps {
  placeholders: PlaceholderMeta[]
  onInsert: (fieldKey: string) => Promise<void>
  onCreate: () => void
  disabled?: boolean
}

const PlaceholderPicker = ({
  placeholders,
  onInsert,
  onCreate,
  disabled,
}: PlaceholderPickerProps) => {
  const [open, setOpen] = useState(false)
  const [isInserting, setIsInserting] = useState(false)

  const handleInsert = async (fieldKey: string) => {
    setIsInserting(true)
    try {
      await onInsert(fieldKey)
      setOpen(false)
    } finally {
      setIsInserting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={(value) => !disabled && setOpen(value)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 flex items-center gap-2"
          disabled={disabled}
        >
          <ListPlus className="h-4 w-4" />
          占位符
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command>
          <CommandInput placeholder="搜索占位符..." />
          <CommandList>
            <CommandEmpty>没有匹配的占位符</CommandEmpty>
            <CommandGroup heading="已配置占位符">
              {placeholders.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  暂无可用占位符
                </div>
              ) : (
                placeholders.map((item) => (
                  <CommandItem
                    key={`${item.fieldKey}-${item.id}`}
                    onSelect={() => handleInsert(item.fieldKey)}
                    disabled={isInserting}
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-medium text-slate-900">{item.label}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {"{{"}
                        {item.fieldKey}
                        {"}}"}
                      </span>
                    </div>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
          <div className="border-t border-slate-100 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-blue-600"
              onClick={() => {
                setOpen(false)
                onCreate()
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新建占位符
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function DocumentEditor({
  initialContent,
  onChange,
  isLoading,
}: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const contentSetRef = useRef(false)
  const placeholderManager = usePlaceholderManager()
  const placeholderManagerRef = useRef(placeholderManager)
  const { toast } = useToast()
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false)
  const [placeholderDialogMode, setPlaceholderDialogMode] = useState<"create" | "edit">("create")
  const [placeholderFormData, setPlaceholderFormData] = useState<PlaceholderFormState>(
    createEmptyPlaceholderForm()
  )
  const [placeholderSubmitting, setPlaceholderSubmitting] = useState(false)
  const [editingPlaceholder, setEditingPlaceholder] = useState<PlaceholderMeta | null>(null)
  const [quickInsertOpen, setQuickInsertOpen] = useState(false)
  const [quickInsertCoords, setQuickInsertCoords] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  })
  const [quickInsertQuery, setQuickInsertQuery] = useState("")
  const selectablePlaceholders = useMemo(
    () => placeholderManager.orderedPlaceholders.filter((meta) => meta.backendMeta),
    [placeholderManager.orderedPlaceholders]
  )
  const guessFieldKey = useCallback((text: string) => {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
    if (!normalized) return ""
    if (/^[0-9]/.test(normalized)) {
      return `field_${normalized}`
    }
    return normalized
  }, [])

  const openEditPlaceholderDialog = useCallback((meta: PlaceholderMeta) => {
    setEditingPlaceholder(meta)
    setPlaceholderFormData(buildFormStateFromMeta(meta))
    setPlaceholderDialogMode("edit")
    setPlaceholderDialogOpen(true)
  }, [])

  const handlePlaceholderDialogClose = useCallback(() => {
    if (placeholderSubmitting) return
    setPlaceholderDialogOpen(false)
    setEditingPlaceholder(null)
    setPlaceholderFormData(createEmptyPlaceholderForm())
  }, [placeholderSubmitting])

  const handlePlaceholderSubmit = useCallback(async () => {
    if (!placeholderFormData.fieldKey.trim()) {
      toast({
        title: "请输入字段标识",
        variant: "destructive",
      })
      return
    }
    if (!isValidFieldKey(placeholderFormData.fieldKey.trim())) {
      toast({
        title: "字段标识格式错误",
        description: "仅允许字母、数字、点、横线、下划线，且需以字母或下划线开头",
        variant: "destructive",
      })
      return
    }
    setPlaceholderSubmitting(true)
    const normalizedOptions = normalizePlaceholderOptions(placeholderFormData)
    const payload: PlaceholderPayload = {
      name: placeholderFormData.fieldKey.trim(),
      type: placeholderFormData.type,
      options: normalizedOptions.length ? normalizedOptions : undefined,
    }
    try {
      if (placeholderDialogMode === "create") {
        await placeholderManager.createPlaceholder(payload, { insertIntoDocument: true })
        toast({
          title: "占位符已创建",
          description: `已插入 {{${payload.name}}}`,
        })
      } else if (editingPlaceholder) {
        await placeholderManager.updatePlaceholder(editingPlaceholder.fieldKey, payload)
        toast({
          title: "占位符已更新",
          description: `已更新 ${payload.name}`,
        })
      }
      handlePlaceholderDialogClose()
    } catch (error: any) {
      toast({
        title: placeholderDialogMode === "create" ? "创建失败" : "更新失败",
        description: error?.message || "请稍后再试",
        variant: "destructive",
      })
    } finally {
      setPlaceholderSubmitting(false)
    }
  }, [
    editingPlaceholder,
    handlePlaceholderDialogClose,
    placeholderDialogMode,
    placeholderFormData,
    placeholderManager,
    toast,
  ])

  const handleDetachPlaceholder = useCallback(
    async (fieldKey: string) => {
      try {
        await placeholderManager.detachPlaceholder(fieldKey)
        toast({
          title: "已移除引用",
          description: `当前模板不再包含 {{${fieldKey}}}`,
        })
      } catch (error: any) {
        toast({
          title: "移除失败",
          description: error?.message || "请稍后再试",
          variant: "destructive",
        })
      }
    },
    [placeholderManager, toast]
  )

  const handlePlaceholderChipClick = useCallback(
    (id: string) => {
      const meta = placeholderManagerRef.current.placeholders[id]
      if (meta) {
        placeholderManagerRef.current.selectPlaceholder(meta.id)
        openEditPlaceholderDialog(meta)
      }
    },
    [openEditPlaceholderDialog]
  )

  const handleInlinePlaceholderDelete = useCallback(
    ({ fieldKey }: { fieldKey: string }) => {
      handleDetachPlaceholder(fieldKey)
    },
    [handleDetachPlaceholder]
  )

  useEffect(() => {
    placeholderManagerRef.current = placeholderManager
  }, [placeholderManager])

  const normalizeContent = (content?: JSONContent | null) => {
    if (!content) return content
    return normalizeHardBreaks(
      JSON.parse(JSON.stringify(content))
    )
  }

  const placeholderSignature = useMemo(() => {
    return (
      placeholderManager.orderedPlaceholders
        ?.map((item) => `${item.id}:${item.status}`)
        .join("|") || ""
    )
  }, [placeholderManager.orderedPlaceholders])

  const placeholderExtension = useMemo(
    () =>
      PlaceholderExtension.configure({
        getPlaceholderMetaById: (id: string) =>
          placeholderManagerRef.current.placeholders[id],
        onPlaceholderClick: handlePlaceholderChipClick,
        onPlaceholderHover: (id: string | null) =>
          placeholderManagerRef.current.highlightPlaceholder(id),
        onPlaceholderSelect: (id: string) =>
          placeholderManagerRef.current.selectPlaceholder(id),
        onPlaceholderDelete: ({ fieldKey }) => handleInlinePlaceholderDelete({ fieldKey }),
        getSelectedId: () => placeholderManagerRef.current.selectedId,
        getHighlightedId: () =>
          placeholderManagerRef.current.highlightedId,
      }),
    [handleInlinePlaceholderDelete, handlePlaceholderChipClick]
  )

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
      placeholderExtension,
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
          placeholderManagerRef.current.syncFromDoc(normalized)
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

  const closeQuickInsert = useCallback(() => {
    setQuickInsertOpen(false)
    setQuickInsertQuery("")
    editor?.commands.focus(undefined, { scrollIntoView: false })
  }, [editor])

  const openQuickInsert = useCallback(
    (coords: { left: number; top: number }) => {
      setQuickInsertCoords(coords)
      setQuickInsertOpen(true)
      setQuickInsertQuery("")
      editor?.commands.blur()
    },
    [editor]
  )

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom as HTMLElement

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "@"
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !quickInsertOpen
      ) {
        event.preventDefault()
        if (!editor.state.selection.empty) {
          editor.commands.setTextSelection(editor.state.selection.to)
        }
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        openQuickInsert({ left: coords.left, top: coords.bottom + 8 })
        return
      }

      if (event.key === "Escape" && quickInsertOpen) {
        event.preventDefault()
        closeQuickInsert()
      }
    }

    dom.addEventListener("keydown", handleKeyDown)
    return () => {
      dom.removeEventListener("keydown", handleKeyDown)
    }
  }, [editor, closeQuickInsert, openQuickInsert, quickInsertOpen])

  const openCreatePlaceholderDialog = useCallback(() => {
    const selectionText =
      editor?.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to
      ).trim() ?? ""
    const suggestedKey = guessFieldKey(selectionText)
    setPlaceholderFormData({
      ...createEmptyPlaceholderForm(),
      label: selectionText,
      fieldKey: suggestedKey,
    })
    setEditingPlaceholder(null)
    setPlaceholderDialogMode("create")
    setPlaceholderDialogOpen(true)
  }, [editor, guessFieldKey])

  const insertPlaceholderAtSelection = useCallback(
    async (payload: PlaceholderPayload) => {
      if (!editor) return
      const placeholderText = `{{${payload.name}}}`
      editor.chain().focus(undefined, { scrollIntoView: false }).insertContent(placeholderText).run()
    },
    [editor]
  )

  const handleInsertExisting = useCallback(
    async (fieldKey: string) => {
      try {
        await placeholderManager.ensureAssociation(fieldKey)
        await insertPlaceholderAtSelection({ name: fieldKey, type: "text" })
        requestPlaceholderRefresh(editor)
        toast({
          title: "已插入占位符",
          description: `{{${fieldKey}}}`,
        })
      } catch (error: any) {
        toast({
          title: "插入失败",
          description: error?.message || "请稍后再试",
          variant: "destructive",
        })
      }
    },
    [editor, insertPlaceholderAtSelection, placeholderManager, toast]
  )

  const findPlaceholderRangesInDoc = useCallback(
    (fieldKey: string): Array<{ from: number; to: number }> => {
      if (!editor) return []
      const ranges: Array<{ from: number; to: number }> = []
      const placeholderText = `{{${fieldKey}}}`
      
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return
        let index = 0
        while (true) {
          const found = node.text.indexOf(placeholderText, index)
          if (found === -1) break
          const from = pos + found
          const to = from + placeholderText.length
          ranges.push({ from, to })
          index = found + 1
        }
      })
      
      return ranges
    },
    [editor]
  )

  const getPlaceholderRanges = useCallback(
    (fieldKey: string): PlaceholderPosition[] =>
      placeholderManager.orderedPlaceholders
        .filter((meta) => meta.fieldKey === fieldKey && meta.position)
        .map((meta) => meta.position as PlaceholderPosition),
    [placeholderManager.orderedPlaceholders]
  )

  const applyRanges = useCallback(
    (ranges: Array<{ from: number; to: number }>, replacement: string | null) => {
      if (!editor || ranges.length === 0) return
      let tr = editor.state.tr
      // 从后往前删除，避免位置偏移
      const sorted = [...ranges].sort((a, b) => b.from - a.from)
      sorted.forEach(({ from, to }) => {
        if (replacement === null) {
          tr = tr.delete(from, to)
        } else {
          tr = tr.insertText(replacement, from, to)
        }
      })
      if (tr.docChanged) {
        editor.view.dispatch(tr)
        // 删除后刷新占位符状态
        requestPlaceholderRefresh(editor)
      }
    },
    [editor]
  )

  const renamePlaceholderBlocks = useCallback(
    async (oldFieldKey: string, payload: PlaceholderPayload) => {
      const newName = payload.name?.trim()
      if (!newName) return
      const ranges = findPlaceholderRangesInDoc(oldFieldKey)
      applyRanges(ranges, `{{${newName}}}`)
    },
    [applyRanges, findPlaceholderRangesInDoc]
  )

  const removePlaceholderBlocks = useCallback(
    async (fieldKey: string) => {
      const ranges = findPlaceholderRangesInDoc(fieldKey)
      applyRanges(ranges, null)
    },
    [applyRanges, findPlaceholderRangesInDoc]
  )

  usePlaceholderDocumentBridge(
    useMemo(
      () => ({
        insert: insertPlaceholderAtSelection,
        rename: renamePlaceholderBlocks,
        remove: removePlaceholderBlocks,
      }),
      [insertPlaceholderAtSelection, renamePlaceholderBlocks, removePlaceholderBlocks]
    )
  )

  const paragraphAttrs = editor?.getAttributes("paragraph") ?? {}
  const spacingAttrs = paragraphAttrs.spacing ?? {}
  const textStyleAttrs = editor?.getAttributes("textStyle") ?? {}

  const updateTextStyle = (attrs: Record<string, string>) => {
    if (!editor) return
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setMark("textStyle", { ...textStyleAttrs, ...attrs })
      .run()
  }

  const updateParagraphAttrs = (attrs: Record<string, unknown>) => {
    if (!editor) return
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateAttributes("paragraph", { ...paragraphAttrs, ...attrs })
      .run()
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
      if (normalized) {
        placeholderManager.syncFromDoc(normalized)
      }
    }
  }, [editor, initialContent, isLoading, placeholderManager])

  useEffect(() => {
    if (!editor) return
    requestPlaceholderRefresh(editor)
  }, [
    editor,
    placeholderSignature,
    placeholderManager.selectedId,
    placeholderManager.highlightedId,
  ])

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
    <>
    <div className="w-full border border-gray-300 rounded-md bg-white">
      <Toolbar
        editor={editor}
        placeholderOptions={selectablePlaceholders}
        onInsertPlaceholder={handleInsertExisting}
        onCreatePlaceholder={openCreatePlaceholderDialog}
        isBusy={placeholderManager.isMutating}
      />
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
    {quickInsertOpen &&
      typeof document !== "undefined" &&
      createPortal(
        <QuickInsertPanel
          coords={quickInsertCoords}
          query={quickInsertQuery}
          onQueryChange={setQuickInsertQuery}
          placeholders={selectablePlaceholders}
          onSelect={async (fieldKey) => {
            closeQuickInsert()
            await handleInsertExisting(fieldKey)
          }}
          onCreate={() => {
            closeQuickInsert()
            openCreatePlaceholderDialog()
          }}
          onClose={closeQuickInsert}
          isBusy={placeholderManager.isMutating}
        />,
        document.body
      )}
    <Dialog
      open={placeholderDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          handlePlaceholderDialogClose()
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{placeholderDialogMode === "create" ? "新建占位符" : "编辑占位符"}</DialogTitle>
          <DialogDescription>
            {placeholderDialogMode === "create"
              ? "配置占位符元数据，保存后将插入光标所在位置"
              : "更新占位符配置，并同步应用到当前文档"}
          </DialogDescription>
        </DialogHeader>
        <PlaceholderFormFields
          formId="editor-placeholder"
          formData={placeholderFormData}
          onChange={setPlaceholderFormData}
          disabled={placeholderSubmitting}
        />
        <DialogFooter>
          <Button variant="outline" onClick={handlePlaceholderDialogClose} disabled={placeholderSubmitting}>
            取消
          </Button>
          <Button onClick={handlePlaceholderSubmit} disabled={placeholderSubmitting}>
            {placeholderSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

interface QuickInsertPanelProps {
  coords: { left: number; top: number }
  query: string
  onQueryChange: (value: string) => void
  placeholders: PlaceholderMeta[]
  onSelect: (fieldKey: string) => void
  onCreate: () => void
  onClose: () => void
  isBusy?: boolean
}

const QuickInsertPanel = ({
  coords,
  query,
  onQueryChange,
  placeholders,
  onSelect,
  onCreate,
  onClose,
  isBusy,
}: QuickInsertPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.focus()
    inputRef.current.select()
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return placeholders
    const keyword = query.trim().toLowerCase()
    return placeholders.filter((item) => {
      const haystack = `${item.label ?? ""}${item.fieldKey}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [placeholders, query])

  return (
    <div
      ref={containerRef}
      className="z-50 w-72 rounded-md border border-slate-200 bg-white shadow-lg"
      style={{ position: "fixed", left: coords.left, top: coords.top }}
    >
      <Command>
        <CommandInput
          ref={inputRef}
          placeholder="搜索占位符..."
          value={query}
          onValueChange={onQueryChange}
        />
        <CommandList className="max-h-56">
          <CommandEmpty>没有匹配的占位符</CommandEmpty>
          <CommandGroup heading="占位符">
            {filtered.map((item) => (
              <CommandItem
                key={`${item.fieldKey}-${item.id}`}
                onSelect={() => !isBusy && onSelect(item.fieldKey)}
                disabled={isBusy}
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-900">{item.label}</span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {"{{"}
                    {item.fieldKey}
                    {"}}"}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        <div className="border-t border-slate-100 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-blue-600"
            onClick={() => !isBusy && onCreate()}
            disabled={isBusy}
          >
            <Plus className="h-4 w-4 mr-1" />
            新建占位符
          </Button>
        </div>
      </Command>
    </div>
  )
}