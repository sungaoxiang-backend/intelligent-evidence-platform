"use client"

import { useState, Suspense, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Pencil, 
  CheckCircle2, 
  Circle,
  X,
  Check,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  GripVertical,
  Save,
  Upload
} from "lucide-react"
import { evidenceApi, evidenceCardApi, caseApi, type EvidenceCard } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useGlobalTasks } from "@/contexts/global-task-context"
import { useCardCasting } from "@/hooks/use-celery-tasks"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { cn } from "@/lib/utils"

// SWR数据获取函数
const evidenceFetcher = async ([_key, caseId]: [string, string]) => {
  const response = await evidenceApi.getEvidences({
    page: 1,
    pageSize: 1000,
    search: "",
    case_id: Number(caseId),
    sort_by: "created_at",
    sort_order: "desc",
  })
  return response
}

const cardFetcher = async ([_key, caseId]: [string, string]) => {
  const response = await evidenceCardApi.getEvidenceCards({
    case_id: Number(caseId),
    skip: 0,
    limit: 1000,
  })
  return response
}

// 获取文件类型信息
const getFileTypeInfo = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif', 'svg'].includes(ext)) {
    return {
      type: 'image',
      icon: '🖼️',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    };
  }
  
  if (ext === 'pdf') {
    return {
      type: 'pdf',
      icon: '📄',
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/20',
    };
  }
  
  return {
    type: 'unknown',
    icon: '📁',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/20',
  };
};

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 原始证据列表项组件（参考demo设计）
function OriginalEvidenceItem({ 
  evidence, 
  isSelected, 
  isCast,
  multiSelectMode,
  onClick 
}: { 
  evidence: any
  isSelected: boolean
  isCast: boolean
  multiSelectMode: boolean
  onClick: () => void
}) {
  const fileTypeInfo = getFileTypeInfo(evidence.file_name || '')

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-xl border text-left transition-all duration-200 hover:shadow-lg group relative overflow-hidden",
        isSelected
          ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div
            className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
          >
            {fileTypeInfo.type === 'image' && evidence.file_url ? (
              <img
                src={evidence.file_url}
                alt={evidence.file_name || ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className={`w-full h-full ${fileTypeInfo.bgColor} flex items-center justify-center`}>
                <span className="text-2xl">{fileTypeInfo.icon}</span>
              </div>
            )}
          </div>
          {multiSelectMode && (
            <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow-md">
              {isSelected ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600 fill-blue-600" strokeWidth={0} />
              ) : (
                <Circle className="h-5 w-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-medium">证据ID</span>
              <span className="text-xs font-mono text-blue-600 font-semibold">#{evidence.id}</span>
            </div>
            <Badge
              variant={isCast ? "default" : "secondary"}
              className={cn(
                "text-xs flex-shrink-0 font-medium",
                isCast ? "bg-green-500 hover:bg-green-600 text-white" : "bg-slate-200 text-slate-600",
              )}
            >
              {isCast ? "已铸造" : "未铸造"}
            </Badge>
          </div>

          <p className="text-sm font-medium text-slate-900 truncate mb-1">{evidence.file_name || ''}</p>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{formatFileSize(evidence.file_size || 0)}</span>
            <span>•</span>
            <span>{formatDate(evidence.created_at)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// 证据卡片列表项组件（参考demo设计）
function EvidenceCardListItem({ 
  card, 
  isSelected, 
  isDragging, 
  onClick,
  evidenceList,
  onImageClick,
  onUpdateCard
}: { 
  card: EvidenceCard
  isSelected: boolean
  isDragging: boolean
  onClick: () => void
  evidenceList: any[]
  onImageClick: (imageUrl: string, allUrls: string[]) => void
  onUpdateCard?: (cardId: number, updatedFeatures: any[]) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedFeatures, setEditedFeatures] = useState<any[]>([])
  
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `card-${card.id}`,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  const cardInfo = card.card_info || {}
  const cardType = cardInfo.card_type || '未知类型'
  const firstEvidenceId = card.evidence_ids[0]
  const isCombined = card.evidence_ids.length > 1
  const cardFeatures = cardInfo.card_features || []

  // 显示所有字段，包括null值（null值会显示为"N/A"）
  const allFeatures = cardFeatures

  // 初始化编辑数据
  useEffect(() => {
    if (isEditing && cardFeatures.length > 0) {
      setEditedFeatures(JSON.parse(JSON.stringify(cardFeatures)))
    }
  }, [isEditing, cardFeatures])

  // 获取关联的证据图片URL
  const getEvidenceUrls = () => {
    return card.evidence_ids
      .map(id => {
        const evidence = evidenceList.find((e: any) => e.id === id)
        return evidence?.file_url || null
      })
      .filter(url => url !== null) as string[]
  }

  const evidenceUrls = getEvidenceUrls()
  const firstImageUrl = evidenceUrls[0] || null

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (firstImageUrl) {
      onImageClick(firstImageUrl, evidenceUrls)
    }
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onUpdateCard) {
      onUpdateCard(card.id, editedFeatures)
    }
    setIsEditing(false)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(false)
    setEditedFeatures([])
  }

  const handleFeatureChange = (index: number, newValue: string) => {
    const updated = [...editedFeatures]
    updated[index] = { ...updated[index], slot_value: newValue }
    setEditedFeatures(updated)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-all duration-200 hover:shadow-lg relative overflow-hidden group",
        isSelected
          ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
        isDragging && "opacity-50"
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
      )}

      {/* 拖拽句柄 */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="space-y-3">
        {/* 缩略图 */}
        {isCombined ? (
          // 联合证据卡片 - 显示堆叠的图标
          <div 
            className="relative w-full aspect-video overflow-hidden rounded-lg bg-slate-50 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
            onClick={handleImageClick}
          >
            {firstImageUrl ? (
              <img
                src={firstImageUrl}
                alt={cardType}
                className="w-full h-full object-cover"
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
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">
                1/{evidenceUrls.length}
              </div>
            )}
          </div>
        ) : (
          // 独立证据卡片 - 显示缩略图
          <div 
            className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
            onClick={handleImageClick}
          >
            {firstImageUrl ? (
              <img
                src={firstImageUrl}
                alt={cardType}
                className="w-full h-full object-cover"
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
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-medium">卡片ID</span>
              <span className="text-sm font-bold text-blue-600">#{card.id}</span>
            </div>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-blue-100"
                onClick={handleEditClick}
              >
                <Pencil className="h-3.5 w-3.5 text-slate-600" />
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-green-100"
                  onClick={handleSave}
                >
                  <Save className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-red-100"
                  onClick={handleCancel}
                >
                  <X className="h-3.5 w-3.5 text-red-600" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-sm font-semibold text-slate-900">{cardType}</p>

          <p className="text-xs text-slate-500">
            引用: {card.evidence_ids.map(id => `#${id}`).join(", ")}
          </p>
        </div>

        {/* 字段信息 */}
        {cardInfo && typeof cardInfo === 'object' && cardType !== '未分类' && allFeatures.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {allFeatures.map((feature: any, index: number) => {
                // 编辑模式下使用editedFeatures
                const displayFeature = isEditing 
                  ? editedFeatures.find((f: any) => f.slot_name === feature.slot_name) || feature
                  : feature
                
                if (!displayFeature) return null

                // 在编辑模式下找到原始索引
                const originalIndex = isEditing 
                  ? cardFeatures.findIndex((f: any) => f.slot_name === feature.slot_name)
                  : index

                // 判断值是否为null或undefined
                const isNullValue = displayFeature.slot_value === null || displayFeature.slot_value === undefined || displayFeature.slot_value === ''

                return (
                  <div key={`${displayFeature.slot_name}-${index}`} className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-slate-500">{displayFeature.slot_name}</Label>
                    {isEditing ? (
                      <Input
                        value={displayFeature.slot_value === null || displayFeature.slot_value === undefined ? '' : String(displayFeature.slot_value)}
                        onChange={(e) => handleFeatureChange(originalIndex, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 text-xs"
                        placeholder={`请输入${displayFeature.slot_name}`}
                      />
                    ) : (
                      <span className="text-xs text-slate-900 font-medium break-words">
                        {isNullValue 
                          ? 'N/A'
                          : displayFeature.slot_value_type === 'boolean' 
                            ? (displayFeature.slot_value ? '是' : '否')
                            : String(displayFeature.slot_value)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 联合证据卡片的展开按钮 */}
        {isCombined && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              // 展开功能待实现
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            展开引用证据 ({card.evidence_ids.length})
          </Button>
        )}
      </div>
    </div>
  )
}

// 格式化字段键名
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
    companyName: "名称",
    creditCode: "统一社会信用代码",
    legalRepresentative: "法定代表人",
    companyType: "公司类型",
    registeredAddress: "住所地",
  }
  return keyMap[key] || key
}

// 卡片详情显示组件（参考demo设计）
function CardDetail({ card, evidenceList }: { card: EvidenceCard | null; evidenceList: any[] }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // 获取关联的证据图片URL
  const getEvidenceUrls = () => {
    if (!card) return []
    return card.evidence_ids
      .map(id => {
        const evidence = evidenceList.find((e: any) => e.id === id)
        return evidence?.file_url || null
      })
      .filter(url => url !== null) as string[]
  }

  useEffect(() => {
    if (card) {
      setCurrentImageIndex(0)
    }
  }, [card])

  if (!card) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        请选择一个卡片查看详情
      </div>
    )
  }

  const cardInfo = card.card_info || {}
  const cardType = cardInfo.card_type || '未知类型'
  const isCombined = card.evidence_ids.length > 1
  const evidenceUrls = getEvidenceUrls()
  const currentImageUrl = evidenceUrls[currentImageIndex] || null

  // 处理上一张/下一张
  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 0) {
      setCurrentImageIndex(prev => (prev === 0 ? evidenceUrls.length - 1 : prev - 1))
    }
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 0) {
      setCurrentImageIndex(prev => (prev === evidenceUrls.length - 1 ? 0 : prev + 1))
    }
  }

  // 渲染身份证卡片图形
  const renderIdCard = () => {
    if (cardType === '身份证') {
      return (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800 shadow-lg">
          <div className="bg-white rounded-lg p-4 shadow-inner">
            <div className="text-center mb-4">
              <div className="text-lg font-bold text-gray-800 mb-2">中华人民共和国</div>
              <div className="text-sm font-semibold text-gray-700">居民身份证</div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start">
                <span className="text-xs text-gray-500 w-16">姓名</span>
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {cardInfo.姓名 || cardInfo.name || ''}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-xs text-gray-500 w-16">性别</span>
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {cardInfo.性别 || cardInfo.gender || ''}
                </span>
                <span className="text-xs text-gray-500 w-16 ml-4">民族</span>
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {cardInfo.民族 || cardInfo.ethnicity || ''}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-xs text-gray-500 w-16">出生</span>
                <span className="text-sm font-medium text-gray-800 flex-1">
                  {cardInfo.出生日期 || cardInfo.birthDate || cardInfo.birth_date || ''}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-xs text-gray-500 w-16">住址</span>
                <span className="text-sm font-medium text-gray-800 flex-1 text-xs leading-tight">
                  {cardInfo.住址 || cardInfo.address || ''}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-xs text-gray-500 w-16">公民身份号码</span>
                <span className="text-sm font-mono font-medium text-gray-800 flex-1">
                  {cardInfo.身份证号 || cardInfo.idNumber || cardInfo.id_number || ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // 提取字段信息（排除系统字段）
  const extractFields = () => {
    if (!card || !cardInfo || typeof cardInfo !== 'object') return []
    const fields: Array<{ key: string; value: any }> = []
    for (const [key, value] of Object.entries(cardInfo)) {
      if (key === 'card_type' || key === 'card_is_associated' || key === 'thumbnail') continue
      if (typeof value === 'object' || value === null || value === undefined) continue
      if (String(value).trim() === '') continue
      fields.push({ key, value: String(value) })
    }
    return fields
  }

  const fields = extractFields()

  return (
    <div className="space-y-4">
      {/* 卡片头部信息 */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">卡片ID #{card.id}</span>
          <Pencil className="h-3 w-3 text-gray-400" />
        </div>
      </div>
      <div className="text-xs text-gray-600 mb-1">{cardType}</div>
      <div className="text-xs text-gray-500 mb-4">引用: {card.evidence_ids.map(id => `#${id}`).join(", ")}</div>

      {/* 关联的证据图片 */}
      {evidenceUrls.length > 0 && (
        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-slate-50 border border-slate-200 group">
          <img
            src={currentImageUrl || ''}
            alt={`证据图片 ${currentImageIndex + 1}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                const placeholder = document.createElement('div')
                placeholder.className = 'w-full h-full flex items-center justify-center'
                placeholder.innerHTML = '<div class="text-slate-400 text-sm">图片加载失败</div>'
                parent.appendChild(placeholder)
              }
            }}
          />
          
          {/* 多张图片时的导航按钮 */}
          {evidenceUrls.length > 1 && (
            <>
              <button
                onClick={handlePreviousImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-all z-10 opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5 text-slate-700" />
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-lg transition-all z-10 opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5 text-slate-700" />
              </button>
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm font-semibold">
                {currentImageIndex + 1}/{evidenceUrls.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* 卡片图形 */}
      {cardType === '身份证' && renderIdCard()}

      {/* 字段信息 */}
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2 border-t border-slate-200">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <Label className="text-xs font-medium text-slate-500">{formatFeatureKey(field.key)}</Label>
              <span className="text-xs text-slate-900 font-medium">{field.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 可放置的槽位组件（参考demo设计）
function DroppableSlot({ 
  id, 
  title, 
  cardId,
  side,
  category
}: { 
  id: string
  title: string
  cardId?: number
  side?: "creditor" | "debtor" | "shared"
  category?: string
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  const getSlotBackground = () => {
    if (cardId) {
      return "bg-green-50"
    }
    if (isOver) {
      return "bg-green-100"
    }
    if (side === "creditor") {
      return "bg-blue-50/50 hover:bg-blue-100/70"
    }
    if (side === "debtor") {
      return "bg-amber-50/50 hover:bg-amber-100/70"
    }
    return "bg-slate-50 hover:bg-slate-100"
  }

  const getBorderColor = () => {
    if (cardId) {
      return "border-green-500"
    }
    if (isOver) {
      return "border-green-500 ring-2 ring-green-300"
    }
    if (side === "creditor") {
      return "border-blue-300"
    }
    if (side === "debtor") {
      return "border-amber-300"
    }
    return "border-slate-300"
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-all duration-200 relative overflow-hidden",
        "h-32 flex flex-col items-center justify-center p-2.5",
        "border-2",
        getSlotBackground(),
        getBorderColor(),
        !cardId && "border-dashed",
        isOver && "scale-105",
      )}
    >
      <div className="flex flex-col items-center justify-center text-center gap-1 w-full">
        {cardId ? (
          <>
            <div className="text-xs font-semibold text-slate-900 line-clamp-2 px-1">{title}</div>
            <div className="text-xs text-green-700 font-bold">#{cardId}</div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold text-slate-700 line-clamp-2 px-1">{title}</div>
            <div className="text-[10px] text-slate-400 line-clamp-1 px-1">
              {isOver ? "松开放置" : "拖入卡片"}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function CardFactory({ 
  caseId, 
  onBack, 
  onGoToCaseDetail,
  caseData
}: { 
  caseId: string | number
  onBack?: () => void
  onGoToCaseDetail?: () => void
  caseData?: any
}) {
  const [activeTab, setActiveTab] = useState<'evidence' | 'cards'>('evidence')
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<Set<string>>(new Set())
  const [selectedCard, setSelectedCard] = useState<EvidenceCard | null>(null)
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [slotCards, setSlotCards] = useState<Record<string, number>>({})
  const [isEditingCase, setIsEditingCase] = useState(false)
  const [editedCaseInfo, setEditedCaseInfo] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; urls: string[]; currentIndex: number } | null>(null)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  
  const { toast } = useToast()
  const { tasks, addTask, updateTask, removeTask } = useGlobalTasks()
  const { startCardCasting } = useCardCasting({ addTask, updateTask, removeTask })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  )

  // 获取案件信息（如果外部传入则使用传入的，否则从API获取）
  const { data: fetchedCaseData, mutate: mutateCase } = useSWR(
    caseData ? null : ['/api/cases', String(caseId)],
    async () => {
      try {
        return await caseApi.getCaseById(Number(caseId))
      } catch (error) {
        console.error('Failed to fetch case data:', error)
        return null
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
  
  // 使用传入的 caseData 或从 API 获取的 caseData
  const finalCaseData = caseData || fetchedCaseData?.data

  // 获取证据列表
  const { data: evidenceData } = useSWR(
    ['/api/evidences', String(caseId)],
    evidenceFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  // 获取卡片列表
  const { data: cardData, mutate: mutateCards } = useSWR(
    ['/api/evidence-cards', String(caseId)],
    cardFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const evidenceList = evidenceData?.data || []
  const cardList = cardData?.data || []

  // 初始化编辑表单
  useEffect(() => {
    if (finalCaseData && !isEditingCase) {
      setEditedCaseInfo(finalCaseData)
    }
  }, [finalCaseData, isEditingCase])

  // 处理证据选择
  const handleEvidenceSelect = (evidenceId: string) => {
    if (isMultiSelect) {
      setSelectedEvidenceIds(prev => {
        const next = new Set(prev)
        if (next.has(evidenceId)) {
          next.delete(evidenceId)
        } else {
          next.add(evidenceId)
        }
        return next
      })
    } else {
      setSelectedEvidenceIds(new Set([evidenceId]))
    }
  }

  // 处理全选/反选
  const handleSelectAll = () => {
    if (selectedEvidenceIds.size === evidenceList.length) {
      setSelectedEvidenceIds(new Set())
    } else {
      setSelectedEvidenceIds(new Set(evidenceList.map((e: any) => String(e.id))))
    }
  }

  // 处理卡片铸造
  const handleCast = async () => {
    try {
      if (selectedEvidenceIds.size === 0) {
        toast({ title: "提示", description: "请先选择证据", variant: "destructive" })
        return
      }
      
      // 获取案件信息和证据类型
      const caseTitle = finalCaseData?.description || `案件 ${caseId}`
      const evidenceIds = Array.from(selectedEvidenceIds).map(id => Number(id))
      
      // 使用Celery异步任务进行卡片铸造
      const result = await startCardCasting({
        case_id: Number(caseId),
        evidence_ids: evidenceIds,
        caseTitle,
      })

      if (result.success) {
        // 任务启动成功，清空选择
        setSelectedEvidenceIds(new Set())
        setIsMultiSelect(false)
        // 刷新卡片列表
        setTimeout(() => {
          mutateCards()
        }, 2000)
      }
      
    } catch (e: any) {
      toast({ title: "卡片铸造失败", description: e?.message || '未知错误', variant: "destructive" })
    }
  }

  // 处理拖拽开始
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setDraggedCardId(active.id as string)
  }

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    setDraggedCardId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // 检查是否是拖拽到槽位
    if (activeId.startsWith('card-') && overId.startsWith('slot-')) {
      const cardId = parseInt(activeId.replace('card-', ''))
      const slotId = overId.replace('slot-', '')
      
      // 检查卡片类型是否匹配槽位类型
      const card = cardList.find(c => c.id === cardId)
      const cardType = card?.card_info?.card_type || ''
      
      // 简单的类型匹配逻辑（可以根据需要扩展）
      let isValid = true
      if (slotId.includes('identity') && cardType !== '身份证') {
        isValid = false
      } else if (slotId.includes('wechat') && cardType !== '微信聊天记录') {
        isValid = false
      }

      if (isValid) {
        setSlotCards(prev => ({
          ...prev,
          [slotId]: cardId,
        }))

        toast({
          title: "卡片已放置",
          description: `卡片 #${cardId} 已放置到槽位`,
        })
      } else {
        toast({
          title: "类型不匹配",
          description: "卡片类型与槽位类型不匹配",
          variant: "destructive"
        })
      }
    }
  }

  // 检查证据是否已铸造
  const isEvidenceCast = (evidenceId: number) => {
    return cardList.some(card => card.evidence_ids.includes(evidenceId))
  }

  // 保存案件信息编辑
  const handleSaveCaseInfo = async () => {
    try {
      await caseApi.updateCase(Number(caseId), editedCaseInfo)
      setIsEditingCase(false)
      await mutateCase()
      toast({
        title: "保存成功",
        description: "案件信息已更新",
      })
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error?.message || '未知错误',
        variant: "destructive"
      })
    }
  }

  // 取消案件信息编辑
  const handleCancelCaseInfo = () => {
    setEditedCaseInfo(finalCaseData)
    setIsEditingCase(false)
  }

  // 暴露上传对话框控制给外部
  useEffect(() => {
    // 创建一个全局函数供外部调用
    ;(window as any).__cardFactoryOpenUpload = () => {
      setIsUploadDialogOpen(true)
    }
    return () => {
      delete (window as any).__cardFactoryOpenUpload
    }
  }, [])

  // 上传逻辑
  async function handleUpload() {
    if (!caseId || selectedFiles.length === 0) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("case_id", String(caseId))
      selectedFiles.forEach(file => formData.append("files", file))
      await evidenceApi.autoProcess(formData)
      toast({ title: "上传成功" })
      setIsUploadDialogOpen(false)
      setSelectedFiles([])
      // 刷新证据列表
      await mutate(['/api/evidences', String(caseId)])
    } catch (e) {
      toast({ title: "上传失败", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4">
          {/* 左侧：原始证据列表 */}
          <Card className="col-span-3">
            <CardHeader className="pb-2 pt-3 px-3 flex flex-col items-start gap-2">
              <CardTitle className="text-base flex items-center gap-2 w-full">
                <span>原始证据</span>
                <Badge variant="secondary" className="text-xs">
                  {evidenceList.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2 w-full flex-wrap">
                <Button
                  variant={isMultiSelect ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect)
                    if (!isMultiSelect) {
                      setSelectedEvidenceIds(new Set())
                    }
                  }}
                  className={cn(
                    "h-7 px-3 text-xs font-medium transition-all",
                    isMultiSelect
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                  )}
                >
                  {isMultiSelect ? "取消" : "多选"}
                </Button>
                {isMultiSelect && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      onClick={handleSelectAll}
                    >
                      全选
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => {
                        const allIds = evidenceList.map((e: any) => String(e.id)) as string[]
                        const inverted = new Set<string>(
                          allIds.filter((id) => !selectedEvidenceIds.has(id))
                        )
                        setSelectedEvidenceIds(inverted)
                      }}
                    >
                      反选
                    </Button>
                  </>
                )}
                <Button
                  onClick={handleCast}
                  disabled={selectedEvidenceIds.size === 0}
                  size="sm"
                  className="h-7 px-3 text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  铸造 {selectedEvidenceIds.size > 0 && `(${selectedEvidenceIds.size})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-3 space-y-2.5">
                  {evidenceList.map((evidence: any) => (
                    <OriginalEvidenceItem
                      key={evidence.id}
                      evidence={evidence}
                      isSelected={selectedEvidenceIds.has(String(evidence.id))}
                      isCast={isEvidenceCast(evidence.id)}
                      multiSelectMode={isMultiSelect}
                      onClick={() => handleEvidenceSelect(String(evidence.id))}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 中间：证据卡片列表和详情 */}
          <Card className="col-span-3">
            <CardHeader className="pb-2 pt-3 px-3 h-[44px] flex items-start">
              <CardTitle className="text-base flex items-center gap-2 w-full">
                <span>证据卡片</span>
                <Badge variant="secondary" className="text-xs">
                  {cardList.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="p-3 space-y-3">
                  {cardList.length > 0 ? (
                    cardList.map((card) => (
                      <EvidenceCardListItem
                        key={card.id}
                        card={card}
                        isSelected={selectedCard?.id === card.id}
                        isDragging={draggedCardId === `card-${card.id}`}
                        onClick={() => setSelectedCard(card)}
                        evidenceList={evidenceList}
                        onImageClick={(imageUrl, allUrls) => {
                          const currentIndex = allUrls.indexOf(imageUrl)
                          setPreviewImage({ url: imageUrl, urls: allUrls, currentIndex })
                        }}
                        onUpdateCard={async (cardId, updatedFeatures) => {
                          try {
                            // TODO: 调用API更新卡片
                            // await evidenceCardApi.updateCard(cardId, { card_features: updatedFeatures })
                            toast({
                              title: "保存成功",
                              description: "卡片信息已更新",
                            })
                            // 刷新卡片列表
                            mutateCards()
                          } catch (error: any) {
                            toast({
                              title: "保存失败",
                              description: error?.message || '未知错误',
                              variant: "destructive"
                            })
                          }
                        }}
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                      暂无证据卡片
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 右侧：案件信息、卡片槽位 */}
          <Card className="col-span-6">
            <CardHeader className="pb-2 pt-3 px-3 h-[44px] flex items-start">
              <div className="flex items-center justify-between w-full">
                <CardTitle className="text-base">案件信息</CardTitle>
                {!isEditingCase ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingCase(true)}
                    className="h-8 px-3 text-xs border-slate-300 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <Pencil className="h-3 w-3 mr-1.5" />
                    编辑
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelCaseInfo}
                      className="h-8 px-3 text-xs border-slate-300 hover:bg-slate-50 bg-transparent"
                    >
                      <X className="h-3 w-3 mr-1.5" />
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCaseInfo}
                      className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-3 w-3 mr-1.5" />
                      保存
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-6">
                  {/* 案件基本信息 */}
                  {finalCaseData && editedCaseInfo && (
                    <div>
                      <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-6 pb-6 border-b border-slate-200">
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500">案件ID</span>
                          <div className="text-sm font-semibold text-slate-900">#{editedCaseInfo.id}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500">案由</span>
                          {isEditingCase ? (
                            <Input
                              value={editedCaseInfo.description || ''}
                              onChange={(e) => setEditedCaseInfo({ ...editedCaseInfo, description: e.target.value })}
                              className="h-8 text-sm"
                              placeholder="请输入案由"
                            />
                          ) : (
                            <div className="text-sm font-medium text-slate-900">
                              {editedCaseInfo.description || 'N/A'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-slate-500">欠款金额</span>
                          {isEditingCase ? (
                            <Input
                              type="number"
                              value={editedCaseInfo.loan_amount || ''}
                              onChange={(e) => setEditedCaseInfo({ ...editedCaseInfo, loan_amount: Number(e.target.value) })}
                              className="h-8 text-sm"
                              placeholder="请输入欠款金额"
                            />
                          ) : (
                            <div className="text-sm font-semibold text-red-600">
                              {editedCaseInfo.loan_amount !== null && editedCaseInfo.loan_amount !== undefined
                                ? `¥${editedCaseInfo.loan_amount.toLocaleString()}`
                                : 'N/A'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 债权人信息 */}
                      {editedCaseInfo.case_parties?.find((p: any) => p.party_role === "creditor") && (
                        <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 mb-4">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-5 bg-blue-500 rounded-full" />
                            <h4 className="font-bold text-slate-900 text-sm">债权人</h4>
                          </div>
                          {(() => {
                            const creditor = editedCaseInfo.case_parties.find((p: any) => p.party_role === "creditor")
                            return (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">类型</span>
                                  <div className="text-sm font-medium text-slate-900">{creditor.party_type || 'N/A'}</div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">姓名</span>
                                  <div className="text-sm font-medium text-slate-900">{creditor.party_name || 'N/A'}</div>
                                </div>
                                {creditor.id_number && (
                                  <div className="space-y-1">
                                    <span className="text-xs text-slate-500">身份证号</span>
                                    <div className="text-xs font-mono text-slate-700 break-all">{creditor.id_number}</div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* 债务人信息 */}
                      {editedCaseInfo.case_parties?.find((p: any) => p.party_role === "debtor") && (
                        <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-100">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-5 bg-amber-500 rounded-full" />
                            <h4 className="font-bold text-slate-900 text-sm">债务人</h4>
                          </div>
                          {(() => {
                            const debtor = editedCaseInfo.case_parties.find((p: any) => p.party_role === "debtor")
                            return (
                              <div className="space-y-3">
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">类型</span>
                                  <div className="text-sm font-medium text-slate-900">{debtor.party_type || 'N/A'}</div>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-xs text-slate-500">姓名</span>
                                  <div className="text-sm font-medium text-slate-900">{debtor.party_name || 'N/A'}</div>
                                </div>
                                {debtor.id_number && (
                                  <div className="space-y-1">
                                    <span className="text-xs text-slate-500">身份证号</span>
                                    <div className="text-xs font-mono text-slate-700 break-all">{debtor.id_number}</div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* 卡片槽位 */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">卡片槽位</h3>
                    <p className="text-sm text-slate-500 mb-6">拖拽证据卡片到对应槽位进行分类整理</p>
                    
                    <div className="space-y-5">
                      {/* 身份证明槽位 */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2.5">身份证明</h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          <DroppableSlot
                            id="slot-creditor-identity"
                            title="债权人身份证明"
                            cardId={slotCards['creditor-identity']}
                            side="creditor"
                            category="身份证"
                          />
                          <DroppableSlot
                            id="slot-debtor-identity"
                            title="债务人身份证明"
                            cardId={slotCards['debtor-identity']}
                            side="debtor"
                            category="身份证"
                          />
                        </div>
                      </div>

                      {/* 聊天记录槽位 */}
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2.5">聊天记录</h4>
                        <div className="grid grid-cols-1 gap-2.5">
                          <DroppableSlot
                            id="slot-wechat-chat"
                            title="微信聊天记录"
                            cardId={slotCards['wechat-chat']}
                            side="shared"
                            category="微信聊天记录"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 拖拽覆盖层 */}
      <DragOverlay>
        {draggedCardId ? (
          (() => {
            const cardId = parseInt(draggedCardId.replace('card-', ''))
            const card = cardList.find(c => c.id === cardId)
            return card ? (
              <div className="p-3 rounded-lg border bg-white shadow-lg opacity-90">
                <div className="text-sm font-medium">卡片ID #{card.id}</div>
                <div className="text-xs text-gray-600">
                  {card.card_info?.card_type || '未知类型'}
                </div>
              </div>
            ) : null
          })()
        ) : null}
      </DragOverlay>

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
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-0"
                size="sm"
              >
                关闭
              </Button>
              
              {/* 上一张按钮 */}
              {previewImage.urls.length > 1 && (
                <>
                  <Button 
                    onClick={() => {
                      const prevIndex = previewImage.currentIndex > 0 
                        ? previewImage.currentIndex - 1 
                        : previewImage.urls.length - 1
                      setPreviewImage({
                        url: previewImage.urls[prevIndex],
                        urls: previewImage.urls,
                        currentIndex: prevIndex
                      })
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* 下一张按钮 */}
                  <Button 
                    onClick={() => {
                      const nextIndex = previewImage.currentIndex < previewImage.urls.length - 1
                        ? previewImage.currentIndex + 1
                        : 0
                      setPreviewImage({
                        url: previewImage.urls[nextIndex],
                        urls: previewImage.urls,
                        currentIndex: nextIndex
                      })
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0"
                    size="sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {/* 图片计数器 */}
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm font-semibold">
                    {previewImage.currentIndex + 1}/{previewImage.urls.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 上传证据弹窗 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>上传新证据</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="fileUpload">上传文件 *</Label>
              <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">点击上传或拖拽文件到此处</p>
                <p className="text-sm text-gray-500">支持图片、PDF、Excel、Word等格式，最大 50MB</p>
                <Input 
                  type="file" 
                  className="hidden" 
                  id="fileUpload" 
                  multiple 
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                  onChange={e => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files)
                      const supportedFormats = [
                        // 图片格式
                        'jpg', 'jpeg', 'png', 'bmp', 'webp', 'gif', 'svg',
                        // 文档格式
                        'pdf', 'doc', 'docx', 'txt',
                        // 表格格式
                        'xls', 'xlsx', 'csv',
                        // 其他格式
                        'mp3', 'mp4', 'wav'
                      ]
                      
                      // 验证文件类型
                      const validFiles = files.filter(file => {
                        const ext = file.name.split('.').pop()?.toLowerCase()
                        return ext && supportedFormats.includes(ext)
                      })
                      
                      if (validFiles.length !== files.length) {
                        const invalidFiles = files.filter(file => {
                          const ext = file.name.split('.').pop()?.toLowerCase()
                          return !ext || !supportedFormats.includes(ext)
                        })
                        alert(`以下文件格式不支持，已自动过滤：\n${invalidFiles.map(f => f.name).join('\n')}\n\n支持的格式：${supportedFormats.join(', ')}`)
                      }
                      
                      setSelectedFiles(validFiles)
                    }
                  }} 
                />
                <Button
                  variant="outline"
                  className="mt-4 bg-transparent"
                  onClick={() => document.getElementById("fileUpload")?.click()}
                >
                  选择文件
                </Button>
                {selectedFiles.length > 0 && (
                  <div className="mt-2 text-sm text-gray-700">已选择 {selectedFiles.length} 个文件</div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
                {uploading ? "上传中..." : "上传证据"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}