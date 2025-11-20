import { useEffect, useRef, useState, useCallback } from "react"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export interface UseAutoSaveOptions {
  onSave: (data: any) => Promise<void>
  delay?: number // 防抖延迟，默认 2000ms
  enabled?: boolean // 是否启用自动保存
}

export interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  saveError: string | null
  triggerSave: (data: any) => Promise<void>
  resetStatus: () => void
}

/**
 * 自动保存 Hook
 * 提供防抖保存功能，监听数据变化并自动保存
 */
export function useAutoSave({
  onSave,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingDataRef = useRef<any>(null)
  const isSavingRef = useRef(false)

  // 清理定时器
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // 执行保存
  const performSave = useCallback(async (data: any) => {
    if (isSavingRef.current) {
      // 如果正在保存，将新数据标记为待保存
      pendingDataRef.current = data
      return
    }

    try {
      isSavingRef.current = true
      setSaveStatus("saving")
      setSaveError(null)

      await onSave(data)

      setSaveStatus("saved")
      
      // 保存成功后，如果有待保存的数据，继续保存
      if (pendingDataRef.current) {
        const nextData = pendingDataRef.current
        pendingDataRef.current = null
        // 延迟一下再保存，避免频繁保存
        setTimeout(() => performSave(nextData), 500)
      } else {
        // 3 秒后将状态重置为 idle
        setTimeout(() => {
          setSaveStatus((current) => (current === "saved" ? "idle" : current))
        }, 3000)
      }
    } catch (error) {
      console.error("自动保存失败:", error)
      setSaveStatus("error")
      setSaveError(error instanceof Error ? error.message : "保存失败")
      
      // 5 秒后重置错误状态
      setTimeout(() => {
        setSaveStatus("idle")
        setSaveError(null)
      }, 5000)
    } finally {
      isSavingRef.current = false
    }
  }, [onSave])

  // 触发保存（带防抖）
  const triggerSave = useCallback(
    async (data: any) => {
      if (!enabled) {
        return
      }

      // 清除之前的定时器
      clearTimer()

      // 设置新的定时器
      timeoutRef.current = setTimeout(() => {
        performSave(data)
      }, delay)
    },
    [enabled, delay, clearTimer, performSave]
  )

  // 重置状态
  const resetStatus = useCallback(() => {
    setSaveStatus("idle")
    setSaveError(null)
    clearTimer()
  }, [clearTimer])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return {
    saveStatus,
    saveError,
    triggerSave,
    resetStatus,
  }
}

/**
 * 保存状态显示组件辅助函数
 */
export function getSaveStatusText(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "保存中..."
    case "saved":
      return "已保存"
    case "error":
      return "保存失败"
    case "idle":
    default:
      return ""
  }
}

export function getSaveStatusVariant(
  status: SaveStatus
): "default" | "secondary" | "destructive" {
  switch (status) {
    case "saving":
      return "secondary"
    case "saved":
      return "default"
    case "error":
      return "destructive"
    case "idle":
    default:
      return "secondary"
  }
}

