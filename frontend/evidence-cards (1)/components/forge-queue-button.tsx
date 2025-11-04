"use client"

import { Hammer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ForgeQueueButtonProps {
  taskCount: number
  onClick: () => void
}

export function ForgeQueueButton({ taskCount, onClick }: ForgeQueueButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative hover:bg-slate-100 transition-all", taskCount > 0 && "animate-pulse")}
      onClick={onClick}
    >
      <Hammer className="h-5 w-5 text-slate-600" />
      {taskCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-white">
          {taskCount}
        </span>
      )}
    </Button>
  )
}
