"use client"

import * as React from "react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import type { Editor } from "@tiptap/core"

interface TableContextMenuProps {
  editor: Editor
  children: React.ReactNode
}

export function TableContextMenu({ editor, children }: TableContextMenuProps) {
  if (!editor) {
    return <>{children}</>
  }

  const isInTable = editor.isActive("table")
  const canMerge = editor.can().mergeCells?.() || false
  const canSplit = editor.can().splitCell?.() || false

  if (!isInTable) {
    return <>{children}</>
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => editor.chain().focus().addRowBefore().run()}
          disabled={!editor.can().addRowBefore()}
        >
          在上方插入行
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => editor.chain().focus().addRowAfter().run()}
          disabled={!editor.can().addRowAfter()}
        >
          在下方插入行
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          disabled={!editor.can().addColumnBefore()}
        >
          在左侧插入列
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          disabled={!editor.can().addColumnAfter()}
        >
          在右侧插入列
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => editor.chain().focus().deleteRow().run()}
          disabled={!editor.can().deleteRow()}
        >
          删除行
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => editor.chain().focus().deleteColumn().run()}
          disabled={!editor.can().deleteColumn()}
        >
          删除列
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!canMerge}
        >
          合并单元格
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!canSplit}
        >
          拆分单元格
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

