"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SpacingPreset {
  label: string
  value: number
  description: string
}

interface LineSpacingControlProps {
  currentSpacing: number
  onSpacingChange: (spacing: number) => void
  className?: string
}

const spacingPresets: SpacingPreset[] = [
  {
    label: "单倍行距",
    value: 1.0,
    description: "1.0"
  },
  {
    label: "1.15倍行距",
    value: 1.15,
    description: "1.15"
  },
  {
    label: "1.5倍行距",
    value: 1.5,
    description: "1.5"
  },
  {
    label: "1.75倍行距",
    value: 1.75,
    description: "1.75"
  },
  {
    label: "双倍行距",
    value: 2.0,
    description: "2.0"
  }
]

export function LineSpacingControl({
  currentSpacing,
  onSpacingChange,
  className
}: LineSpacingControlProps) {
  const currentPreset = spacingPresets.find(preset => preset.value === currentSpacing) || spacingPresets[2]

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 flex items-center gap-1 text-sm"
            title="行间距设置"
          >
            <span>行间距</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {spacingPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => onSpacingChange(preset.value)}
              className={cn(
                "flex flex-col items-start py-2",
                preset.value === currentSpacing && "bg-gray-100"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs text-gray-500">{preset.description}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default LineSpacingControl