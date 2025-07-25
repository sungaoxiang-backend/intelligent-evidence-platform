"use client"
import { ReactNode } from "react"

interface TableToolbarProps {
  selectedCount: number
  children?: ReactNode
}

export function TableToolbar({ selectedCount, children }: TableToolbarProps) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center gap-3 mb-2 bg-muted/20 p-2 rounded-md">
      <span className="text-sm">已选 {selectedCount} 项</span>
      {children}
    </div>
  )
} 