"use client"

import type React from "react"
import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface CardSlot {
  id: string
  name: string
  category: string
  description: string
  filled: boolean
  cardId?: string
  side?: "creditor" | "debtor" | "shared"
}

export function CardSlots() {
  const [slots, setSlots] = useState<CardSlot[]>([
    {
      id: "slot-creditor-id",
      name: "债权人身份证明",
      category: "身份证",
      description: "拖入债权人身份证卡片",
      filled: false,
      side: "creditor",
    },
    {
      id: "slot-debtor-id",
      name: "债务人身份证明",
      category: "身份证",
      description: "拖入债务人身份证卡片",
      filled: false,
      side: "debtor",
    },
    {
      id: "slot-chat-records",
      name: "微信聊天记录",
      category: "微信聊天记录",
      description: "拖入微信聊天记录卡片",
      filled: false,
      side: "shared",
    },
    {
      id: "slot-creditor-business",
      name: "债权人营业执照",
      category: "营业执照",
      description: "拖入债权人营业执照卡片",
      filled: false,
      side: "creditor",
    },
    {
      id: "slot-debtor-business",
      name: "债务人营业执照",
      category: "营业执照",
      description: "拖入债务人营业执照卡片",
      filled: false,
      side: "debtor",
    },
  ])

  const [dragOverSlot, setDragOverSlot] = useState<{ id: string; isValid: boolean } | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent, slot: CardSlot) => {
    e.preventDefault()
    const cardCategory = e.dataTransfer.getData("cardCategory")
    const evidenceType = e.dataTransfer.getData("evidenceType")

    if (evidenceType !== "card") {
      setDragOverSlot({ id: slot.id, isValid: false })
      return
    }

    const isValid = cardCategory === slot.category
    setDragOverSlot({ id: slot.id, isValid })
    e.dataTransfer.dropEffect = isValid ? "move" : "none"
  }

  const handleDrop = (e: React.DragEvent, slot: CardSlot) => {
    e.preventDefault()
    const cardId = e.dataTransfer.getData("cardId")
    const cardCategory = e.dataTransfer.getData("cardCategory")
    const evidenceType = e.dataTransfer.getData("evidenceType")

    if (evidenceType !== "card") {
      setDragOverSlot(null)
      return
    }

    const isValid = cardCategory === slot.category

    if (isValid) {
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, filled: true, cardId } : s)))
      console.log("[v0] Card dropped successfully:", { slotId: slot.id, cardId, category: cardCategory })
    } else {
      console.log("[v0] Invalid card drop:", { slotCategory: slot.category, cardCategory })
    }

    setDragOverSlot(null)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleRemoveCard = (slotId: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, filled: false, cardId: undefined } : s)))
  }

  const getSlotIcon = (category: string) => {
    switch (category) {
      case "身份证":
        return X
      case "微信聊天记录":
        return X
      case "营业执照":
        return X
      default:
        return X
    }
  }

  const identitySlots = slots.filter((s) => s.category === "身份证")
  const businessSlots = slots.filter((s) => s.category === "营业执照")
  const sharedSlots = slots.filter((s) => s.side === "shared")

  const renderSlot = (slot: CardSlot) => {
    const isDragOver = dragOverSlot?.id === slot.id
    const isValidDrop = dragOverSlot?.isValid ?? false
    const isHovered = hoveredSlot === slot.id

    const getSlotBackground = () => {
      if (slot.filled) {
        return "bg-green-50"
      }
      if (isDragOver && isValidDrop) {
        return "bg-green-100"
      }
      if (isDragOver && !isValidDrop) {
        return "bg-red-50"
      }
      // Adversarial party colors: blue for creditor, amber for debtor
      if (slot.side === "creditor") {
        return "bg-blue-50/50 hover:bg-blue-100/70"
      }
      if (slot.side === "debtor") {
        return "bg-amber-50/50 hover:bg-amber-100/70"
      }
      return "bg-slate-50 hover:bg-slate-100"
    }

    const getBorderColor = () => {
      if (slot.filled) {
        return "border-green-500"
      }
      if (isDragOver && isValidDrop) {
        return "border-green-500 ring-2 ring-green-300"
      }
      if (isDragOver && !isValidDrop) {
        return "border-red-500 ring-2 ring-red-300"
      }
      if (slot.side === "creditor") {
        return "border-blue-300"
      }
      if (slot.side === "debtor") {
        return "border-amber-300"
      }
      return "border-slate-300"
    }

    return (
      <div
        key={slot.id}
        onDragOver={(e) => handleDragOver(e, slot)}
        onDrop={(e) => handleDrop(e, slot)}
        onDragLeave={handleDragLeave}
        onMouseEnter={() => setHoveredSlot(slot.id)}
        onMouseLeave={() => setHoveredSlot(null)}
        className={cn(
          "rounded-lg transition-all duration-200 relative overflow-hidden",
          "h-32 flex flex-col items-center justify-center p-2.5",
          "border-2",
          getSlotBackground(),
          getBorderColor(),
          !slot.filled && "border-dashed",
          isDragOver && isValidDrop && "scale-105",
        )}
      >
        {slot.filled && isHovered && (
          <button
            onClick={() => handleRemoveCard(slot.id)}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md transition-all z-10"
          >
            <X className="h-3 w-3 text-white" strokeWidth={2.5} />
          </button>
        )}

        {!slot.filled && isDragOver && !isValidDrop && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
            <X className="h-3 w-3 text-white" />
          </div>
        )}

        <div className="flex flex-col items-center justify-center text-center gap-1 w-full">
          {slot.filled ? (
            <>
              <div className="text-xs font-semibold text-slate-900 line-clamp-2 px-1">{slot.name}</div>
              <div className="text-xs text-green-700 font-bold">#{slot.cardId}</div>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-700 line-clamp-2 px-1">{slot.name}</div>
              <div
                className={cn(
                  "text-[10px] transition-colors line-clamp-1 px-1",
                  isDragOver && isValidDrop && "text-green-700 font-semibold",
                  isDragOver && !isValidDrop && "text-red-700 font-semibold",
                  !isDragOver && "text-slate-400",
                )}
              >
                {isDragOver && !isValidDrop ? "类型不匹配" : isDragOver && isValidDrop ? "松开放置" : "拖入卡片"}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2.5">身份证明</h4>
        <div className="grid grid-cols-2 gap-2.5">{identitySlots.map((slot) => renderSlot(slot))}</div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2.5">聊天记录</h4>
        <div className="grid grid-cols-1 gap-2.5">{sharedSlots.map((slot) => renderSlot(slot))}</div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2.5">营业执照</h4>
        <div className="grid grid-cols-2 gap-2.5">{businessSlots.map((slot) => renderSlot(slot))}</div>
      </div>
    </div>
  )
}
