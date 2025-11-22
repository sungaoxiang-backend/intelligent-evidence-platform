"use client"

import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, Copy, ImageIcon, Info, AlertCircle, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { evidenceApi, evidenceCardApi, type EvidenceCard } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import useSWR from "swr"

interface EvidenceCardsListProps {
  caseId: number | null
  className?: string
}

const cardFetcher = async ([_key, caseId]: [string, number]) => {
  if (!caseId) return { data: [] }
  const response = await evidenceCardApi.getEvidenceCards({
    case_id: caseId,
    skip: 0,
    limit: 1000,
  })
  return response
}

// 获取允许显示的字段列表（完全复刻卡片工厂）
function getAllowedFieldsForCardType(type: string): string[] {
  const fieldMap: Record<string, string[]> = {
    "公司营业执照": [
      "公司名称",
      "统一社会信用代码",
      "法定代表人",
      "公司类型",
      "住所地"
    ],
    "个体工商户营业执照": [
      "公司名称",
      "统一社会信用代码",
      "经营者姓名",
      "经营类型",
      "经营场所"
    ],
    "身份证": [
      "姓名",
      "性别",
      "民族",
      "出生",
      "住址",
      "公民身份号码"
    ],
    "微信个人主页": [
      "微信备注名",
      "微信号",
      "性别",
      "地区"
    ],
    "中华人民共和国居民身份证": [
      "姓名",
      "性别",
      "民族",
      "出生",
      "住址",
      "公民身份号码"
    ],
    "中华人民共和国居民户籍档案": [
      "姓名",
      "性别",
      "民族",
      "出生",
      "住址",
      "公民身份号码"
    ],
    "全国库信息资料": [
      "姓名",
      "性别",
      "民族",
      "出生日期",
      "户籍地址",
      "公民身份号码"
    ],
    "银行卡": [
      "持卡人姓名",
      "卡号",
      "开户银行"
    ],
    "营业执照": [
      "企业名称",
      "统一社会信用代码",
      "法定代表人"
    ],
  }
  return fieldMap[type] || []
}

// 证据卡片项组件（完全复刻卡片工厂的样式，但去掉拖拽功能）
function EvidenceCardItem({ 
  card,
  evidenceList
}: { 
  card: EvidenceCard
  evidenceList: any[]
}) {
  const { toast } = useToast()
  const [currentImageIdx, setCurrentImageIdx] = useState(0)
  const [isHoveringImage, setIsHoveringImage] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; urls: string[]; currentIndex: number } | null>(null)

  // 复制到剪贴板功能
  const handleCopy = async (text: string, label: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "复制成功",
        description: `${label}已复制到剪贴板`,
      })
    } catch (error) {
      console.error('复制失败:', error)
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  // 复制当前图片的COS链接
  const handleCopyImageUrl = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentImageUrl) return
    
    try {
      await navigator.clipboard.writeText(currentImageUrl)
      setCopiedUrl(currentImageUrl)
      toast({
        title: "复制成功",
        description: "图片链接已复制到剪贴板，可粘贴到表单中",
      })
      // 2秒后重置复制状态
      setTimeout(() => {
        setCopiedUrl(null)
      }, 2000)
    } catch (error) {
      console.error('复制失败:', error)
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  // 异常卡片标识
  const isAbnormal = !card.is_normal
  
  // 获取所有引用ID（包括已删除的）和已删除的ID集合
  const allEvidenceIds = card.all_evidence_ids || card.evidence_ids || []
  const existingEvidenceIds = new Set(card.evidence_ids || [])
  const deletedEvidenceIds = new Set(
    allEvidenceIds.filter(id => !existingEvidenceIds.has(id))
  )

  const cardInfo = card.card_info || {}
  const cardType = cardInfo.card_type || '未知类型'
  const isCombined = cardInfo.card_is_associated === true
  const cardFeatures = cardInfo.card_features || []

  // 过滤字段：只显示配置中定义的字段
  const allowedFields = getAllowedFieldsForCardType(cardType)
  const allFeatures = allowedFields.length > 0
    ? cardFeatures.filter((f: any) => allowedFields.includes(f.slot_name))
    : cardFeatures // 如果没有配置，显示所有字段（向后兼容）

  // 获取关联的证据图片URL（按序号排序）
  const getEvidenceUrls = () => {
    return card.evidence_ids
      .map(id => {
        const evidence = evidenceList.find((e: any) => e.id === id)
        return evidence?.file_url || null
      })
      .filter(url => url !== null) as string[]
  }

  const evidenceUrls = getEvidenceUrls()
  const currentIdx = currentImageIdx
  const currentImageUrl = evidenceUrls[currentIdx] || evidenceUrls[0] || null

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentImageUrl && evidenceUrls.length > 0) {
      setPreviewImage({
        url: currentImageUrl,
        urls: evidenceUrls,
        currentIndex: currentIdx,
      })
    }
  }

  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 1) {
      const newIndex = currentIdx === 0 ? evidenceUrls.length - 1 : currentIdx - 1
      setCurrentImageIdx(newIndex)
    }
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 1) {
      const newIndex = currentIdx === evidenceUrls.length - 1 ? 0 : currentIdx + 1
      setCurrentImageIdx(newIndex)
    }
  }

  return (
    <Card
      className={cn(
        "w-full p-4 text-left transition-all duration-200 group relative overflow-hidden",
        "shadow-lg hover:shadow-2xl border-2",
        // 异常卡片显示红色边框
        isAbnormal 
          ? "cursor-not-allowed border-red-300 bg-red-50/30 hover:border-red-300 hover:bg-red-50/30"
          : "cursor-default select-none",
        isAbnormal
          ? "border-red-300 hover:border-red-300 hover:bg-red-50/30 hover:shadow-lg"
          : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-xl"
      )}
    >
      {/* 异常卡片的感叹号标识 */}
      {isAbnormal && (
        <div className="absolute top-2 right-2 z-20">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 border border-red-300">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-semibold text-red-600">异常</span>
          </div>
        </div>
      )}

      {/* 顶部高光效果 */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none rounded-t-lg" />

      {/* 底部阴影渐变 */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-t from-black/5 to-transparent pointer-events-none rounded-b-lg" />

      <div className="space-y-3 relative z-10">
        {/* 缩略图 */}
        {isCombined ? (
          // 联合证据卡片 - 显示堆叠的图标，支持图片导航
          <div 
            className="relative w-full aspect-video overflow-hidden rounded-lg bg-slate-50 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all group/image-container"
            onClick={handleImageClick}
            onMouseEnter={() => setIsHoveringImage(true)}
            onMouseLeave={() => setIsHoveringImage(false)}
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={cardType}
                className="w-full h-full object-cover cursor-pointer"
                title="点击放大"
              />
            ) : (
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <div className="relative">
                  <div className="w-24 h-24 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                    <ImageIcon className="w-12 h-12 text-slate-400" />
                  </div>
                  <div className="absolute top-2 left-2 w-24 h-24 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                    <ImageIcon className="w-12 h-12 text-slate-400" />
                  </div>
                  <div className="absolute top-4 left-4 w-24 h-24 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                    <ImageIcon className="w-12 h-12 text-slate-400" />
                  </div>
                </div>
              </div>
            )}
            {evidenceUrls.length > 1 && (
              <>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">
                  {currentIdx + 1}/{evidenceUrls.length}
                </div>
                {/* 上一张/下一张按钮 - 悬停时显示 */}
                {isHoveringImage && (
                  <>
                    <button
                      onClick={handlePreviousImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 backdrop-blur-sm"
                      aria-label="上一张"
                    >
                      ←
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 backdrop-blur-sm"
                      aria-label="下一张"
                    >
                      →
                    </button>
                  </>
                )}
              </>
            )}
            {/* 复制图片链接按钮 - 悬停时显示 */}
            {isHoveringImage && currentImageUrl && (
              <div className="absolute top-2 right-2 z-20">
                <button
                  onClick={handleCopyImageUrl}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm",
                    copiedUrl === currentImageUrl
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                  )}
                  title="复制图片链接"
                >
                  {copiedUrl === currentImageUrl ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          // 独立证据卡片 - 显示缩略图
          <div 
            className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
            onClick={handleImageClick}
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt={cardType}
                className="w-full h-full object-cover cursor-pointer"
                title="点击放大"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-slate-400" />
              </div>
            )}
          </div>
        )}

        {/* 卡片信息 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-medium">卡片ID</span>
                <span className="text-sm font-bold text-blue-600">#{card.id}</span>
              </div>
              {/* 卡片元属性信息 */}
              {(card.created_at || card.updated_at || (card.updated_times !== undefined && card.updated_times > 0)) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center cursor-help hover:text-slate-600 transition-colors text-slate-400 ml-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Info className="h-3.5 w-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <div className="space-y-1.5 text-xs">
                        {card.created_at && (
                          <div>
                            <span className="font-medium text-slate-600">创建时间:</span>
                            <span className="ml-2 text-slate-700">
                              {new Date(card.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                            </span>
                          </div>
                        )}
                        {card.updated_at && (
                          <div>
                            <span className="font-medium text-slate-600">更新时间:</span>
                            <span className="ml-2 text-slate-700">
                              {new Date(card.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                            </span>
                          </div>
                        )}
                        {card.updated_times !== undefined && card.updated_times > 0 && (
                          <div>
                            <span className="font-medium text-slate-600">更新次数:</span>
                            <span className="ml-2 text-slate-700">{card.updated_times} 次</span>
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{cardType}</p>
            {/* 卡片类型标签：联合卡片/独立卡片 */}
            {cardInfo.card_is_associated !== undefined && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5",
                  cardInfo.card_is_associated
                    ? "border-blue-300 text-blue-700 bg-blue-50"
                    : "border-slate-300 text-slate-700 bg-slate-50"
                )}
              >
                {cardInfo.card_is_associated ? "联合卡片" : "独立卡片"}
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-500">
            引用: {allEvidenceIds.map((id, idx) => {
              const isDeleted = deletedEvidenceIds.has(id)
              return (
                <React.Fragment key={id}>
                  {idx > 0 && <span>, </span>}
                  <span className={isDeleted ? "text-red-600 font-semibold" : ""}>
                    #{id}
                  </span>
                </React.Fragment>
              )
            })}
          </p>
        </div>

        {/* 字段信息 */}
        {cardInfo && typeof cardInfo === 'object' && cardType !== '未分类' && allFeatures.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {allFeatures.map((feature: any, index: number) => {
                // 判断值是否为null或undefined
                const isNullValue = feature.slot_value === null || feature.slot_value === undefined || feature.slot_value === ''

                return (
                  <div key={`${feature.slot_name}-${index}`} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">{feature.slot_name}</span>
                    <div 
                      className={cn(
                        "text-xs text-slate-900 font-medium break-words",
                        !isNullValue && "cursor-pointer hover:text-blue-600 hover:underline transition-colors inline-flex items-center gap-1 group"
                      )}
                      onClick={(e) => {
                        if (!isNullValue) {
                          const valueToCopy = feature.slot_value_type === 'boolean' 
                            ? (feature.slot_value ? '是' : '否')
                            : String(feature.slot_value)
                          handleCopy(valueToCopy, feature.slot_name, e)
                        }
                      }}
                      title={!isNullValue ? `点击复制${feature.slot_name}` : undefined}
                    >
                      {isNullValue 
                        ? 'N/A'
                        : (
                          <>
                            {feature.slot_value_type === 'boolean' 
                              ? (feature.slot_value ? '是' : '否')
                              : String(feature.slot_value)}
                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </>
                        )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 图片预览弹窗 */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-none w-auto h-auto p-0 bg-transparent border-0 shadow-none">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage.url}
                alt="证据图片预览"
                className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
              />
              
              {/* 关闭按钮 */}
              <Button 
                onClick={() => setPreviewImage(null)} 
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                size="sm"
              >
                关闭
              </Button>
              
              {/* 上一张按钮 */}
              {previewImage.urls.length > 1 && (
                <Button 
                  onClick={() => {
                    const newIndex = previewImage.currentIndex === 0 
                      ? previewImage.urls.length - 1 
                      : previewImage.currentIndex - 1
                    setPreviewImage({
                      url: previewImage.urls[newIndex],
                      urls: previewImage.urls,
                      currentIndex: newIndex,
                    })
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                  size="sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              
              {/* 下一张按钮 */}
              {previewImage.urls.length > 1 && (
                <Button 
                  onClick={() => {
                    const newIndex = previewImage.currentIndex === previewImage.urls.length - 1
                      ? 0
                      : previewImage.currentIndex + 1
                    setPreviewImage({
                      url: previewImage.urls[newIndex],
                      urls: previewImage.urls,
                      currentIndex: newIndex,
                    })
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                  size="sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              
              {/* 图片索引指示器 */}
              {previewImage.urls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1 rounded-full backdrop-blur-sm">
                  {previewImage.currentIndex + 1} / {previewImage.urls.length}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function EvidenceCardsList({
  caseId,
  className,
}: EvidenceCardsListProps) {
  // Hooks 必须在所有早期返回之前调用
  const { data: evidenceData } = useSWR(
    caseId ? ['/api/evidences', String(caseId)] : null,
    async ([_key, caseId]: [string, string]) => {
      const response = await evidenceApi.getEvidences({
        page: 1,
        pageSize: 1000,
        search: "",
        case_id: Number(caseId),
        sort_by: "created_at",
        sort_order: "desc",
      })
      return response
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const { data: cardData, isLoading } = useSWR(
    caseId ? ['/api/evidence-cards', caseId] : null,
    cardFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const cardList = cardData?.data || []
  const evidenceList = evidenceData?.data || []

  if (!caseId) {
    return (
      <div className={className}>
        <div className="text-sm text-muted-foreground text-center py-8">
          请先选择案件
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (cardList.length === 0) {
    return (
      <div className={className}>
        <div className="text-sm text-muted-foreground text-center py-8">
          暂无证据卡片
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {cardList.map((card) => (
          <EvidenceCardItem
            key={card.id}
            card={card}
            evidenceList={evidenceList}
          />
        ))}
      </div>
    </div>
  )
}
