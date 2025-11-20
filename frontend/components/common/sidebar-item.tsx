import React from "react"
import { cn } from "@/lib/utils"

interface SidebarItemProps {
  id?: string | number
  selected?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
  
  // Content Slots
  title: React.ReactNode
  description?: React.ReactNode
  meta?: React.ReactNode
  
  // Action Slots
  actions?: React.ReactNode
  status?: React.ReactNode
  
  // Event handlers
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
}

export function SidebarItem({
  selected,
  onClick,
  className,
  title,
  description,
  meta,
  actions,
  status,
  onMouseEnter,
  onMouseLeave,
}: SidebarItemProps) {
  return (
    <div
      className={cn(
        "w-full max-w-full p-2 rounded-lg border text-left transition-all duration-200 hover:shadow-md group cursor-pointer",
        selected
          ? "border-blue-500 shadow-md ring-2 ring-blue-200 bg-blue-50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
        className
      )}
      style={{
        width: "var(--editor-sidebar-card-width, 100%)",
        maxWidth: "100%",
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="grid w-full gap-1.5 items-start"
        style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}
      >
        {/* Content Area */}
        <div className="min-w-0 overflow-hidden">
          {/* Title */}
          <div className="mb-0.5">
            {typeof title === 'string' ? (
              <h4 className={cn(
                "text-[11px] font-medium truncate leading-tight",
                selected ? "text-blue-700" : "text-slate-700"
              )}>
                {title}
              </h4>
            ) : (
              title
            )}
          </div>

          {/* Description */}
          {description && (
            <div className="mb-1">
              <div className={cn(
                "text-[10px] leading-tight line-clamp-2",
                selected ? "text-blue-600/80" : "text-slate-500"
              )}>
                {description}
              </div>
            </div>
          )}

          {/* Metadata */}
          {meta && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 min-w-0 overflow-hidden flex-wrap leading-tight">
              {meta}
            </div>
          )}
        </div>

        {/* Actions and Status Area */}
        <div className="flex flex-col items-end justify-between gap-1 h-full min-w-[80px]">
          {/* Actions (Top Right) */}
          <div className="flex flex-wrap gap-0.5 justify-end w-full -mr-1">
            {actions}
          </div>

          {/* Status (Bottom Right) */}
          {status && (
            <div className="mt-auto w-full flex justify-end pt-0.5">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

