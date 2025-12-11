"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MarginPreset {
  label: string
  value: number
  description: string
}

interface PageMarginControlProps {
  currentMargin: number
  onMarginChange: (margin: number) => void
  className?: string
}

const marginPresets: MarginPreset[] = [
  {
    label: "窄边距",
    value: 12.7, // 0.5 inch
    description: "12.7mm"
  },
  {
    label: "适中边距",
    value: 19.05, // 0.75 inch
    description: "19.05mm"
  },
  {
    label: "正常边距",
    value: 25.4, // 1 inch (default)
    description: "25.4mm"
  },
  {
    label: "宽边距",
    value: 38.1, // 1.5 inch
    description: "38.1mm"
  }
]

export function PageMarginControl({
  currentMargin,
  onMarginChange,
  className
}: PageMarginControlProps) {
  const currentPreset = marginPresets.find(preset => preset.value === currentMargin) || marginPresets[2]

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 flex items-center gap-1 text-sm"
            title="页边距设置"
          >
            <span>页边距</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          {marginPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.value}
              onClick={() => onMarginChange(preset.value)}
              className={cn(
                "flex flex-col items-start py-2",
                preset.value === currentMargin && "bg-gray-100"
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

export default PageMarginControl