import { useState, useCallback } from "react"

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const toggle = useCallback((id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id))
    }
  }, [])

  const toggleAll = useCallback((items: { id: number }[], checked: boolean) => {
    if (checked) {
      setSelectedIds(items.map(item => item.id))
    } else {
      setSelectedIds([])
    }
  }, [])

  return { selectedIds, setSelectedIds, toggle, toggleAll }
} 