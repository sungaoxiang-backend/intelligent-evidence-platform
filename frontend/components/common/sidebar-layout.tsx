import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarLayoutProps {
  title?: React.ReactNode
  actions?: React.ReactNode
  subheader?: React.ReactNode
  isLoading?: boolean
  isEmpty?: boolean
  emptyState?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function SidebarLayout({
  title,
  actions,
  subheader,
  isLoading,
  isEmpty,
  emptyState,
  className,
  children,
}: SidebarLayoutProps) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader className="pb-1.5 pt-2 px-2 flex-shrink-0">
        <div className="flex items-center justify-between w-full gap-1.5">
          <div className="flex items-center gap-1.5 flex-shrink-0 min-w-0">
            {title}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {actions}
          </div>
        </div>
        {subheader && <div className="mt-2">{subheader}</div>}
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden min-h-0 relative">
        {isLoading && isEmpty ? (
          <div className="flex items-center justify-center p-8 h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty && emptyState ? (
          emptyState
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2 flex flex-col items-center min-w-0 max-w-full overflow-x-hidden">
              {children}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

