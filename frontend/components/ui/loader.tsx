"use client"

import { Loader2 } from "lucide-react"

export function FullPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-sm text-muted-foreground">加载中，请稍候...</p>
    </div>
  )
}
