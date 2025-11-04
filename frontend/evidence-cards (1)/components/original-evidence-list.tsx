"use client"

import type React from "react"

import { CheckCircle2, Circle, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import type { OriginalEvidence } from "@/app/page"

interface OriginalEvidenceListProps {
  evidences: OriginalEvidence[]
  onSelect: (evidence: any) => void
  selectedId?: string
  multiSelectMode: boolean
  selectedItems: Set<string>
  onToggleSelect: (id: string) => void
  onZoomImage: (image: { src: string; alt: string }) => void
  showDragHandles?: boolean
}

export function OriginalEvidenceList({
  evidences,
  onSelect,
  selectedId,
  multiSelectMode,
  selectedItems,
  onToggleSelect,
  onZoomImage,
  showDragHandles = false,
}: OriginalEvidenceListProps) {
  const handleClick = (evidence: any) => {
    if (multiSelectMode) {
      onToggleSelect(evidence.id)
    } else {
      onSelect({ ...evidence, source: "original" })
    }
  }

  const handleDragStart = (e: React.DragEvent, evidence: any) => {
    e.dataTransfer.setData("evidenceId", evidence.id)
    e.dataTransfer.setData("evidenceType", "original")
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div className="p-3 space-y-2.5">
      {evidences.map((evidence) => {
        const isSelected = multiSelectMode ? selectedItems.has(evidence.id) : selectedId === evidence.id

        return (
          <button
            key={evidence.id}
            onClick={() => handleClick(evidence)}
            draggable={!multiSelectMode}
            onDragStart={(e) => handleDragStart(e, evidence)}
            className={cn(
              "w-full p-3 rounded-xl border text-left transition-all duration-200 hover:shadow-lg group relative overflow-hidden",
              isSelected
                ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
                : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
              !multiSelectMode && "cursor-grab active:cursor-grabbing",
            )}
          >
            {isSelected && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
            )}

            <div className="flex items-center gap-3">
              {!multiSelectMode && showDragHandles && (
                <div className="text-slate-400 group-hover:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                  <GripVertical className="h-4 w-4" />
                </div>
              )}

              <div className="relative flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    onZoomImage({ src: evidence.thumbnail, alt: evidence.name })
                  }}
                >
                  <Image
                    src={evidence.thumbnail || "/placeholder.svg"}
                    alt={evidence.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                {multiSelectMode && (
                  <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow-md">
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-blue-600 fill-blue-600" strokeWidth={0} />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">证据ID</span>
                    <span className="text-xs font-mono text-blue-600 font-semibold">#{evidence.id}</span>
                  </div>
                  <Badge
                    variant={evidence.forged ? "default" : "secondary"}
                    className={cn(
                      "text-xs flex-shrink-0 font-medium",
                      evidence.forged ? "bg-green-500 hover:bg-green-600 text-white" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {evidence.forged ? "已铸造" : "未铸造"}
                  </Badge>
                </div>

                <p className="text-sm font-medium text-slate-900 truncate mb-1">{evidence.name}</p>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{evidence.size}</span>
                  <span>•</span>
                  <span>{evidence.date}</span>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
