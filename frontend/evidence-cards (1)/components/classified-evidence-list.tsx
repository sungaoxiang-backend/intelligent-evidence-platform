"use client"

import type React from "react"

import { useState } from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Save,
  XCircle,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Image from "next/image"
import { Label } from "@/components/ui/label"
import type { ClassifiedEvidence } from "@/app/page"

interface ClassifiedEvidenceListProps {
  evidences: ClassifiedEvidence[]
  onSelect: (evidence: any) => void
  selectedId?: string
  onZoomImage: (image: { src: string; alt: string }) => void
  onDeleteCard: (cardId: string) => void
  expandedCombinedCards: Set<string>
  onExpandedChange: (expanded: Set<string>) => void
  onUpdateCardReferences?: (cardId: string, newReferences: string[]) => void
}

export function ClassifiedEvidenceList({
  evidences,
  onSelect,
  selectedId,
  onZoomImage,
  onDeleteCard,
  expandedCombinedCards,
  onExpandedChange,
  onUpdateCardReferences,
}: ClassifiedEvidenceListProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [editingCard, setEditingCard] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<any>({})
  const [cardReferences, setCardReferences] = useState<Record<string, string[]>>(
    Object.fromEntries(evidences.map((e) => [e.id, e.referencedIds])),
  )
  const [dragOverIndex, setDragOverIndex] = useState<{ cardId: string; index: number } | null>(null)
  const [hoveredRefId, setHoveredRefId] = useState<string | null>(null)
  const [stackedImageIndex, setStackedImageIndex] = useState<Record<string, number>>({})
  const [hoveredCombinedCard, setHoveredCombinedCard] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      const evidence = evidences.find((ev) => ev.id === id)
      if (evidence?.type === "combined") {
        const nextCombined = new Set(expandedCombinedCards)
        if (next.has(id)) {
          nextCombined.add(id)
        } else {
          nextCombined.delete(id)
        }
        onExpandedChange(nextCombined)
      }

      return next
    })
  }

  const startEditing = (evidence: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCard(evidence.id)
    setEditedData({
      category: evidence.category,
      features: { ...evidence.features },
    })
  }

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCard(null)
    setEditedData({})
  }

  const saveEditing = (evidenceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("[v0] Saving edited data for card", evidenceId, editedData)
    setEditingCard(null)
    setEditedData({})
  }

  const handleCategoryChange = (newCategory: string) => {
    const defaultFeatures = getDefaultFeatures(newCategory)
    setEditedData({
      category: newCategory,
      features: defaultFeatures,
    })
  }

  const handleFeatureChange = (key: string, value: string) => {
    setEditedData((prev: any) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      },
    }))
  }

  const getDefaultFeatures = (category: string) => {
    switch (category) {
      case "身份证":
        return {
          name: "",
          gender: "",
          ethnicity: "",
          birthDate: "",
          address: "",
          idNumber: "",
        }
      case "微信聊天记录":
        return {
          wechatName: "",
          debtAmount: "",
          debtAgreement: "",
        }
      case "营业执照":
        return {
          companyName: "",
          creditCode: "",
          legalRepresentative: "",
          companyType: "",
          registeredAddress: "",
        }
      default:
        return {}
    }
  }

  const navigateCombinedImage = (cardId: string, direction: "prev" | "next", totalImages: number) => {
    setStackedImageIndex((prev) => {
      const currentIndex = prev[cardId] || 0
      let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1
      if (newIndex < 0) newIndex = totalImages - 1
      if (newIndex >= totalImages) newIndex = 0
      return { ...prev, [cardId]: newIndex }
    })
  }

  const handleDragStart = (e: React.DragEvent, cardId: string, refId: string, index: number) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("cardId", cardId)
    e.dataTransfer.setData("refId", refId)
    e.dataTransfer.setData("sourceIndex", index.toString())
    e.dataTransfer.setData("dragType", "internal")
    console.log("[v0] Starting internal drag - cardId:", cardId, "refId:", refId, "index:", index)
  }

  const handleDragOver = (e: React.DragEvent, cardId: string, index: number) => {
    e.preventDefault()
    e.stopPropagation()

    const types = Array.from(e.dataTransfer.types)
    const isExternal = types.includes("evidencetype") && !types.includes("dragtype")

    console.log("[v0] Drag over - cardId:", cardId, "index:", index, "types:", types, "isExternal:", isExternal)

    e.dataTransfer.dropEffect = isExternal ? "copy" : "move"
    setDragOverIndex({ cardId, index })
  }

  const handleDrop = (e: React.DragEvent, targetCardId: string, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    console.log("[v0] Drop triggered - targetCardId:", targetCardId, "targetIndex:", targetIndex)

    const dragType = e.dataTransfer.getData("dragType")
    const evidenceId = e.dataTransfer.getData("evidenceId")
    const evidenceType = e.dataTransfer.getData("evidenceType")
    const sourceCardId = e.dataTransfer.getData("cardId")
    const refId = e.dataTransfer.getData("refId")
    const sourceIndex = e.dataTransfer.getData("sourceIndex")

    console.log(
      "[v0] Drop data - dragType:",
      dragType,
      "evidenceType:",
      evidenceType,
      "evidenceId:",
      evidenceId,
      "sourceCardId:",
      sourceCardId,
      "refId:",
      refId,
      "sourceIndex:",
      sourceIndex,
    )

    if (evidenceType === "original" && evidenceId) {
      console.log("[v0] Adding evidence from original list:", evidenceId, "at index:", targetIndex)
      if (!cardReferences[targetCardId].includes(evidenceId)) {
        const refs = [...cardReferences[targetCardId]]
        refs.splice(targetIndex, 0, evidenceId)
        setCardReferences((prev) => ({ ...prev, [targetCardId]: refs }))
        onUpdateCardReferences?.(targetCardId, refs)
      }
    } else if (dragType === "internal" && sourceCardId === targetCardId && sourceIndex && refId) {
      const sourceIdx = Number.parseInt(sourceIndex)
      console.log("[v0] Reordering within card", targetCardId, "from index", sourceIdx, "to", targetIndex)

      if (sourceIdx !== targetIndex) {
        const refs = [...cardReferences[targetCardId]]
        const [removed] = refs.splice(sourceIdx, 1)
        const adjustedIndex = sourceIdx < targetIndex ? targetIndex - 1 : targetIndex
        refs.splice(adjustedIndex, 0, removed)
        setCardReferences((prev) => ({ ...prev, [targetCardId]: refs }))
        onUpdateCardReferences?.(targetCardId, refs)
      }
    }

    setDragOverIndex(null)
  }

  const handleRemoveReference = (cardId: string, refId: string) => {
    console.log("[v0] Removing reference", refId, "from card", cardId)
    const newRefs = cardReferences[cardId].filter((id) => id !== refId)
    setCardReferences((prev) => ({
      ...prev,
      [cardId]: newRefs,
    }))
    onUpdateCardReferences?.(cardId, newRefs)
  }

  const handleCardDragStart = (e: React.DragEvent, evidence: any) => {
    e.dataTransfer.setData("cardId", evidence.id)
    e.dataTransfer.setData("cardCategory", evidence.category)
    e.dataTransfer.setData("evidenceType", "card")
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDeleteClick = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(cardId)
  }

  const confirmDelete = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteCard(cardId)
    setShowDeleteConfirm(null)
    setEditingCard(null)
  }

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(null)
  }

  const toggleCombinedReferences = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })

    // Update parent state for drag handle visibility
    const nextCombined = new Set(expandedCombinedCards)
    if (expandedCards.has(cardId)) {
      nextCombined.delete(cardId)
    } else {
      nextCombined.add(cardId)
    }
    onExpandedChange(nextCombined)
  }

  return (
    <div className="p-3 space-y-3">
      {evidences.map((evidence) => {
        const isExpanded = expandedCards.has(evidence.id)
        const isSelected = selectedId === evidence.id
        const isEditing = editingCard === evidence.id
        const currentRefs = cardReferences[evidence.id] || evidence.referencedIds
        const referencedThumbnails =
          evidence.type === "combined"
            ? (currentRefs.map((refId) => getEvidenceDetails(refId)?.thumbnail).filter(Boolean) as string[])
            : []
        const currentStackIndex = stackedImageIndex[evidence.id] || 0

        const displayCategory = isEditing ? editedData.category : evidence.category
        const displayFeatures = isEditing ? editedData.features : evidence.features

        return (
          <div key={evidence.id}>
            <div
              onClick={() => !isEditing && onSelect({ ...evidence, source: "classified", referencedIds: currentRefs })}
              draggable={!isEditing}
              onDragStart={(e) => handleCardDragStart(e, evidence)}
              className={cn(
                "w-full p-4 rounded-xl border text-left transition-all duration-200 hover:shadow-lg relative overflow-hidden group",
                isSelected
                  ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
                  : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
                isEditing && "ring-2 ring-blue-300 border-blue-400 bg-blue-50/30",
                !isEditing && "cursor-grab active:cursor-grabbing",
              )}
            >
              {isSelected && !isEditing && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
              )}

              <div className="space-y-3">
                {evidence.type === "combined" && referencedThumbnails.length > 0 ? (
                  <div
                    className="w-full aspect-video relative overflow-hidden rounded-lg bg-slate-50 group"
                    onMouseEnter={() => setHoveredCombinedCard(evidence.id)}
                    onMouseLeave={() => setHoveredCombinedCard(null)}
                  >
                    <Image
                      src={referencedThumbnails[currentStackIndex] || "/placeholder.svg"}
                      alt={`${evidence.category} - ${currentStackIndex + 1}`}
                      fill
                      className="object-cover"
                    />

                    {hoveredCombinedCard === evidence.id && referencedThumbnails.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigateCombinedImage(evidence.id, "prev", referencedThumbnails.length)
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-all z-10"
                        >
                          <ChevronLeft className="h-5 w-5 text-slate-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigateCombinedImage(evidence.id, "next", referencedThumbnails.length)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-all z-10"
                        >
                          <ChevronRight className="h-5 w-5 text-slate-700" />
                        </button>
                      </>
                    )}

                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">
                      {currentStackIndex + 1}/{referencedThumbnails.length}
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    onClick={(e) => {
                      e.stopPropagation()
                      onZoomImage({ src: evidence.thumbnail, alt: evidence.category })
                    }}
                  >
                    <Image
                      src={evidence.thumbnail || "/placeholder.svg"}
                      alt={evidence.category}
                      width={400}
                      height={225}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-medium">卡片ID</span>
                      <span className="text-sm font-bold text-blue-600">#{evidence.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {evidence.cardType === "unclassified" && (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                          未分类
                        </Badge>
                      )}
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-blue-100"
                          onClick={(e) => startEditing(evidence, e)}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div>
                      <Label className="text-xs font-medium text-slate-700 mb-1.5 block">证据类型</Label>
                      <Select value={displayCategory} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-full h-9 text-sm border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-slate-200">
                          <SelectItem value="身份证" className="text-sm">
                            身份证
                          </SelectItem>
                          <SelectItem value="微信聊天记录" className="text-sm">
                            微信聊天记录
                          </SelectItem>
                          <SelectItem value="营业执照" className="text-sm">
                            营业执照
                          </SelectItem>
                          <SelectItem value="未分类" className="text-sm">
                            未分类
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">{displayCategory}</p>
                  )}

                  <p className="text-xs text-slate-500">引用: {currentRefs.map((id) => `#${id}`).join(", ")}</p>
                </div>

                {displayCategory !== "未分类" && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {Object.entries(displayFeatures).map(([key, value]) => (
                        <div key={key} className="flex flex-col gap-1">
                          <Label className="text-xs font-medium text-slate-500">{formatFeatureKey(key)}</Label>
                          {isEditing ? (
                            <Input
                              value={value as string}
                              onChange={(e) => handleFeatureChange(key, e.target.value)}
                              className="h-8 text-xs border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                              onClick={(e) => e.stopPropagation()}
                              placeholder={`请输入${formatFeatureKey(key)}`}
                            />
                          ) : (
                            <span className="text-xs text-slate-900 font-medium">{value as string}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isEditing && showDeleteConfirm === evidence.id ? (
                  <div className="flex flex-col gap-2 pt-3 border-t border-red-200 bg-red-50/50 -mx-4 -mb-4 px-4 pb-4 rounded-b-xl">
                    <p className="text-sm text-red-700 font-medium">确定要删除这张卡片吗？</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-sm border-slate-300 hover:bg-slate-50 bg-white"
                        onClick={cancelDelete}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        取消
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-9 text-sm bg-red-600 hover:bg-red-700 shadow-sm"
                        onClick={(e) => confirmDelete(evidence.id, e)}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        确认删除
                      </Button>
                    </div>
                  </div>
                ) : (
                  isEditing && (
                    <div className="flex gap-2 pt-3 border-t border-blue-200">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-9 text-sm border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all bg-transparent"
                        onClick={cancelEditing}
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        取消
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 text-sm border-red-300 hover:bg-red-50 text-red-600 hover:text-red-700 bg-transparent"
                        onClick={(e) => handleDeleteClick(evidence.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-9 text-sm bg-green-600 hover:bg-green-700 shadow-sm"
                        onClick={(e) => saveEditing(evidence.id, e)}
                      >
                        <Save className="h-4 w-4 mr-1.5" />
                        保存
                      </Button>
                    </div>
                  )
                )}

                {evidence.type === "combined" && currentRefs.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 text-sm border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all bg-transparent"
                      onClick={(e) => toggleCombinedReferences(evidence.id, e)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          收起引用证据 ({currentRefs.length})
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          展开引用证据 ({currentRefs.length})
                        </>
                      )}
                    </Button>

                    {isExpanded && (
                      <div className="pl-4 border-l-2 border-blue-300 space-y-2">
                        {currentRefs.map((refId, index) => {
                          const refEvidence = getEvidenceDetails(refId)
                          const isDragOver = dragOverIndex?.cardId === evidence.id && dragOverIndex?.index === index
                          const isHovered = hoveredRefId === `${evidence.id}-${refId}`

                          return (
                            <div key={`${refId}-${index}`} className="relative">
                              {isDragOver && (
                                <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10" />
                              )}

                              <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, evidence.id, refId, index)}
                                onDragOver={(e) => handleDragOver(e, evidence.id, index)}
                                onDrop={(e) => handleDrop(e, evidence.id, index)}
                                onDragEnd={() => setDragOverIndex(null)}
                                onMouseEnter={() => setHoveredRefId(`${evidence.id}-${refId}`)}
                                onMouseLeave={() => setHoveredRefId(null)}
                                className={cn(
                                  "p-3 rounded-lg border bg-white shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                                  isDragOver ? "border-blue-400 bg-blue-50" : "border-slate-200",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                                    <GripVertical className="h-4 w-4" />
                                  </div>

                                  <div
                                    className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onZoomImage({ src: refEvidence?.thumbnail || "", alt: refEvidence?.name || "" })
                                    }}
                                  >
                                    {refEvidence?.thumbnail && (
                                      <Image
                                        src={refEvidence.thumbnail || "/placeholder.svg"}
                                        alt={refEvidence.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-slate-900 mb-0.5">证据 #{refId}</p>
                                    <p className="text-xs text-slate-600 truncate">{refEvidence?.name || "未知文件"}</p>
                                    <Badge
                                      variant="outline"
                                      className="text-xs mt-1 bg-blue-50 text-blue-700 border-blue-200"
                                    >
                                      序号: {index + 1}
                                    </Badge>
                                  </div>

                                  {isHovered && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveReference(evidence.id, refId)
                                      }}
                                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-md transition-all z-10"
                                    >
                                      <X className="h-3 w-3 text-white" strokeWidth={2.5} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatFeatureKey(key: string): string {
  const keyMap: Record<string, string> = {
    name: "姓名",
    gender: "性别",
    ethnicity: "民族",
    birthDate: "出生日期",
    address: "住址",
    idNumber: "身份证号",
    wechatName: "微信备注名",
    debtAmount: "欠款金额",
    debtAgreement: "欠款合意",
    borrowAmount: "借款金额",
    borrowDate: "借款日期",
    repaymentAgreement: "还款约定",
    debtStatus: "债务状态",
    companyName: "名称",
    creditCode: "统一社会信用代码",
    legalRepresentative: "法定代表人",
    companyType: "公司类型",
    registeredAddress: "住所地",
    accountName: "账户名",
    accountNumber: "账号",
    totalIncome: "总收入",
    totalExpense: "总支出",
    largestTransaction: "最大交易",
    period: "时间段",
    phoneNumber: "电话号码",
    contactName: "联系人",
    totalCalls: "通话次数",
    totalDuration: "通话时长",
    lastCallDate: "最后通话",
    analysisType: "分析类型",
    debtorName: "债务人",
    totalDebt: "债务总额",
    repaymentCapacity: "还款能力",
    riskLevel: "风险等级",
    confidence: "置信度",
    platform: "平台",
    amount: "金额",
    transferDate: "转账日期",
    sender: "转出方",
    receiver: "接收方",
    note: "备注",
  }
  return keyMap[key] || key
}

function getEvidenceDetails(id: string): { name: string; thumbnail: string } | null {
  const evidenceMap: Record<string, { name: string; thumbnail: string }> = {
    "12": { name: "#12.jpg", thumbnail: "/generic-id-card-front.png" },
    "13": { name: "#13.jpg", thumbnail: "/generic-id-card-front.png" },
    "14": { name: "#14.png", thumbnail: "/wechat-chat-screenshot.jpg" },
    "15": { name: "#15.png", thumbnail: "/wechat-transfer-confirmation.jpg" },
    "16": { name: "#16.png", thumbnail: "/wechat-payment-reminder.jpg" },
    "80": { name: "#80.pdf", thumbnail: "/loan-contract-document.jpg" },
    "81": { name: "#81.jpg", thumbnail: "/iou-handwritten-note.jpg" },
    "82": { name: "#82.png", thumbnail: "/alipay-transfer-record.jpg" },
    "83": { name: "#83.jpg", thumbnail: "/receipt-scan.jpg" },
    "84": { name: "#84.jpg", thumbnail: "/guarantor-id-card.jpg" },
    "85": { name: "#85.pdf", thumbnail: "/business-license.jpg" },
    "86": { name: "#86.pdf", thumbnail: "/business-license.jpg" },
  }
  return evidenceMap[id] || null
}
