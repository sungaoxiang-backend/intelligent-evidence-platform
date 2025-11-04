"use client"

import { useEffect, useState } from "react"
import { Hammer, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ForgeNotificationProps {
  show: boolean
  count: number
}

export function ForgeNotification({ show, count }: ForgeNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      setTimeout(() => setIsAnimating(true), 50)

      // Hide after animation completes
      setTimeout(() => {
        setIsAnimating(false)
        setTimeout(() => setIsVisible(false), 300)
      }, 2700)
    }
  }, [show])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-20 right-6 z-50 bg-white rounded-lg shadow-2xl border border-slate-200 p-4 min-w-[280px] transition-all duration-300",
        isAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Hammer
              className={cn(
                "h-5 w-5 text-orange-600 transition-transform duration-500",
                isAnimating && "animate-bounce",
              )}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white">
            <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 text-sm mb-0.5">卡片铸造开始</h4>
          <p className="text-xs text-slate-600">正在铸造 {count} 个证据卡片...</p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-300"
          style={{ width: isAnimating ? "30%" : "0%" }}
        />
      </div>
    </div>
  )
}
