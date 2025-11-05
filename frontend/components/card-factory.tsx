"use client"

import React, { useState, Suspense, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Upload,
  AlertCircle,
  Info
} from "lucide-react"
import { evidenceApi, evidenceCardApi, caseApi, type EvidenceCard, type EvidenceCardSlotTemplate, type EvidenceCardTemplate } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useGlobalTasks } from "@/contexts/global-task-context"
import { useCardCasting } from "@/hooks/use-celery-tasks"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  CollisionDetection,
} from '@dnd-kit/core'
import {
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  onClick,
  isDraggable,
  dragId
}: { 
  evidence: any
  isSelected: boolean
  isCast: boolean
  multiSelectMode: boolean
  onClick: () => void
  isDraggable?: boolean
  dragId?: string
}) {
  const fileTypeInfo = getFileTypeInfo(evidence.file_name || '')
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId || `evidence-${evidence.id}`,
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? { ...attributes, ...listeners } : {})} // 当可拖拽时，将拖拽属性绑定到整个卡片
      className={cn(
        "w-full p-3 rounded-xl border text-left transition-all duration-200 hover:shadow-lg group relative overflow-hidden",
        isSelected
          ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
        isDraggable && "cursor-grab active:cursor-grabbing select-none", // 添加 select-none 防止文本选择
        isDragging && "opacity-30" // 拖拽时降低透明度，但不移动原卡片
      )}
      onClick={onClick}
      onMouseDown={(e) => {
        // 防止在拖动时触发文本选择
        if (isDraggable && e.target === e.currentTarget) {
          e.preventDefault()
        }
      }}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
      )}

      <div className="flex items-center gap-3">
        {/* 拖拽句柄 - 仅在可拖拽时显示，放在最左侧，与引用证据列表保持一致 */}
        {isDraggable && (
          <div
            className="flex-shrink-0 text-slate-400 pointer-events-none" // 使用 pointer-events-none 防止图标干扰拖拽
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
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
    </div>
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
  onUpdateCard,
  isExpanded,
  onToggleExpand,
  currentImageIdx,
  onImageIndexChange,
  onUpdateReferencedEvidences,
  isDragOver,
  dragOverEvidenceId,
  dragOverInsertPosition
}: { 
  card: EvidenceCard
  isSelected: boolean
  isDragging: boolean
  onClick: () => void
  evidenceList: any[]
  onImageClick: (imageUrl: string, allUrls: string[]) => void
  onUpdateCard?: (cardId: number, updatedFeatures: any[]) => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  currentImageIdx?: number
  onImageIndexChange?: (index: number) => void
  onUpdateReferencedEvidences?: (cardId: number, evidenceIds: number[]) => void
  isDragOver?: boolean
  dragOverEvidenceId?: number | null
  dragOverInsertPosition?: 'before' | 'after' | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedFeatures, setEditedFeatures] = useState<any[]>([])
  const [isHoveringImage, setIsHoveringImage] = useState(false)
  
  const { attributes, listeners, setNodeRef, isDragging: isLocalDragging } = useDraggable({
    id: `card-${card.id}`,
    disabled: false, // 始终允许拖拽，不受展开状态影响
  })

  // 不使用 transform，让原卡片保持原位，使用 DragOverlay 显示拖拽副本
  const style = undefined
  
  // 使用传入的isDragging prop（表示正在拖拽）或本地isLocalDragging
  const isCurrentlyDragging = isDragging || isLocalDragging

  const cardInfo = card.card_info || {}
  const cardType = cardInfo.card_type || '未知类型'
  const firstEvidenceId = card.evidence_ids[0]
  // 根据 card_is_associated 判断是否是联合证据卡片，而不是根据引用证据数量
  const isCombined = cardInfo.card_is_associated === true
  const cardFeatures = cardInfo.card_features || []

  // 显示所有字段，包括null值（null值会显示为"N/A"）
  const allFeatures = cardFeatures

  // 初始化编辑数据
  useEffect(() => {
    if (isEditing && cardFeatures.length > 0) {
      setEditedFeatures(JSON.parse(JSON.stringify(cardFeatures)))
    }
  }, [isEditing, cardFeatures])

  // 获取关联的证据图片URL（按序号排序）
  const getEvidenceUrls = () => {
    // card.evidence_ids 已经是按序号排序的
    return card.evidence_ids
      .map(id => {
        const evidence = evidenceList.find((e: any) => e.id === id)
        return evidence?.file_url || null
      })
      .filter(url => url !== null) as string[]
  }

  const evidenceUrls = getEvidenceUrls()
  const currentIdx = currentImageIdx ?? 0
  const currentImageUrl = evidenceUrls[currentIdx] || evidenceUrls[0] || null

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentImageUrl) {
      onImageClick(currentImageUrl, evidenceUrls)
    }
  }

  const handlePreviousImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 1 && onImageIndexChange) {
      const newIndex = currentIdx === 0 ? evidenceUrls.length - 1 : currentIdx - 1
      onImageIndexChange(newIndex)
    }
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (evidenceUrls.length > 1 && onImageIndexChange) {
      const newIndex = currentIdx === evidenceUrls.length - 1 ? 0 : currentIdx + 1
      onImageIndexChange(newIndex)
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
      {...attributes}
      {...listeners} // 将拖拽属性绑定到整个卡片
      onClick={onClick}
      onMouseDown={(e) => {
        // 防止在拖动时触发文本选择
        if (e.target === e.currentTarget) {
          e.preventDefault()
        }
      }}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-all duration-200 hover:shadow-lg group relative overflow-hidden",
        isSelected
          ? "border-blue-400 shadow-lg ring-2 ring-blue-200 bg-blue-50/50"
          : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/30",
        "cursor-grab active:cursor-grabbing select-none", // 整个卡片可拖拽
        isCurrentlyDragging && "opacity-40", // 拖拽时原卡片降低透明度，保持可见但不干扰
        // 拖拽悬停时的视觉反馈
        isDragOver && "ring-2 ring-green-400 border-green-400 bg-green-50/30"
      )}
    >
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600" />
      )}

      {/* 拖拽句柄 - 放在顶部中央 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex-shrink-0 text-slate-400 pointer-events-none z-10">
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="space-y-3">
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
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 backdrop-blur-sm"
                      aria-label="下一张"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </>
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

        {/* 联合证据卡片的展开/收起按钮 */}
        {isCombined && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-sm border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              if (onToggleExpand) {
                onToggleExpand()
              }
            }}
          >
            {isExpanded ? (
              <>
                <X className="h-4 w-4 mr-2" />
                收起引用证据 ({card.evidence_ids.length})
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                展开引用证据 ({card.evidence_ids.length})
              </>
            )}
          </Button>
        )}

        {/* 展开的引用证据列表 - 拖拽时隐藏 */}
        {isCombined && isExpanded && !isCurrentlyDragging && (
          <ReferencedEvidenceList
            card={card}
            evidenceList={evidenceList}
            onUpdateReferencedEvidences={onUpdateReferencedEvidences}
            onRemoveEvidence={(evidenceId) => {
              if (onUpdateReferencedEvidences) {
                const newEvidenceIds = card.evidence_ids.filter(id => id !== evidenceId)
                onUpdateReferencedEvidences(card.id, newEvidenceIds)
              }
            }}
            dragOverEvidenceId={dragOverEvidenceId}
            dragOverInsertPosition={dragOverInsertPosition}
          />
        )}
      </div>
    </div>
  )
}

// 拖拽卡片预览组件（用于 DragOverlay，不含引用证据部分）
function DraggedCardPreview({ 
  card, 
  evidenceList 
}: { 
  card: EvidenceCard
  evidenceList: any[]
}) {
  const cardInfo = card.card_info || {}
  const cardType = cardInfo.card_type || '未知类型'
  const isCombined = cardInfo.card_is_associated === true
  const cardFeatures = cardInfo.card_features || []
  const allFeatures = cardFeatures

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
  const currentImageUrl = evidenceUrls[0] || null

  return (
    <div className="w-full max-w-[240px] p-2.5 rounded-lg border-2 border-blue-400 bg-white shadow-lg opacity-65 ring-2 ring-blue-200 pointer-events-none">
      <div className="space-y-2">
        {/* 缩略图 */}
        {isCombined ? (
          <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-slate-50 border border-slate-200">
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
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
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
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
                const isNullValue = feature.slot_value === null || feature.slot_value === undefined || feature.slot_value === ''
                
                return (
                  <div key={`${feature.slot_name}-${index}`} className="flex flex-col gap-1">
                    <Label className="text-xs font-medium text-slate-500">{feature.slot_name}</Label>
                    <span className="text-xs text-slate-900 font-medium break-words">
                      {isNullValue 
                        ? 'N/A'
                        : feature.slot_value_type === 'boolean' 
                          ? (feature.slot_value ? '是' : '否')
                          : String(feature.slot_value)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
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

// 引用证据列表组件（支持拖动排序、移除、添加）
function ReferencedEvidenceList({
  card,
  evidenceList,
  onUpdateReferencedEvidences,
  onRemoveEvidence,
  dragOverEvidenceId,
  dragOverInsertPosition
}: {
  card: EvidenceCard
  evidenceList: any[]
  onUpdateReferencedEvidences?: (cardId: number, evidenceIds: number[]) => void
  onRemoveEvidence?: (evidenceId: number) => void
  dragOverEvidenceId?: number | null
  dragOverInsertPosition?: 'before' | 'after' | null
}) {
  const [hoveredEvidenceId, setHoveredEvidenceId] = useState<number | null>(null)
  
  // 使用 useDroppable 使引用证据列表区域可以接收从左侧拖入的证据
  // 注意：不再使用嵌套的 DndContext，所有拖拽逻辑都在外部处理
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `referenced-evidence-list-${card.id}`,
  })

  // 获取引用证据的详细信息（按序号排序）
  const referencedEvidences = card.evidence_ids
    .map((evidenceId, index) => {
      const evidence = evidenceList.find((e: any) => e.id === evidenceId)
      return evidence ? { ...evidence, sequence_number: index } : null
    })
    .filter((e): e is any => e !== null)

  const handleRemove = (evidenceId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRemoveEvidence) {
      onRemoveEvidence(evidenceId)
    }
  }

  return (
    // 注意：这里不使用嵌套的 DndContext，所有拖拽逻辑都在外部的 CardFactory 的 DndContext 中处理
    // 这样可以避免冲突，确保外部拖入的证据能够正确到达引用证据列表
    <div
      ref={setDroppableRef}
      className={cn(
        "mt-3 pt-3 border-t space-y-3 transition-all",
          isOver 
            ? "border-green-400 bg-green-50/30" 
            : "border-slate-200"
      )}
      id={`referenced-evidence-list-${card.id}`}
    >
      <div className="text-xs font-medium text-slate-600 mb-2">
        引用证据列表：
      </div>
      <SortableContext
        items={referencedEvidences.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
          {referencedEvidences.map((evidence, index) => {
            const isDragOverItem = dragOverEvidenceId === evidence.id
            const shouldShowInsertLineBefore = isDragOverItem && dragOverInsertPosition === 'before'
            const shouldShowInsertLineAfter = isDragOverItem && dragOverInsertPosition === 'after'
            
            return (
              <React.Fragment key={evidence.id}>
                {/* 插入位置指示线 - 在目标项之前显示（当插入位置为 before 时） */}
                {shouldShowInsertLineBefore && (
                  <div className="h-1 bg-green-500 rounded-full mx-2 my-2 shadow-lg border-2 border-green-600" />
                )}
                <SortableReferencedEvidenceItem
                  evidence={evidence}
                  index={index}
                  cardId={card.id}
                  onRemove={handleRemove}
                  isHovered={hoveredEvidenceId === evidence.id || isDragOverItem} // 当拖拽悬停时也显示悬停效果
                  onMouseEnter={() => setHoveredEvidenceId(evidence.id)}
                  onMouseLeave={() => {
                    // 只有在不是拖拽悬停时才清除悬停状态
                    if (!isDragOverItem) {
                      setHoveredEvidenceId(null)
                    }
                  }}
                  isDragOver={isDragOverItem}
                />
                {/* 插入位置指示线 - 在目标项之后显示（当插入位置为 after 时） */}
                {shouldShowInsertLineAfter && (
                  <div className="h-1 bg-green-500 rounded-full mx-2 my-2 shadow-lg border-2 border-green-600" />
                )}
              </React.Fragment>
            )
          })}
          {/* 插入位置指示线 - 拖拽到列表末尾时显示 */}
          {isOver && !dragOverEvidenceId && (
            <div className="h-1 bg-green-500 rounded-full mx-2 my-2 shadow-lg border-2 border-green-600" />
          )}
      </SortableContext>
    </div>
  )
}

// 可排序的引用证据项组件
function SortableReferencedEvidenceItem({
  evidence,
  index,
  cardId,
  onRemove,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  isDragOver
}: {
  evidence: any
  index: number
  cardId: number
  onRemove: (evidenceId: number, e: React.MouseEvent) => void
  isHovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  isDragOver?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: evidence.id })
  
  // 使用 useDroppable 使引用证据项可以接收从左侧拖入的证据
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `referenced-evidence-${evidence.id}`,
  })
  
  // 合并两个 ref
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node)
    setDroppableRef(node)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const fileTypeInfo = getFileTypeInfo(evidence.file_name || '')

  return (
    <div
      ref={setRefs}
      style={style}
      {...attributes} // 将拖拽属性绑定到整个卡片
      {...listeners}
      data-evidence-id={evidence.id}
      className={cn(
        "relative p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all group/reference-item cursor-grab active:cursor-grabbing select-none", // 整个卡片可拖拽
        isDragging && "opacity-50",
        isOver && "border-blue-400 bg-blue-100",
        // 拖拽悬停时的视觉反馈
        isDragOver && "border-green-400 bg-green-100 ring-2 ring-green-300",
        // 悬停时的视觉反馈
        isHovered && "border-blue-400 bg-blue-50"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2.5">
        {/* 拖拽句柄 - 仅作为视觉指示 */}
        <div
          className="flex-shrink-0 text-slate-400 pointer-events-none" // 使用 pointer-events-none 防止图标干扰拖拽
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* 序号 */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </div>
        
        {/* 缩略图 */}
        <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden border border-slate-200 bg-white">
          {fileTypeInfo.type === 'image' && evidence.file_url ? (
            <img
              src={evidence.file_url}
              alt={evidence.file_name || ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full ${fileTypeInfo.bgColor} flex items-center justify-center`}>
              <span className="text-lg">{fileTypeInfo.icon}</span>
            </div>
          )}
        </div>

        {/* 证据信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-slate-500">证据ID</span>
            <span className="text-xs font-semibold text-blue-600">#{evidence.id}</span>
          </div>
          <p className="text-xs font-medium text-slate-900 truncate">{evidence.file_name || ''}</p>
        </div>

        {/* 移除按钮 - 悬停时显示 */}
        {isHovered && (
          <button
            onClick={(e) => onRemove(evidence.id, e)}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-all"
            aria-label="移除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
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

// 格式化模板标签 - 美化template_id显示
function formatTemplateLabel(template: EvidenceCardSlotTemplate): React.ReactNode {
  // 显示案由、当事人类型、核心证据类型
  const parts: string[] = []
  
  // 案由
  if (template.case_cause) {
    parts.push(template.case_cause)
  }
  
  // 当事人类型（个人对个人）
  if (template.creditor_type && template.debtor_type) {
    parts.push(`${template.creditor_type}对${template.debtor_type}`)
  }
  
  // 核心证据类型
  if (template.key_evidence_name) {
    parts.push(template.key_evidence_name)
  }
  
  return parts.join(' • ')
}

// 判断卡片类型应该属于哪个角色 - 根据role_requirement
// 返回一个数组，因为'all'需要在两个区域都显示
function getCardRoles(cardTemplate: EvidenceCardTemplate): Array<'creditor' | 'debtor' | 'shared'> {
  const roleRequirement = cardTemplate.role_requirement
  
  if (!roleRequirement || roleRequirement === 'ignore') {
    return ['shared'] // 忽略角色，放在共享区域
  }
  
  if (roleRequirement === 'all') {
    return ['creditor', 'debtor'] // 双方都需要，在两个区域都显示
  }
  
  if (roleRequirement === 'creditor') {
    return ['creditor'] // 仅债权人需要
  }
  
  if (roleRequirement === 'debtor') {
    return ['debtor'] // 仅债务人需要
  }
  
  return ['shared'] // 默认共享
}

// 渲染卡片槽位
function renderCardSlots(
  cardTypes: EvidenceCardTemplate[],
  role: 'creditor' | 'debtor' | 'shared',
  slotCards: Record<string, number | null>,
  template?: EvidenceCardSlotTemplate,
  cardList?: EvidenceCard[],
  draggingCardType?: string | null,
  onRemoveCard?: (slotId: string) => void
): React.ReactElement | null {
  // 过滤出属于当前角色的卡片类型 - 根据role_requirement
  const filteredCards = cardTypes.filter(cardType => {
    const cardRoles = getCardRoles(cardType)
    return cardRoles.includes(role)
  })

  if (filteredCards.length === 0) {
    const alignClass = role === 'creditor' ? 'text-left' : role === 'debtor' ? 'text-right' : 'text-center'
    return (
      <div className={cn("text-xs text-slate-400 py-4", alignClass)}>
        暂无相关槽位
      </div>
    )
  }

  // 按or_group分组，用于显示分组信息
  const groupedByOrGroup: Record<string, EvidenceCardTemplate[]> = {}
  const ungroupedCards: EvidenceCardTemplate[] = []
  
  filteredCards.forEach(cardType => {
    if (cardType.or_group) {
      if (!groupedByOrGroup[cardType.or_group]) {
        groupedByOrGroup[cardType.or_group] = []
      }
      groupedByOrGroup[cardType.or_group].push(cardType)
    } else {
      ungroupedCards.push(cardType)
    }
  })

  return (
    <div className="space-y-4">
      {/* 无分组的卡片 */}
      {ungroupedCards.map((cardType, index) => {
        const slotId = `slot::${role}::${cardType.card_type}::${index}`
        const cardId = slotCards[slotId] ?? undefined
        const placedCard = cardId ? cardList?.find(c => c.id === cardId) : null
        
        return (
          <CardSlotUnit
            key={slotId}
            id={slotId}
            cardType={cardType.card_type}
            requiredSlots={cardType.required_slots}
            cardId={cardId}
            placedCard={placedCard}
            side={role}
            orGroup={null}
            draggingCardType={draggingCardType}
            onRemoveCard={onRemoveCard}
          />
        )
      })}
      
      {/* 分组的卡片 */}
      {Object.entries(groupedByOrGroup).map(([orGroupName, groupCards], groupIndex) => {
        // 检查该组内是否有卡片已被放置（card_id 不为 null 且不为 undefined）
        const groupPlacedCards = groupCards.filter((cardType, cardIndex) => {
          const slotId = `slot::${role}::${cardType.card_type}::${groupIndex}-${cardIndex}`
          const cardId = slotCards[slotId]
          return cardId !== undefined && cardId !== null
        })
        const isGroupSatisfied = groupPlacedCards.length > 0
        
        return (
          <OrGroupContainer
            key={orGroupName}
            groupName={orGroupName}
            isSatisfied={isGroupSatisfied}
            role={role}
          >
            {groupCards.map((cardType, cardIndex) => {
              const slotId = `slot::${role}::${cardType.card_type}::${groupIndex}-${cardIndex}`
              const cardId = slotCards[slotId] ?? undefined
              const placedCard = cardId ? cardList?.find(c => c.id === cardId) : null
              const isSelected = cardId !== undefined
              
              return (
                <React.Fragment key={slotId}>
                  {/* OR连接器和标签 - 位于两个卡槽之间的间隔中 */}
                  {cardIndex > 0 && (
                    <div className="relative flex items-center justify-center my-4 z-50">
                      {/* 左侧连接线 */}
                      <div className="flex-1 h-0.5 bg-slate-300" />
                      {/* OR标签 */}
                      <div className="mx-3 flex-shrink-0">
                        <div className="bg-white border-2 border-slate-300 rounded-full px-2.5 py-1 shadow-md">
                          <span className="text-[10px] font-bold text-slate-600">OR</span>
                        </div>
                      </div>
                      {/* 右侧连接线 */}
                      <div className="flex-1 h-0.5 bg-slate-300" />
                    </div>
                  )}
                  
                  <CardSlotUnit
                    id={slotId}
                    cardType={cardType.card_type}
                    requiredSlots={cardType.required_slots}
                    cardId={cardId}
                    placedCard={placedCard}
                    side={role}
                    orGroup={orGroupName}
                    isInOrGroup={true}
                    isSelected={isSelected}
                    draggingCardType={draggingCardType}
                    onRemoveCard={onRemoveCard}
                  />
                </React.Fragment>
              )
            })}
          </OrGroupContainer>
        )
      })}
    </div>
  )
}

// 或关系组容器组件 - 提供明确的视觉分组和OR关系表达
function OrGroupContainer({
  groupName,
  isSatisfied,
  role,
  children
}: {
  groupName: string
  isSatisfied: boolean
  role: 'creditor' | 'debtor' | 'shared'
  children: React.ReactNode
}) {
  // 根据状态选择不同的边框颜色
  const getBorderColor = () => {
    if (isSatisfied) {
      return "border-green-400"
    }
    // 未满足时使用灰色（初始状态）
    return "border-slate-300"
  }

  const getBackgroundColor = () => {
    if (isSatisfied) {
      return "bg-green-50/30"
    }
    // 未满足时使用灰色（初始状态）
    return "bg-slate-50/30"
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 space-y-3 transition-all",
        getBorderColor(),
        getBackgroundColor(),
        isSatisfied && "ring-2 ring-green-200"
      )}
    >
      {/* 组标题 */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            isSatisfied ? "bg-green-500" : "bg-slate-400"
          )} />
          <span className={cn(
            "text-xs font-semibold",
            isSatisfied ? "text-green-700" : "text-slate-700"
          )}>
            或关系组: {groupName}
          </span>
          <Badge 
            variant="outline" 
            className={cn(
              "h-4 px-1.5 text-[10px]",
              isSatisfied
                ? "border-green-400 text-green-700 bg-green-50"
                : "border-slate-300 text-slate-600 bg-slate-50"
            )}
          >
            {isSatisfied ? "✓ 已满足" : "待选择"}
          </Badge>
        </div>
        <div className={cn(
          "text-[10px] font-medium",
          isSatisfied ? "text-green-600" : "text-slate-500"
        )}>
          满足其中一个即可
        </div>
      </div>

      {/* 组内容 */}
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

// 卡片槽位单元组件 - 一个card_type对应一个槽位，槽位内显示required_slots字段列表
// 样式类似卡片模板，拖入后显示紧凑样式
function CardSlotUnit({
  id,
  cardType,
  requiredSlots,
  cardId,
  placedCard,
  side,
  orGroup,
  isInOrGroup = false,
  isSelected = false,
  draggingCardType = null,
  onRemoveCard
}: {
  id: string
  cardType: string
  requiredSlots: Array<{ slot_name: string; need_proofreading: boolean }>
  cardId?: number
  placedCard?: EvidenceCard | null
  side?: "creditor" | "debtor" | "shared"
  orGroup?: string | null
  isInOrGroup?: boolean
  isSelected?: boolean
  draggingCardType?: string | null
  onRemoveCard?: (slotId: string) => void
}) {
  const [hoveredSlotName, setHoveredSlotName] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const iconRefs = useRef<Record<string, HTMLDivElement | null>>({})
  
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  // 获取卡片特征值（如果有放置的卡片）
  const getSlotValue = (slotName: string): string | null => {
    if (!placedCard) {
      return null
    }
    
    // 确保 card_info 存在
    if (!placedCard.card_info) {
      return null
    }
    
    const cardFeatures = placedCard.card_info.card_features || []
    
    // 查找匹配的字段（支持大小写不敏感匹配）
    const feature = cardFeatures.find((f: any) => {
      if (!f || !f.slot_name) return false
      // 精确匹配
      if (f.slot_name === slotName) return true
      // 去除空格后匹配
      if (f.slot_name.trim() === slotName.trim()) return true
      return false
    })
    
    if (!feature) {
      return null
    }
    
    const value = feature.slot_value
    // 处理 null、undefined、空字符串
    if (value === null || value === undefined || value === '') {
      return null
    }
    
    return String(value)
  }

  // 模拟校对结果（实际应该从后端获取）
  const getProofreadingResult = (slotName: string): { status: 'passed' | 'failed'; message: string; reason: string } | null => {
    if (!placedCard || !cardId) return null
    
    const slot = requiredSlots.find(s => s.slot_name === slotName)
    if (!slot) return null
    
    const value = getSlotValue(slotName)
    if (!value) return null
    
    // 情况1: 无需校对 - 自动通过
    if (!slot.need_proofreading) {
      return {
        status: 'passed',
        message: '✓ 无需校对，自动通过',
        reason: `该字段 "${slotName}" 无需校对，字段值 "${value}" 已自动验证通过`
      }
    }
    
    // 情况2: 需要校对 - 模拟校对结果
    // 模拟：根据字段名称和值生成稳定的校对结果（避免每次渲染都变化）
    // 实际应该从后端获取
    const hash = (slotName + value).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const isConsistent = hash % 3 !== 0 // 约67%概率一致
    
    if (isConsistent) {
      // 需要校对且通过
      return {
        status: 'passed',
        message: '✓ 校对通过',
        reason: `字段值 "${value}" 已通过校对验证，与案件信息匹配一致`
      }
    } else {
      // 需要校对但失败
      return {
        status: 'failed',
        message: '✗ 校对失败',
        reason: `字段值 "${value}" 与案件信息不一致，可能存在以下问题：\n1. 姓名拼写不匹配\n2. 金额数值不符\n3. 日期格式错误\n请检查并修正`
      }
    }
  }

  // 检查当前拖拽的卡片类型是否匹配此槽位
  // 只要有拖拽就显示反馈，不依赖 isOver（这样所有卡槽都会高亮）
  const isDragging = draggingCardType !== null
  const isTypeMatch = isDragging && draggingCardType === cardType
  const isRejecting = isDragging && draggingCardType !== cardType

  const getSlotBackground = () => {
    // 如果有卡片已放置，正常显示
    if (cardId) {
      return "bg-white"
    }
    
    // 如果正在拖拽，所有卡槽都应该有反馈
    if (isDragging) {
      // 如果类型不匹配，显示拒绝样式（红色）
      if (isRejecting) {
        // 悬停时显示更明显的红色背景
        return isOver ? "bg-red-100" : "bg-red-50/50"
      }
      // 如果类型匹配，显示接受样式（绿色）
      if (isTypeMatch) {
        // 悬停时显示更明显的绿色背景
        if (isInOrGroup) {
          return isOver ? "bg-blue-100" : "bg-blue-50"
        }
        return isOver ? "bg-green-100" : "bg-green-50"
      }
      // 如果类型不明确，也显示红色（拒绝）
      return isOver ? "bg-red-100" : "bg-red-50/50"
    }
    
    if (isInOrGroup) {
      if (isSelected) {
        return "bg-white"
      }
      return "bg-white"
    }
    
    // 默认状态（不在拖拽时）
    if (side === "creditor") {
      return "bg-blue-50/30 hover:bg-blue-50"
    }
    if (side === "debtor") {
      return "bg-slate-50/30 hover:bg-slate-50"
    }
    return "bg-slate-50 hover:bg-slate-100"
  }

  const getBorderColor = () => {
    // 如果有卡片已放置，正常显示
    if (cardId) {
      return "border-green-400"
    }
    
    // 如果正在拖拽，所有卡槽都应该有反馈
    if (isDragging) {
      // 如果类型不匹配，显示拒绝样式（红色虚线）
      if (isRejecting) {
        // 悬停时显示更粗的红色边框，更明显的禁止效果
        return isOver ? "border-red-600 border-4 border-dashed" : "border-red-400 border-dashed"
      }
      // 如果类型匹配，显示接受样式（绿色实线）
      if (isTypeMatch) {
        // 悬停时显示更粗的绿色边框
        if (isInOrGroup) {
          return isOver ? "border-blue-600 border-4" : "border-blue-400"
        }
        return isOver ? "border-green-600 border-4" : "border-green-400"
      }
      // 如果类型不明确，也显示红色（拒绝）
      return isOver ? "border-red-600 border-4 border-dashed" : "border-red-400 border-dashed"
    }
    
    if (isInOrGroup) {
      if (isSelected) {
        return "border-green-400"
      }
      return "border-slate-300 border-dashed"
    }
    
    // 默认状态（不在拖拽时）
    if (side === "creditor") {
      return "border-blue-300"
    }
    if (side === "debtor") {
      return "border-slate-300"
    }
    return "border-slate-300"
  }

  const hasCard = cardId !== undefined

  return (
    <div
      ref={setNodeRef}
      data-dnd-kit-droppable-id={id} // 确保元素有正确的 data 属性用于查找
      className={cn(
        "rounded-xl border transition-all duration-200 relative overflow-hidden",
        "p-3",
        getSlotBackground(),
        getBorderColor(),
        !cardId && !isInOrGroup && "border-dashed",
        // 悬停时显示明显的视觉反馈，根据类型匹配情况显示不同颜色的 ring
        isOver && isRejecting && "ring-4 ring-red-500 scale-[1.02] shadow-lg cursor-not-allowed", // 拒绝时显示红色 ring 和禁止光标
        isOver && isTypeMatch && "ring-4 ring-green-500 scale-[1.02] shadow-lg", // 匹配时显示绿色 ring
        isOver && !isRejecting && !isTypeMatch && "ring-4 ring-blue-400 scale-[1.02] shadow-lg", // 其他情况显示蓝色 ring
        hasCard && "shadow-sm", // 有卡片时显示阴影
      )}
    >
      {/* 禁止覆盖层 - 当悬停且类型不匹配时显示 */}
      {isOver && isRejecting && (
        <div className="absolute inset-0 bg-red-500/10 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8 text-red-600 animate-pulse" />
            <span className="text-sm font-semibold text-red-700">类型不匹配</span>
          </div>
        </div>
      )}

      {/* 卡片头部 - 类似证据卡片样式 */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {isInOrGroup && (
            <div className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              isSelected ? "bg-green-500" : "bg-slate-300"
            )} />
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium">卡片</span>
            {cardId ? (
              <span className="text-xs font-bold text-blue-600">#{cardId}</span>
            ) : (
              <span className="text-xs text-slate-400">待放置</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-900">{cardType}</div>
          {/* 移除按钮 - 只在有卡片时显示 */}
          {cardId && onRemoveCard && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 hover:bg-red-100 hover:text-red-600 text-slate-400"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveCard(id)
              }}
              title="移除卡片"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* 字段列表 - 紧凑样式 */}
      <div className={cn(
        "space-y-1.5",
        hasCard && "pt-2 border-t border-slate-200"
      )}>
        {requiredSlots.map((slot, index) => {
          const slotValue = getSlotValue(slot.slot_name)
          const hasValue = slotValue !== null && slotValue !== undefined && slotValue !== ''
          const proofreadingResult = hasValue ? getProofreadingResult(slot.slot_name) : null
          
          return (
            <div
              key={`${slot.slot_name}-${index}`}
              className={cn(
                "flex items-center justify-between py-1.5 px-2.5 rounded text-xs",
                hasValue
                  ? "bg-slate-50/50"
                  : "bg-transparent"
              )}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={cn(
                  "text-xs font-medium flex-shrink-0",
                  hasValue ? "text-slate-700" : "text-slate-500"
                )}>
                  {slot.slot_name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0 ml-2">
                {hasValue ? (
                  <>
                    <span className="text-xs text-slate-900 break-words text-right">
                      {String(slotValue)}
                    </span>
                    {/* 只要有值且有卡片，就应该显示校对结果图标 */}
                    {cardId && proofreadingResult ? (
                      <div 
                        ref={(el) => {
                          iconRefs.current[slot.slot_name] = el
                        }}
                        className="relative flex-shrink-0 cursor-help"
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setTooltipPosition({
                            top: rect.bottom + 8,
                            left: rect.right - 256 // 256px = 64 * 4 (w-64)
                          })
                          setHoveredSlotName(slot.slot_name)
                        }}
                        onMouseLeave={() => {
                          setHoveredSlotName(null)
                          setTooltipPosition(null)
                        }}
                      >
                        {proofreadingResult.status === 'passed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-red-600" />
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">待填充</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 拖入提示 - 只在未放置卡片时显示 */}
      {!cardId && (
        <div className="mt-2 pt-2 border-t border-slate-200 text-center">
          <div className="text-[10px] text-slate-400">
            {isOver ? "松开放置" : "拖入卡片"}
          </div>
        </div>
      )}

      {/* 悬浮提示 - 使用Portal渲染到body */}
      {hoveredSlotName && tooltipPosition && (() => {
        const slot = requiredSlots.find(s => s.slot_name === hoveredSlotName)
        if (!slot) return null
        const proofreadingResult = getProofreadingResult(hoveredSlotName)
        if (!proofreadingResult) return null

        return createPortal(
          <div 
            className="fixed z-[9999] w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl whitespace-normal pointer-events-none"
            style={{
              top: `${tooltipPosition.top}px`,
              left: typeof window !== 'undefined' 
                ? `${Math.max(8, Math.min(tooltipPosition.left, window.innerWidth - 272))}px` 
                : `${tooltipPosition.left}px`,
            }}
          >
            <div className={cn(
              "font-semibold mb-2",
              proofreadingResult.status === 'passed' ? 'text-green-400' : 'text-red-400'
            )}>
              {proofreadingResult.message}
            </div>
            <div className="text-slate-300 leading-relaxed whitespace-pre-line">
              {proofreadingResult.reason}
            </div>
            {/* 箭头 */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-900 rotate-45" />
          </div>,
          document.body
        )
      })()}
    </div>
  )
}

// 可放置的槽位组件（参考demo设计）- 保留用于其他可能的场景
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
      return "bg-slate-50/50 hover:bg-slate-100/70"
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
      return "border-slate-300"
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
  const [slotCards, setSlotCards] = useState<Record<string, number | null>>({})
  const [isEditingCase, setIsEditingCase] = useState(false)
  const [editedCaseInfo, setEditedCaseInfo] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; urls: string[]; currentIndex: number } | null>(null)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null) // 当前展开的卡片ID
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<number, number>>({}) // 每个卡片的当前图片索引
  const [dragOverEvidenceId, setDragOverEvidenceId] = useState<number | null>(null) // 当前拖拽悬停的引用证据ID（用于显示插入位置）
  const [dragOverInsertPosition, setDragOverInsertPosition] = useState<'before' | 'after' | null>(null) // 插入位置：之前或之后
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0) // 当前选中的模板索引
  const [hoveredTemplateIndex, setHoveredTemplateIndex] = useState<number | null>(null) // 当前悬停的模板索引
  const [templateTooltipPosition, setTemplateTooltipPosition] = useState<{ top: number; left: number } | null>(null) // 模板提示位置
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false) // Select下拉菜单是否打开
  const [draggingCardType, setDraggingCardType] = useState<string | null>(null) // 当前正在拖拽的卡片类型
  
  const { toast } = useToast()
  const { tasks, addTask, updateTask, removeTask } = useGlobalTasks()
  const { startCardCasting } = useCardCasting({ addTask, updateTask, removeTask })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 适中的拖动激活距离，允许在ScrollArea内滚动
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // 在拖拽时允许滚动：通过CSS样式确保滚动不被锁定
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'dnd-scroll-fix'
    style.textContent = `
      /* 允许ScrollArea在拖拽时滚动 */
      [data-radix-scroll-area-viewport] {
        touch-action: pan-y !important;
        pointer-events: auto !important;
        overscroll-behavior: contain;
        /* 允许在拖拽时滚动 */
        -webkit-overflow-scrolling: touch;
        /* 确保滚动条可以交互 */
        overflow-y: auto !important;
      }
      /* 确保拖拽时ScrollArea的子元素不会阻止滚动 */
      [data-radix-scroll-area-viewport] > * {
        pointer-events: auto !important;
        /* 允许子元素滚动 */
        touch-action: pan-y !important;
      }
      /* 允许拖拽元素在ScrollArea上时仍然可以滚动 */
      [data-dnd-kit-droppable-id] {
        touch-action: pan-y !important;
        /* 确保可放置区域不阻止滚动 */
        pointer-events: auto !important;
      }
      /* 拖拽句柄不应该阻止滚动 */
      [data-dnd-kit-drag-handle] {
        touch-action: none;
      }
      /* 确保拖拽覆盖层不阻止滚动 */
      [data-dnd-kit-drag-overlay] {
        pointer-events: none !important;
      }
      /* 确保槽位在拖拽时可以滚动 */
      [data-dnd-kit-droppable-id][id^="slot::"] {
        touch-action: pan-y !important;
        pointer-events: auto !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      const existingStyle = document.getElementById('dnd-scroll-fix')
      if (existingStyle) {
        document.head.removeChild(existingStyle)
      }
    }
  }, [])

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

  // 获取证据卡槽模板列表
  const slotTemplatesFetcher = async ([_key, caseId]: [string, string]) => {
    const response = await evidenceCardApi.getEvidenceCardSlotTemplates(Number(caseId))
    return response
  }

  const { data: slotTemplatesData } = useSWR(
    ['/api/evidence-card-slot-templates', String(caseId)],
    slotTemplatesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const slotTemplates = slotTemplatesData?.data || []
  const currentTemplate = slotTemplates[selectedTemplateIndex] || null

  const evidenceList = evidenceData?.data || []
  const cardList = cardData?.data || []

  // 初始化编辑表单
  useEffect(() => {
    if (finalCaseData && !isEditingCase) {
      setEditedCaseInfo(finalCaseData)
    }
  }, [finalCaseData, isEditingCase])

  // 当模板数据变化时，确保索引有效
  useEffect(() => {
    if (slotTemplates.length > 0 && selectedTemplateIndex >= slotTemplates.length) {
      setSelectedTemplateIndex(0)
    }
  }, [slotTemplates.length, selectedTemplateIndex])

  // 加载槽位快照（当模板切换或模板数据加载时）
  useEffect(() => {
    const loadSnapshot = async () => {
      if (!currentTemplate || !caseId) return
      
      try {
        const snapshot = await evidenceCardApi.getSlotAssignmentSnapshot(
          Number(caseId),
          currentTemplate.template_id
        )
        // 恢复快照到slotCards状态
        setSlotCards(snapshot.assignments || {})
      } catch (error) {
        // 静默失败，如果快照不存在或获取失败，使用空状态
        console.log('加载槽位快照失败（首次使用或快照不存在）:', error)
        setSlotCards({})
      }
    }
    
    loadSnapshot()
  }, [currentTemplate?.template_id, caseId])

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

  // 处理更新引用证据
  const handleUpdateReferencedEvidences = async (cardId: number, evidenceIds: number[]) => {
    try {
      // 构建引用证据更新列表（带序号）
      const referencedEvidences = evidenceIds.map((evidenceId, index) => ({
        evidence_id: evidenceId,
        sequence_number: index,
      }))

      await evidenceCardApi.updateCard(cardId, {
        referenced_evidences: referencedEvidences,
      })

      toast({
        title: "更新成功",
        description: "引用证据已更新",
      })

      // 刷新卡片列表
      await mutateCards()
    } catch (error: any) {
      toast({
        title: "更新失败",
        description: error.message || "更新引用证据失败",
        variant: "destructive",
      })
    }
  }

  // 处理卡片特征更新
  const handleUpdateCardFeatures = async (cardId: number, updatedFeatures: any[]) => {
    try {
      // 构建特征更新列表
      const cardFeatures = updatedFeatures.map((feature) => ({
        slot_name: feature.slot_name,
        slot_value: feature.slot_value,
      }))

      await evidenceCardApi.updateCard(cardId, {
        card_features: cardFeatures,
      })

      toast({
        title: "保存成功",
        description: "卡片信息已更新",
      })

      // 刷新卡片列表
      await mutateCards()
    } catch (error: any) {
      toast({
        title: "保存失败",
        description: error.message || "保存卡片信息失败",
        variant: "destructive",
      })
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
    // 清除之前的高亮状态
    setDragOverEvidenceId(null)
    setDragOverInsertPosition(null)
    
    // 如果是拖拽卡片，获取卡片类型
    const activeIdStr = String(active.id)
    if (activeIdStr.startsWith('card-')) {
      const cardId = parseInt(activeIdStr.replace('card-', ''))
      const card = cardList.find((c: EvidenceCard) => c.id === cardId)
      const cardType = card?.card_info?.card_type || null
      setDraggingCardType(cardType)
    } else {
      setDraggingCardType(null)
    }
  }

  // 处理拖拽悬停（用于实时显示视觉反馈）
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    
    console.log('[handleDragOver] 拖拽悬停:', { active: active.id, over: over?.id })
    
    if (!over) {
      // 没有悬停目标，清除所有高亮
      setDragOverEvidenceId(null)
      setDragOverInsertPosition(null)
      // 不清除 draggingCardType，因为它在拖拽开始时已设置，需要在整个拖拽过程中保持
      // 这样可以在滚动时正确匹配类型
      return
    }

    // 统一处理 activeId 和 overId，确保它们是字符串类型（用于判断）
    const activeId = active.id
    const overId = over.id
    const activeIdStr = String(activeId)
    const overIdStr = String(overId)
    
    console.log('[handleDragOver] 处理拖拽:', { activeIdStr, overIdStr })

    // 如果原始证据被拖拽到槽位，清除高亮并返回（不允许交互）
    if (activeIdStr.startsWith('evidence-') && overIdStr.startsWith('slot-')) {
      setDragOverEvidenceId(null)
      setDragOverInsertPosition(null)
      return
    }

    // 处理卡片拖拽到槽位的情况 - 只有在真正悬停在槽位上时才设置高亮
    if (activeIdStr.startsWith('card-') && overIdStr.startsWith('slot::')) {
      // 确保卡片类型已设置（用于槽位匹配检查）
      const cardId = parseInt(activeIdStr.replace('card-', ''))
      const card = cardList.find((c: EvidenceCard) => c.id === cardId)
      const cardType = card?.card_info?.card_type || null
      // 只有在真正悬停在槽位上时才更新拖拽卡片类型（用于显示高亮）
      if (cardType) {
        setDraggingCardType(cardType)
      }
      // 清除引用证据相关的高亮
      setDragOverEvidenceId(null)
      setDragOverInsertPosition(null)
      return
    }

    // 如果拖拽卡片但不在槽位上，清除槽位相关的高亮（但保持拖拽卡片类型）
    if (activeIdStr.startsWith('card-') && !overIdStr.startsWith('slot::')) {
      // 不清除 draggingCardType，因为我们需要在滚动时保持它
      // 但清除引用证据相关的高亮
      setDragOverEvidenceId(null)
      setDragOverInsertPosition(null)
      // 不更新 draggingCardType，让它保持当前值
    }

    // 检查是否是拖拽原始证据到引用证据列表
    if (activeIdStr.startsWith('evidence-')) {
      // 只有真正悬停在引用证据列表区域或某个引用证据项上时，才显示高亮
      if (overIdStr.startsWith('referenced-evidence-list-')) {
        // 悬停在引用证据列表容器上
        const cardId = parseInt(overIdStr.replace('referenced-evidence-list-', ''))
        const card = cardList.find((c: EvidenceCard) => c.id === cardId)
        // 确保卡片存在且是关联类型且已展开
        if (card && card.card_info?.card_is_associated === true && expandedCardId === cardId) {
          // 获取鼠标位置，尝试找到最近的项
          const pointer = event.activatorEvent as PointerEvent | undefined
          const listRect = over.rect
          
          if (pointer && listRect && card.evidence_ids.length > 0) {
            // 计算鼠标相对于列表容器的位置
            const mouseY = pointer.clientY
            const listTop = listRect.top
            
            // 尝试找到最接近的引用证据项
            let targetEvidenceId: number | null = null
            let insertPosition: 'before' | 'after' = 'after'
            
            // 遍历所有引用证据项，找到鼠标位置最接近的项
            for (let i = 0; i < card.evidence_ids.length; i++) {
              const evidenceId = card.evidence_ids[i]
              // 尝试通过 DOM 元素获取实际的项位置
              const evidenceElement = document.querySelector(`[data-evidence-id="${evidenceId}"]`)
              if (evidenceElement) {
                const rect = evidenceElement.getBoundingClientRect()
                // 如果鼠标在这个项的范围内（包括上下边缘的扩展区域）
                const expandedTop = rect.top - 10 // 扩展检测区域
                const expandedBottom = rect.bottom + 10
                if (mouseY >= expandedTop && mouseY <= expandedBottom) {
                  // 判断应该插入到这个项之前还是之后
                  const itemCenter = rect.top + rect.height / 2
                  insertPosition = mouseY < itemCenter ? 'before' : 'after'
                  targetEvidenceId = evidenceId
                  break
                }
              }
            }
            
            // 如果找不到匹配的项，只有在明确悬停在列表区域内的特定位置时才设置
            if (!targetEvidenceId && listRect) {
              // 检查鼠标是否在列表区域内（不是列表外）
              const listBottom = listRect.top + listRect.height
              if (mouseY >= listRect.top && mouseY <= listBottom && card.evidence_ids.length > 0) {
                // 如果鼠标在列表的上半部分，插入到第一个项之前
                const listCenter = listTop + listRect.height / 2
                if (mouseY < listCenter) {
                  targetEvidenceId = card.evidence_ids[0]
                  insertPosition = 'before'
                } else {
                  // 否则插入到最后一个项之后
                  targetEvidenceId = card.evidence_ids[card.evidence_ids.length - 1]
                  insertPosition = 'after'
                }
              }
            }
            
            // 只有在找到明确的插入位置时才设置高亮
            if (targetEvidenceId) {
              setDragOverEvidenceId(targetEvidenceId)
              setDragOverInsertPosition(insertPosition)
            } else {
              // 如果没有找到明确的插入位置，清除高亮（不设置默认值）
              setDragOverEvidenceId(null)
              setDragOverInsertPosition(null)
            }
          } else {
            // 如果无法获取鼠标位置，清除高亮（不设置默认值）
            setDragOverEvidenceId(null)
            setDragOverInsertPosition(null)
          }
        } else {
          setDragOverEvidenceId(null)
          setDragOverInsertPosition(null)
        }
      } else if (overIdStr.startsWith('referenced-evidence-')) {
        // 悬停在某个引用证据项上
        const evidenceId = parseInt(overIdStr.replace('referenced-evidence-', ''))
        // 找到这个证据所属的卡片
        const card = cardList.find((c: EvidenceCard) => c.evidence_ids.includes(evidenceId))
        // 确保卡片存在且是关联类型且已展开
        if (card && card.card_info?.card_is_associated === true && expandedCardId === card.id) {
          // 获取鼠标位置，判断插入位置（之前或之后）
          const rect = over.rect
          const pointer = event.activatorEvent as PointerEvent | undefined
          
          let insertPosition: 'before' | 'after' = 'after' // 默认插入到之后
          
          // 使用鼠标的实际位置来判断（最准确）
          if (pointer && rect) {
            // 计算鼠标在引用证据项上的相对位置
            const relativeY = pointer.clientY - rect.top
            const itemHeight = rect.height
            // 使用 50% 作为阈值，让插入位置更直观
            const threshold = itemHeight * 0.5
            insertPosition = relativeY < threshold ? 'before' : 'after'
          } else {
            // 后备方案: 使用 active 和 over 的 rect 中心位置比较
            const activeRect = active.rect.current.translated
            if (activeRect && rect) {
              const activeCenterY = activeRect.top + activeRect.height / 2
              const overCenterY = rect.top + rect.height / 2
              // 如果拖动项的中心在目标项的中心之上，插入到之前；否则插入到之后
              insertPosition = activeCenterY < overCenterY ? 'before' : 'after'
            }
          }
          
          setDragOverEvidenceId(evidenceId)
          setDragOverInsertPosition(insertPosition)
        } else {
          setDragOverEvidenceId(null)
          setDragOverInsertPosition(null)
        }
      } else {
        // 没有悬停在引用证据列表区域，清除高亮
        setDragOverEvidenceId(null)
        setDragOverInsertPosition(null)
      }
    } else {
      // 不是拖拽原始证据，清除高亮
      setDragOverEvidenceId(null)
      setDragOverInsertPosition(null)
    }
  }

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    // 保存当前的高亮状态（在清除之前）
    const currentDragOverEvidenceId = dragOverEvidenceId
    const currentDragOverInsertPosition = dragOverInsertPosition
    
    setDraggedCardId(null)
    setDraggingCardType(null) // 清除拖拽卡片类型
    // 清除高亮状态
    setDragOverEvidenceId(null)
    setDragOverInsertPosition(null)

    // 统一处理 activeId 和 overId，确保它们是字符串类型
    const activeId = active.id
    const activeIdStr = String(activeId)
    
    // 如果 over 为 null，尝试通过鼠标位置找到目标槽位（后备方案）
    let finalOver = over
    if (!finalOver && activeIdStr.startsWith('card-')) {
      // 尝试获取鼠标位置
      // 方法1：从 event.activatorEvent 获取（如果可用）
      const activatorEvent = event.activatorEvent as PointerEvent | undefined
      let mouseX = 0
      let mouseY = 0
      
      if (activatorEvent) {
        mouseX = activatorEvent.clientX
        mouseY = activatorEvent.clientY
      } else {
        // 方法2：从 active 的 rect 获取（作为后备）
        const activeRect = active.rect.current.translated
        if (activeRect) {
          mouseX = activeRect.left + activeRect.width / 2
          mouseY = activeRect.top + activeRect.height / 2
        }
      }
      
      if (mouseX > 0 && mouseY > 0) {
        // 查找鼠标位置下的所有槽位元素
        const elementsAtPoint = document.elementsFromPoint(mouseX, mouseY)
        const slotElement = elementsAtPoint.find(el => {
          const droppableId = el.getAttribute('data-dnd-kit-droppable-id')
          return droppableId && droppableId.startsWith('slot::')
        })
        
        if (slotElement) {
          const slotId = slotElement.getAttribute('data-dnd-kit-droppable-id')
          if (slotId) {
            // 创建一个模拟的 over 对象
            finalOver = {
              id: slotId,
              rect: {
                current: {
                  initial: slotElement.getBoundingClientRect(),
                  translated: slotElement.getBoundingClientRect(),
                }
              }
            } as any
          }
        }
      }
    }

    if (!finalOver) return

    const overId = finalOver.id
    const overIdStr = String(overId)

    // 检查是否是拖拽原始证据到引用证据列表
    if (activeIdStr.startsWith('evidence-')) {
      const evidenceId = parseInt(activeIdStr.replace('evidence-', ''))
      
      // 严格检查：只有在真正拖动到引用证据列表区域或某个引用证据项时才执行
      let targetCard: EvidenceCard | undefined = undefined
      let insertPosition: 'before' | 'after' | 'end' = 'end'
      let isValidDrop = false
      
      if (overIdStr.startsWith('referenced-evidence-list-')) {
        // 拖动到引用证据列表容器
        const cardId = parseInt(overIdStr.replace('referenced-evidence-list-', ''))
        targetCard = cardList.find((c: EvidenceCard) => c.id === cardId)
        // 只有当目标卡片存在、是关联类型、且已展开时，才认为是有效拖放
        if (targetCard && targetCard.card_info?.card_is_associated === true && expandedCardId === cardId) {
          isValidDrop = true
          // 如果之前有高亮的项，使用之前的位置；否则添加到末尾
          if (currentDragOverEvidenceId) {
            const targetIndex = targetCard.evidence_ids.indexOf(currentDragOverEvidenceId)
            if (targetIndex >= 0) {
              insertPosition = currentDragOverInsertPosition || 'after'
            } else {
              insertPosition = 'end'
            }
          } else {
            insertPosition = 'end'
          }
        }
      } else if (overIdStr.startsWith('referenced-evidence-')) {
        // 拖动到某个引用证据项
        const targetEvidenceId = parseInt(overIdStr.replace('referenced-evidence-', ''))
        targetCard = cardList.find((c: EvidenceCard) => c.evidence_ids.includes(targetEvidenceId))
        // 确保目标卡片存在、是关联类型、且已展开
        if (targetCard && targetCard.card_info?.card_is_associated === true && expandedCardId === targetCard.id) {
          isValidDrop = true
          // 使用之前保存的插入位置（之前或之后）
          insertPosition = currentDragOverInsertPosition || 'after'
        }
      }
      
      // 只有在有效拖放时才执行更新
      if (!isValidDrop || !targetCard) {
        // 没有拖动到有效的放置区域，不执行任何操作（取消拖拽）
        return
      }
      
      const card = targetCard
      
      // 确保证据不在列表中（避免重复添加）
      if (card.evidence_ids.includes(evidenceId)) {
        return
      }
      
      let newEvidenceIds = [...card.evidence_ids]
      
      if (insertPosition === 'end') {
        // 添加到末尾
        newEvidenceIds.push(evidenceId)
      } else if (overIdStr.startsWith('referenced-evidence-')) {
        // 拖拽到某个引用证据项的位置
        const targetEvidenceId = parseInt(overIdStr.replace('referenced-evidence-', ''))
        const targetIndex = card.evidence_ids.indexOf(targetEvidenceId)
        if (targetIndex >= 0) {
          // 根据插入位置（之前或之后）插入到相应位置
          if (insertPosition === 'before') {
            // 插入到目标项之前
            newEvidenceIds.splice(targetIndex, 0, evidenceId)
          } else {
            // 插入到目标项之后（insertPosition === 'after'）
            newEvidenceIds.splice(targetIndex + 1, 0, evidenceId)
          }
        } else {
          // 如果找不到目标项，添加到末尾
          newEvidenceIds.push(evidenceId)
        }
      } else {
        // 拖拽到列表容器但位置不确定，添加到末尾
        newEvidenceIds.push(evidenceId)
      }
      
      // 更新引用证据（会自动更新 sequence_number）
      handleUpdateReferencedEvidences(card.id, newEvidenceIds)
      return
    }

    // 检查是否是拖拽引用证据列表内的项进行排序（同一卡片内的引用证据重新排序）
    // 注意：引用证据项使用数字 ID（evidence.id），而不是字符串
    if (typeof activeId === 'number' && typeof overId === 'number') {
      // 检查是否都是引用证据项（通过检查它们是否在某个卡片的 evidence_ids 中）
      const sourceCard = cardList.find((c: EvidenceCard) => c.evidence_ids.includes(activeId))
      const targetCard = cardList.find((c: EvidenceCard) => c.evidence_ids.includes(overId))
      
      // 确保是同一个卡片内的排序，且该卡片是关联类型且已展开
      if (sourceCard && targetCard && sourceCard.id === targetCard.id && 
          sourceCard.card_info?.card_is_associated === true && 
          expandedCardId === sourceCard.id &&
          activeId !== overId) {
        const oldIndex = sourceCard.evidence_ids.indexOf(activeId)
        const newIndex = sourceCard.evidence_ids.indexOf(overId)
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newEvidenceIds = arrayMove(sourceCard.evidence_ids, oldIndex, newIndex)
          handleUpdateReferencedEvidences(sourceCard.id, newEvidenceIds)
        }
        return
      }
    }

    // 如果原始证据被拖拽到槽位，直接返回（不允许）
    if (activeIdStr.startsWith('evidence-') && overIdStr.startsWith('slot::')) {
      return
    }
    
    // 检查是否是拖拽卡片
    if (activeIdStr.startsWith('card-')) {
      const cardId = parseInt(activeIdStr.replace('card-', ''))
      
      // 检查是否是拖拽到槽位
      if (overIdStr.startsWith('slot::')) {
        const slotId = overIdStr
        
        console.log('[handleDragEnd] 尝试放置卡片到槽位:', { cardId, slotId, activeIdStr, overIdStr })
        
        // 检查卡片类型是否匹配槽位类型
        const card = cardList.find(c => c.id === cardId)
        if (!card) {
          console.error('[handleDragEnd] 找不到卡片:', cardId)
          toast({
            title: "错误",
            description: `找不到卡片 #${cardId}`,
            variant: "destructive"
          })
          return
        }
        
        const cardType = card?.card_info?.card_type || ''
        console.log('[handleDragEnd] 卡片类型:', cardType)
        
        // 从slotId中提取card_type信息
        // slotId格式: slot::{role}::{cardType}::{index}
        const slotIdParts = slotId.split('::')
        console.log('[handleDragEnd] slotIdParts:', slotIdParts)
        
        if (slotIdParts.length >= 3) {
          // 提取card_type（第3部分是cardType，第4部分是index）
          const slotCardType = slotIdParts[2]
          console.log('[handleDragEnd] 槽位类型:', slotCardType, '卡片类型:', cardType)
          
          // 检查卡片类型是否匹配槽位类型
          if (cardType === slotCardType) {
            console.log('[handleDragEnd] 类型匹配，执行放置')
            const newSlotCards = {
              ...slotCards,
              [slotId]: cardId,
            }
            setSlotCards(newSlotCards)

            // 静默更新槽位关联（不显示toast，避免干扰用户）
            if (currentTemplate) {
              try {
                await evidenceCardApi.updateSlotAssignment(
                  Number(caseId),
                  currentTemplate.template_id,
                  slotId,
                  cardId
                )
              } catch (error) {
                console.error('更新槽位关联失败:', error)
                // 静默失败，不显示错误提示
              }
            }

            toast({
              title: "卡片已放置",
              description: `卡片 #${cardId} 已放置到槽位`,
            })
          } else {
            console.log('[handleDragEnd] 类型不匹配')
            toast({
              title: "类型不匹配",
              description: `卡片类型 "${cardType}" 与槽位类型 "${slotCardType}" 不匹配`,
              variant: "destructive"
            })
          }
        } else {
          console.error('[handleDragEnd] slotId 格式错误:', slotId)
        }
      } else {
        // 卡片被拖拽到非槽位位置，检查是否从槽位中移除
        // 查找该卡片当前所在的槽位
        const currentSlotId = Object.keys(slotCards).find(
          slotId => slotCards[slotId] === cardId
        )
        
        if (currentSlotId && currentTemplate) {
          // 从槽位中移除卡片
          console.log('[handleDragEnd] 从槽位移除卡片:', { cardId, currentSlotId })
          const newSlotCards = { ...slotCards }
          delete newSlotCards[currentSlotId]
          setSlotCards(newSlotCards)

          // 静默更新槽位关联（移除关联）
          try {
            await evidenceCardApi.updateSlotAssignment(
              Number(caseId),
              currentTemplate.template_id,
              currentSlotId,
              null
            )
          } catch (error) {
            console.error('移除槽位关联失败:', error)
            // 静默失败，不显示错误提示
          }
        }
      }
    } else {
      console.log('[handleDragEnd] 不是卡片拖拽:', { activeIdStr, overIdStr })
    }
  }

  // 检查证据是否已铸造
  const isEvidenceCast = (evidenceId: number) => {
    return cardList.some(card => card.evidence_ids.includes(evidenceId))
  }

  // 处理从槽位移除卡片
  const handleRemoveCardFromSlot = async (slotId: string) => {
    if (!currentTemplate) return
    
    try {
      // 静默更新槽位关联（移除关联）
      await evidenceCardApi.updateSlotAssignment(
        Number(caseId),
        currentTemplate.template_id,
        slotId,
        null
      )
      
      // 更新本地状态
      const newSlotCards = { ...slotCards }
      delete newSlotCards[slotId]
      setSlotCards(newSlotCards)
    } catch (error) {
      console.error('移除槽位关联失败:', error)
      // 静默失败，不显示错误提示
    }
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

  // 自定义碰撞检测函数，对引用证据列表更敏感，避免锁定第一个槽位
  const customCollisionDetection: CollisionDetection = (args) => {
    // 首先使用 closestCorners 进行基础检测
    const cornersCollisions = closestCorners(args)
    
    // 如果拖拽的是原始证据，尝试找到最接近的引用证据项
    const activeId = String(args.active.id)
    if (activeId.startsWith('evidence-')) {
      // 获取所有引用证据项
      const allReferencedEvidenceIds = cardList
        .filter(card => card.card_info?.card_is_associated === true && expandedCardId === card.id)
        .flatMap(card => card.evidence_ids)
        .map(id => `referenced-evidence-${id}`)
      
      // 检查是否与引用证据项碰撞
      const referencedEvidenceCollision = cornersCollisions.find(collision => 
        allReferencedEvidenceIds.includes(String(collision.id))
      )
      
      if (referencedEvidenceCollision) {
        return [referencedEvidenceCollision]
      }
      
      // 检查是否与引用证据列表容器碰撞
      const listCollision = cornersCollisions.find(collision =>
        String(collision.id).startsWith('referenced-evidence-list-')
      )
      
      if (listCollision) {
        return [listCollision]
      }
    }
    
    // 对于卡片拖拽到槽位的情况，使用基于鼠标位置的精确检测
    const activeIdStr = String(activeId)
    if (activeIdStr.startsWith('card-')) {
      const { pointerCoordinates } = args
      
      // 如果没有指针坐标，直接返回 closestCorners 的结果（确保有反馈）
      if (!pointerCoordinates) {
        console.log('[collisionDetection] 没有指针坐标，返回 closestCorners:', cornersCollisions)
        return cornersCollisions
      }
      
      console.log('[collisionDetection] 检查碰撞，activeId:', activeIdStr, 'pointerCoordinates:', pointerCoordinates)
      
      // 过滤槽位碰撞：只返回鼠标真正悬停的槽位
      const filteredCollisions = cornersCollisions.filter(collision => {
        const collisionId = String(collision.id)
        
        // 只处理槽位
        if (!collisionId.startsWith('slot::')) {
          return true // 保留其他类型的碰撞
        }
        
        // 获取槽位元素的 DOM 位置
        let element = document.querySelector(`[data-dnd-kit-droppable-id="${collisionId}"]`)
        if (!element) {
          element = document.getElementById(collisionId)
        }
        
        if (!element) {
          console.log('[collisionDetection] 找不到元素:', collisionId)
          return false // 找不到元素，不返回
        }
        
        const rect = element.getBoundingClientRect()
        
        // 检查鼠标是否真正在元素内部（使用合理的容差，确保可以触发）
        const tolerance = 20 // 增加容差，确保可以触发
        const isPointerInside = 
          pointerCoordinates.x >= rect.left - tolerance &&
          pointerCoordinates.x <= rect.right + tolerance &&
          pointerCoordinates.y >= rect.top - tolerance &&
          pointerCoordinates.y <= rect.bottom + tolerance
        
        console.log('[collisionDetection] 检查槽位:', collisionId, 'isPointerInside:', isPointerInside, 'rect:', rect, 'pointer:', pointerCoordinates)
        return isPointerInside
      })
      
      console.log('[collisionDetection] 过滤后的碰撞结果:', filteredCollisions)
      
      // 如果过滤后没有结果，返回空数组（不锁定任何槽位）
      return filteredCollisions.length > 0 ? filteredCollisions : []
    }
    
    // 其他情况使用 closestCorners
    return cornersCollisions
  }

  // 在拖拽过程中监听滚轮事件，手动触发滚动
  useEffect(() => {
    if (!draggedCardId) return
    
    const handleWheel = (e: WheelEvent) => {
      // 查找鼠标位置下的 ScrollArea viewport
      const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY)
      const scrollArea = elementsAtPoint.find(el => 
        el.closest('[data-radix-scroll-area-viewport]')
      )?.closest('[data-radix-scroll-area-viewport]') as HTMLElement
      
      if (scrollArea) {
        // 检查鼠标是否在 ScrollArea 内
        const scrollRect = scrollArea.getBoundingClientRect()
        const isPointerInScrollArea = 
          e.clientX >= scrollRect.left &&
          e.clientX <= scrollRect.right &&
          e.clientY >= scrollRect.top &&
          e.clientY <= scrollRect.bottom
        
        if (isPointerInScrollArea) {
          // 阻止默认行为，手动滚动（高优先级）
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          
          // 计算滚动距离
          const scrollAmount = e.deltaY * 0.5
          const currentScroll = scrollArea.scrollTop
          const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight
          
          // 确保不会滚动超出边界
          const newScroll = Math.max(0, Math.min(maxScroll, currentScroll + scrollAmount))
          scrollArea.scrollTop = newScroll
          
          // 触发 scroll 事件
          scrollArea.dispatchEvent(new Event('scroll', { bubbles: true }))
        }
      }
    }

    // 添加滚轮事件监听（捕获阶段，确保在拖拽系统之前处理）
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true })
    }
  }, [draggedCardId])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4">
          {/* 左侧：原始证据列表 */}
          <Card className="col-span-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between w-full gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>原始证据</span>
                  <Badge variant="secondary" className="text-xs">
                    {evidenceList.length}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
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
                    className="h-7 px-3 text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    铸造 {selectedEvidenceIds.size > 0 && `(${selectedEvidenceIds.size})`}
                  </Button>
                </div>
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
                      isDraggable={!!expandedCardId && cardList.some((c: EvidenceCard) => c.card_info?.card_is_associated === true && expandedCardId === c.id)}
                      dragId={`evidence-${evidence.id}`}
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
                        onClick={() => {
                          // 如果正在拖拽，不触发选中
                          if (!draggedCardId) {
                            setSelectedCard(card)
                          }
                        }}
                        evidenceList={evidenceList}
                        isExpanded={expandedCardId === card.id}
                        isDragOver={false} // 不在整个卡片上显示高亮，只在引用证据列表区域显示
                        dragOverEvidenceId={dragOverEvidenceId}
                        dragOverInsertPosition={dragOverInsertPosition}
                        onToggleExpand={() => {
                          setExpandedCardId(expandedCardId === card.id ? null : card.id)
                          // 重置图片索引
                          if (expandedCardId !== card.id) {
                            setCurrentImageIndex({ ...currentImageIndex, [card.id]: 0 })
                          }
                        }}
                        currentImageIdx={currentImageIndex[card.id] ?? 0}
                        onImageIndexChange={(index) => {
                          setCurrentImageIndex({ ...currentImageIndex, [card.id]: index })
                        }}
                        onImageClick={(imageUrl, allUrls) => {
                          const currentIdx = currentImageIndex[card.id] ?? 0
                          setPreviewImage({ url: allUrls[currentIdx] || imageUrl, urls: allUrls, currentIndex: currentIdx })
                        }}
                        onUpdateCard={handleUpdateCardFeatures}
                        onUpdateReferencedEvidences={handleUpdateReferencedEvidences}
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
              <ScrollArea 
                className="h-[calc(100vh-280px)]" 
                style={{ 
                  touchAction: 'pan-y',
                  // 允许在拖拽时滚动
                  pointerEvents: 'auto',
                } as React.CSSProperties}
              >
                <div 
                  className="space-y-6" 
                  style={{ 
                    touchAction: 'pan-y',
                    // 确保内容可以滚动
                    pointerEvents: 'auto',
                  } as React.CSSProperties}
                >
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

                      {/* 债权人和债务人信息 - 左右分布，中间VS图标 */}
                      {(editedCaseInfo.case_parties?.find((p: any) => p.party_role === "creditor") || editedCaseInfo.case_parties?.find((p: any) => p.party_role === "debtor")) && (
                        <div className="relative grid grid-cols-[1fr_auto_1fr] gap-4 mb-4 items-start">
                          {/* 债权人信息 - 左对齐 */}
                          {editedCaseInfo.case_parties?.find((p: any) => p.party_role === "creditor") && (
                            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100 text-left">
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

                          {/* VS图标 - 居中 */}
                          <div className="flex items-center justify-center h-full pt-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300 shadow-sm">
                              <span className="text-xs font-bold text-slate-600">VS</span>
                            </div>
                          </div>

                          {/* 债务人信息 - 右对齐 */}
                          {editedCaseInfo.case_parties?.find((p: any) => p.party_role === "debtor") && (
                            <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-200 text-right">
                              <div className="flex items-center justify-end gap-2 mb-4">
                                <h4 className="font-bold text-slate-900 text-sm">债务人</h4>
                                <div className="w-1 h-5 bg-slate-400 rounded-full" />
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
                    </div>
                  )}

                  <Separator />

                  {/* 卡片槽位 */}
                  <div>
                    {/* 标题 */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900">证据卡槽</h3>
                      {/* 重置快照按钮 */}
                      {currentTemplate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await evidenceCardApi.resetSlotAssignmentSnapshot(
                                Number(caseId),
                                currentTemplate.template_id
                              )
                              // 清空本地状态
                              setSlotCards({})
                              toast({
                                title: "重置成功",
                                description: "槽位快照已重置到初始状态",
                              })
                            } catch (error) {
                              console.error('重置槽位快照失败:', error)
                              toast({
                                title: "重置失败",
                                description: "重置槽位快照时出错",
                                variant: "destructive",
                              })
                            }
                          }}
                          className="h-8 px-3 text-xs border-slate-300 hover:border-red-400 hover:bg-red-50 text-red-600"
                        >
                          重置快照
                        </Button>
                      )}
                    </div>
                    
                    {/* 模板选择器 */}
                    {slotTemplates.length > 1 && (
                      <div className="mb-4">
                        <Select
                          value={String(selectedTemplateIndex)}
                          onValueChange={(value) => setSelectedTemplateIndex(Number(value))}
                          onOpenChange={(open) => {
                            setIsSelectOpen(open)
                            // 当 Select 打开时，隐藏提示框
                            if (open) {
                              setHoveredTemplateIndex(null)
                              setTemplateTooltipPosition(null)
                            }
                          }}
                        >
                          <SelectTrigger 
                            className="w-[280px] h-8 text-xs"
                            onMouseEnter={(e) => {
                              // 如果 Select 已打开，不显示提示框
                              if (isSelectOpen) return
                              const rect = e.currentTarget.getBoundingClientRect()
                              setTemplateTooltipPosition({
                                top: rect.bottom + 8,
                                left: rect.left + (rect.width / 2) - 128
                              })
                              setHoveredTemplateIndex(selectedTemplateIndex)
                            }}
                            onMouseLeave={() => {
                              // 如果 Select 已打开，不处理鼠标离开
                              if (isSelectOpen) return
                              setHoveredTemplateIndex(null)
                              setTemplateTooltipPosition(null)
                            }}
                          >
                            <SelectValue>
                              {(() => {
                                const template = slotTemplates[selectedTemplateIndex]
                                if (!template) return '选择模板'
                                
                                // 生成label名称：案由-聊天记录核心卡槽或案由-欠条借条核心卡槽
                                const caseCause = template.case_cause || ''
                                let evidenceType = ''
                                if (template.key_evidence_name) {
                                  if (template.key_evidence_name.includes('聊天记录') || template.key_evidence_name.includes('微信')) {
                                    evidenceType = '聊天记录核心卡槽'
                                  } else if (template.key_evidence_name.includes('借条') || template.key_evidence_name.includes('欠条')) {
                                    evidenceType = '欠条借条核心卡槽'
                                  } else {
                                    evidenceType = template.key_evidence_name.replace('主证据', '核心卡槽')
                                  }
                                }
                                return caseCause && evidenceType ? `${caseCause}-${evidenceType}` : template.key_evidence_name || template.template_id
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {slotTemplates.map((template, index) => {
                              // 生成label名称
                              const caseCause = template.case_cause || ''
                              let evidenceType = ''
                              if (template.key_evidence_name) {
                                if (template.key_evidence_name.includes('聊天记录') || template.key_evidence_name.includes('微信')) {
                                  evidenceType = '聊天记录核心卡槽'
                                } else if (template.key_evidence_name.includes('借条') || template.key_evidence_name.includes('欠条')) {
                                  evidenceType = '欠条借条核心卡槽'
                                } else {
                                  evidenceType = template.key_evidence_name.replace('主证据', '核心卡槽')
                                }
                              }
                              const labelName = caseCause && evidenceType ? `${caseCause}-${evidenceType}` : template.key_evidence_name || template.template_id
                              
                              return (
                                <SelectItem 
                                  key={template.template_id} 
                                  value={String(index)}
                                  title={String(formatTemplateLabel(template))}
                                >
                                  {labelName}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {currentTemplate ? (
                      <div className="space-y-6">
                        {/* 按债权人和债务人分左右两列展示，中间VS图标 */}
                        <div className="relative grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                          {/* 左侧：债权人相关槽位 - 左对齐 */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-blue-500 rounded-full" />
                              <h4 className="text-sm font-semibold text-slate-700 text-left">
                                债权人 {currentTemplate.creditor_type ? `(${currentTemplate.creditor_type})` : ''}
                              </h4>
                            </div>
                            <div className="text-left">
                              {renderCardSlots(currentTemplate.required_card_types, 'creditor', slotCards, currentTemplate, cardList, draggingCardType, handleRemoveCardFromSlot)}
                            </div>
                          </div>

                          {/* VS图标 - 居中 */}
                          <div className="flex items-center justify-center h-full pt-8">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 border-2 border-slate-300 shadow-sm sticky top-4">
                              <span className="text-xs font-bold text-slate-600">VS</span>
                            </div>
                          </div>

                          {/* 右侧：债务人相关槽位 - 右对齐 */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-end gap-2 mb-3">
                              <h4 className="text-sm font-semibold text-slate-700 text-right">
                                债务人 {currentTemplate.debtor_type ? `(${currentTemplate.debtor_type})` : ''}
                              </h4>
                              <div className="w-1 h-5 bg-slate-400 rounded-full" />
                            </div>
                            <div className="text-right">
                              {renderCardSlots(currentTemplate.required_card_types, 'debtor', slotCards, currentTemplate, cardList, draggingCardType, handleRemoveCardFromSlot)}
                            </div>
                          </div>
                        </div>

                        {/* 共享槽位（不分债权人和债务人的） - 居中对齐 */}
                        <div className="space-y-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center justify-center mb-3">
                            <h4 className="text-sm font-semibold text-slate-700">共享证据</h4>
                          </div>
                          <div className="flex justify-center">
                            <div className="max-w-2xl w-full">
                              {renderCardSlots(currentTemplate.required_card_types, 'shared', slotCards, currentTemplate, cardList, draggingCardType, handleRemoveCardFromSlot)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                        {slotTemplates.length === 0 ? '暂无槽位模板配置' : '加载中...'}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 拖拽覆盖层 - 显示放大后的卡片副本 */}
      <DragOverlay>
        {draggedCardId ? (
          (() => {
            const draggedIdStr = String(draggedCardId)
            if (draggedIdStr.startsWith('card-')) {
              const cardId = parseInt(draggedIdStr.replace('card-', ''))
              const card = cardList.find(c => c.id === cardId)
              return card ? (
                <DraggedCardPreview card={card} evidenceList={evidenceList} />
              ) : null
            } else if (draggedIdStr.startsWith('evidence-')) {
              const evidenceId = parseInt(draggedIdStr.replace('evidence-', ''))
              const evidence = evidenceList.find((e: any) => e.id === evidenceId)
              if (!evidence) return null
              
              const fileTypeInfo = getFileTypeInfo(evidence.file_name || '')
              return (
                <div className="w-full max-w-[200px] p-2.5 rounded-lg border-2 border-blue-400 bg-white shadow-lg opacity-65 ring-2 ring-blue-200 pointer-events-none">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-300 bg-slate-100 shadow-md">
                        {fileTypeInfo.type === 'image' && evidence.file_url ? (
                          <img
                            src={evidence.file_url}
                            alt={evidence.file_name || ''}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className={`w-full h-full ${fileTypeInfo.bgColor} flex items-center justify-center`}>
                            <span className="text-3xl">{fileTypeInfo.icon}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-slate-500 font-medium">证据ID</span>
                        <span className="text-xs font-mono text-blue-600 font-semibold">#{evidence.id}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 truncate">{evidence.file_name || ''}</p>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()
        ) : null}
      </DragOverlay>

      {/* 模板切换悬停提示 - 使用Portal渲染到body */}
      {!isSelectOpen && hoveredTemplateIndex !== null && templateTooltipPosition && slotTemplates[hoveredTemplateIndex] && (() => {
        const template = slotTemplates[hoveredTemplateIndex]
        const fullDescription = formatTemplateLabel(template)
        
        return createPortal(
          <div 
            className="fixed z-40 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl whitespace-normal pointer-events-none"
            style={{
              top: `${templateTooltipPosition.top}px`,
              left: typeof window !== 'undefined' 
                ? `${Math.max(8, Math.min(templateTooltipPosition.left, window.innerWidth - 272))}px` 
                : `${templateTooltipPosition.left}px`,
            }}
          >
            <div className="font-semibold mb-2 text-white">
              {template.case_cause || '案由未设置'}
            </div>
            <div className="text-slate-300 leading-relaxed whitespace-pre-line">
              {fullDescription}
            </div>
            {/* 箭头 */}
            <div className="absolute -top-1.5 right-4 w-3 h-3 bg-slate-900 rotate-45" />
          </div>,
          document.body
        )
      })()}

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