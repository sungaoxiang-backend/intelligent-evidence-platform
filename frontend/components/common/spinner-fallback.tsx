"use client"

export function SpinnerFallback() {
  return (
    <div className="flex items-center justify-center py-8 w-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
} 