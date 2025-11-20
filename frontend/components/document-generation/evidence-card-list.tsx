"use client"

import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { FileText, ImageIcon, Copy, CheckCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export interface EvidenceCard {
  id: number
  evidence_ids: number[]
  card_info: {
    card_type?: string
    card_features?: any[]
    card_is_associated?: boolean
    [key: string]: any
  }
  created_at?: string
}

export interface Evidence {
  id: number
  file_url: string
  file_name: string
  evidence_type: string
}

export interface EvidenceCardListProps {
  cards: EvidenceCard[]
  evidences: Evidence[]
}

/**
 * 证据卡片列表组件
 * 显示案件中已铸造的证据卡片，样式参照卡片工厂
 */
export function EvidenceCardList({ cards, evidences }: EvidenceCardListProps) {
  const { toast } = useToast()
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // 根据证据ID查找证据
  const getEvidence = (evidenceId: number) => {
    return evidences.find((e) => e.id === evidenceId)
  }

  // 获取卡片的第一张图片
  const getCardThumbnail = (card: EvidenceCard) => {
    if (card.evidence_ids && card.evidence_ids.length > 0) {
      const firstEvidence = getEvidence(card.evidence_ids[0])
      if (firstEvidence && firstEvidence.file_url) {
        return firstEvidence.file_url
      }
    }
    return null
  }

  // 复制到剪贴板
  const handleCopy = async (text: string, label: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldKey)
      toast({
        title: "复制成功",
        description: `${label}已复制到剪贴板`,
      })
      setTimeout(() => {
        setCopiedField(null)
      }, 2000)
    } catch (error) {
      console.error("复制失败:", error)
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm text-muted-foreground">暂无证据卡片</p>
        <p className="text-xs text-muted-foreground mt-1">请先在卡片工厂中铸造证据卡片</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">证据卡片</h3>
          <Badge variant="secondary" className="text-xs">
            {cards.length}
          </Badge>
        </div>
        
        {cards.map((card) => {
          const thumbnail = getCardThumbnail(card)
          const cardType = card.card_info?.card_type || "未分类"
          const cardFeatures = card.card_info?.card_features || []
          const isCombined = card.card_info?.card_is_associated || false
          
          return (
            <Card
              key={card.id}
              className="p-3 hover:shadow-md transition-shadow border border-gray-200 bg-white"
            >
              {/* 缩略图 */}
              <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 mb-3">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={cardType}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-slate-400" />
                  </div>
                )}
              </div>

              {/* 卡片信息 */}
              <div className="space-y-2">
                {/* 卡片ID和类型 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">卡片ID</span>
                    <span
                      className="text-sm font-bold text-blue-600 cursor-pointer hover:text-blue-800 transition-colors"
                      onClick={() => handleCopy(String(card.id), "卡片ID", `card-${card.id}-id`)}
                      title="点击复制"
                    >
                      #{card.id}
                      {copiedField === `card-${card.id}-id` && (
                        <CheckCheck className="inline-block ml-1 w-3 h-3 text-green-600" />
                      )}
                    </span>
                  </div>
                </div>

                {/* 卡片类型和标签 */}
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{cardType}</p>
                  {isCombined ? (
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50">
                      联合卡片
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-slate-300 text-slate-700 bg-slate-50">
                      独立卡片
                    </Badge>
                  )}
                </div>

                {/* 引用证据 */}
                <p className="text-xs text-slate-500">
                  引用: {card.evidence_ids.map((id, idx) => (
                    <React.Fragment key={id}>
                      {idx > 0 && <span>, </span>}
                      <span>#{id}</span>
                    </React.Fragment>
                  ))}
                </p>

                {/* 特征信息 - 2x2网格布局 */}
                {cardFeatures.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {cardFeatures.map((feature: any, index: number) => {
                        const isNullValue = 
                          feature.slot_value === null || 
                          feature.slot_value === undefined || 
                          feature.slot_value === ''
                        
                        const displayValue = isNullValue
                          ? 'N/A'
                          : feature.slot_value_type === 'boolean'
                            ? (feature.slot_value ? '是' : '否')
                            : String(feature.slot_value)
                        
                        const fieldKey = `card-${card.id}-feature-${index}`
                        const isCopied = copiedField === fieldKey

                        return (
                          <div key={`${feature.slot_name}-${index}`} className="flex flex-col gap-1">
                            <Label className="text-xs font-medium text-slate-500">
                              {feature.slot_name}
                            </Label>
                            <div
                              className="group relative text-xs text-slate-900 font-medium break-words cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-1"
                              onClick={() => {
                                if (!isNullValue) {
                                  handleCopy(displayValue, feature.slot_name, fieldKey)
                                }
                              }}
                              title={isNullValue ? "" : "点击复制"}
                            >
                              <span>{displayValue}</span>
                              {!isNullValue && (
                                isCopied ? (
                                  <CheckCheck className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                )
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </ScrollArea>
  )
}
