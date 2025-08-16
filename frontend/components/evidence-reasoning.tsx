"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, Search, Download, Upload, Eye, Edit, Save, X, Brain, Video, ZoomIn, GripVertical, CheckCircle, XCircle } from "lucide-react"
import { caseApi, evidenceApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useAutoProcessWebSocket } from "@/hooks/use-websocket"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 添加拖拽相关的CSS样式
const dragStyles = `
  .drag-overlay {
    opacity: 0.8;
    transform: rotate(5deg);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }
  
  .sortable-item {
    transition: transform 0.2s ease;
  }
  
  .sortable-item:hover {
    transform: translateY(-2px);
  }
  
  .grip-handle {
    cursor: grab;
    transition: all 0.2s ease;
  }
  
  .grip-handle:hover {
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
  
  .grip-handle:active {
    cursor: grabbing;
  }
`

// 案件数据获取函数
const caseFetcher = async ([key, caseId]: [string, string]) => {
  const result = await caseApi.getCaseById(parseInt(caseId))
  return result.data
}

// 证据数据获取函数
const evidenceFetcher = async ([key, evidenceIds]: [string, number[]]) => {
  if (evidenceIds.length === 0) return { data: [] }
  
  // 使用evidenceApi的getEvidencesByIds方法
  const { evidenceApi } = await import('../lib/api')
  return await evidenceApi.getEvidencesByIds(evidenceIds)
}

// 判断特征组是否完整（基于特征组的所有特征项）


// 获取特征项的颜色样式
// 检查证据是否真正可以审核（features_complete && 所有需要校对的slot都校对成功）
const isEvidenceReadyForReview = (evidence: any) => {
  // 首先检查特征是否完整
  if (!evidence.features_complete) {
    return false;
  }
  
  // 检查所有需要校对的特征是否都校对成功
  if (evidence.evidence_features && Array.isArray(evidence.evidence_features)) {
    for (const feature of evidence.evidence_features) {
      // 如果有校对信息，必须校对成功
      if (feature.slot_proofread_at && !feature.slot_is_consistent) {
        return false;
      }
    }
  }
  
  return true;
};

const getFeatureColor = (slot: any) => {
  const slotRequired = slot.slot_required ?? true; // 默认为true
  const slotValue = slot.slot_value;
  // 确保 slotValue 是字符串类型，并且不是"未知"或空字符串
  const hasValue = slotValue && 
    typeof slotValue === 'string' && 
    slotValue !== "未知" && 
    slotValue.trim() !== "";
  
  // 判断特征是否有效：有值且如果该特征字段需要校对且校对成功时，为有效
  let isValid = false;
  
  if (hasValue) {
    if (slot.slot_proofread_at) {
      // 如果有校对信息，必须校对成功才算有效
      isValid = slot.slot_is_consistent;
    } else {
      // 如果没有校对信息，有值就算有效
      isValid = true;
    }
  }
  
  if (slotRequired) {
    // required = true
    if (isValid) {
      return {
        container: "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/30",
        text: "text-green-700 dark:text-green-400",
        input: "border-green-300 focus:border-green-500"
      };
    } else {
      return {
        container: "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/30",
        text: "text-red-700 dark:text-red-400",
        input: "border-red-300 focus:border-red-500"
      };
    }
  } else {
    // required = false
    return {
      container: "bg-gray-50 border-gray-200 dark:bg-gray-900/10 dark:border-gray-800/30",
      text: "text-gray-700 dark:text-gray-400",
      input: "border-gray-300 focus:border-gray-500"
    };
  }
};

// 判断单个特征项是否完整




// 获取状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case "checked":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "features_extracted":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// 获取状态中文名称
const getStatusText = (status: string) => {
  switch (status) {
    case "checked":
      return "已审核";
    case "features_extracted":
      return "特征已提取";
    default:
      return "未知状态";
  }
};

// 可拖拽的证据列表组件
function DraggableEvidenceList({
  evidences,
  selectedEvidenceIds,
  selectedEvidence,
  setSelectedEvidence,
  handleSelectAll,
  handleSelectOne,
  onEvidenceReorder,
}: {
  evidences: any[]
  selectedEvidenceIds: number[]
  selectedEvidence: any
  setSelectedEvidence: (evidence: any) => void
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSelectOne: (id: number, checked: boolean) => void
  onEvidenceReorder: (newOrder: any[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event: DragEndEvent) => {
        const { active, over } = event
        
        if (active.id !== over?.id) {
          const oldIndex = evidences.findIndex((e: any) => e.id === active.id)
          const newIndex = evidences.findIndex((e: any) => e.id === over?.id)
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(evidences, oldIndex, newIndex)
            onEvidenceReorder(newOrder)
          }
        }
      }}
    >
      <SortableContext
        items={evidences.map((e: any) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {evidences.map((evidence: any, index: number) => {
            const checked = selectedEvidenceIds.includes(evidence.id)
            return (
              <SortableEvidenceItem
                key={evidence.id}
                evidence={evidence}
                index={index}
                checked={checked}
                onSelect={handleSelectAll}
                onSelectOne={handleSelectOne}
                selectedEvidence={selectedEvidence}
                setSelectedEvidence={setSelectedEvidence}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// 可拖拽的证据项组件
function SortableEvidenceItem({ 
  evidence, 
  index, 
  checked, 
  onSelect, 
  onSelectOne, 
  selectedEvidence, 
  setSelectedEvidence 
}: {
  evidence: any
  index: number
  checked: boolean
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSelectOne: (id: number, checked: boolean) => void
  selectedEvidence: any
  setSelectedEvidence: (evidence: any) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: evidence.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-2.5 rounded-lg cursor-pointer transition-all duration-200 border flex items-start ${
        isDragging ? "opacity-50 bg-muted/50" : ""
      } ${
        selectedEvidence?.id === evidence.id
          ? "bg-primary/10 border-primary/30 shadow-sm"
          : checked
          ? "bg-primary/5 border-primary/20"
          : "hover:bg-muted/50 border-transparent hover:border-border"
      }`}
      onClick={() => setSelectedEvidence(evidence)}
    >
      {/* 拖拽手柄 - 只在可拖拽模式下显示 */}
      <div
        {...attributes}
        {...listeners}
        className="mr-2 p-1 cursor-grab active:cursor-grabbing hover:bg-muted/30 rounded"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onSelectOne(evidence.id, e.target.checked)
        }}
        className="mr-2 h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
      />
      <div className="flex-shrink-0">
        {(evidence.format?.toLowerCase() ?? "") === "mp3" ? (
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-md flex items-center justify-center">
            <Video className="h-5 w-5 text-purple-600" />
          </div>
        ) : evidence.file_url ? (
          <img
            src={evidence.file_url}
            alt={evidence.file_name || ''}
            className="w-10 h-10 object-cover rounded-md"
            onError={(e) => {
              // 图片加载失败时，替换为占位符
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                    <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </div>
                `;
              }
            }}
          />
        ) : (
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 ml-2 overflow-hidden">
        <div className="group relative">
          <h4 className="font-medium text-sm text-foreground break-words leading-tight" title={evidence.file_name}>
            {evidence.file_name}
          </h4>
        </div>
        <div className="flex items-start space-x-1.5 mt-1 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {evidence.file_extension?.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {(evidence.file_size / 1024).toFixed(1)} KB
          </Badge>
        </div>
      </div>
    </div>
  )
}

// 使用Suspense的证据推理列表组件
function EvidenceReasoningContent({ 
  caseId, 
  selectedEvidenceIds,
  setSelectedEvidenceIds,
  selectedSlot,
  setSelectedSlot,
  selectedGroup,
  setSelectedGroup,
  handleAutoProcess,
  handleSave,
  toast,
  editing,
  setEditing,
  editForm,
  setEditForm,
  setIsPreviewOpen,
  setSelectedEvidence,
  selectedEvidence,
  onEvidenceReorder,
  showOptionalFields,
  setShowOptionalFields,
}: {
  caseId: string | number
  selectedEvidenceIds: number[]
  setSelectedEvidenceIds: (ids: number[]) => void
  selectedSlot: any
  setSelectedSlot: (slot: any) => void
  selectedGroup: string
  setSelectedGroup: (group: string) => void
  handleAutoProcess: () => void
  handleSave: (editForm: any, setEditing: (v: boolean) => void) => void
  toast: any
  editing: boolean
  setEditing: (editing: boolean) => void
  editForm: any
  setEditForm: (form: any) => void
  setIsPreviewOpen: (open: boolean) => void
  setSelectedEvidence: (evidence: any) => void
  selectedEvidence: any
  onEvidenceReorder: (newOrder: any[]) => void
  showOptionalFields: boolean
  setShowOptionalFields: (show: boolean) => void
}) {
  // 获取案件数据
  const { data: caseData, error: caseError } = useSWR(
    ['case', caseId.toString()],
    caseFetcher
  )

  // 获取所有"微信聊天记录"类型的证据
  const { data: evidenceData, error: evidenceError } = useSWR(
    caseData ? ['evidences', caseId] : null,
    async ([key, caseId]) => {
      // 获取该案件的所有证据，筛选"微信聊天记录"类型
      const result = await evidenceApi.getEvidences({ case_id: Number(caseId), page: 1, pageSize: 1000 })
      const wechatEvidences = result.data.filter((evidence: any) => 
        evidence.classification_category === "微信聊天记录"
      )
      return { data: wechatEvidences }
    }
  )

  // 建立evidence ID到实际证据的映射
  const evidences = evidenceData?.data || []
  const evidenceMap = new Map(evidences.map((evidence: any) => [evidence.id, evidence]))

  // 按slot_group_name分组证据
  const groupedEvidences = caseData?.association_evidence_features?.reduce((acc: Record<string, any[]>, feature: any) => {
    const groupName = feature.slot_group_name || '未分组'
    if (!acc[groupName]) acc[groupName] = []
    
    // 添加该特征组关联的证据
    feature.association_evidence_ids?.forEach((evidenceId: number) => {
      const evidence = evidenceMap.get(evidenceId)
      if (evidence && !acc[groupName].find((e: any) => e.id === (evidence as any).id)) {
        acc[groupName].push(evidence as any)
      }
    })
    
    return acc
  }, {}) || {}

  // 计算所有微信聊天记录证据（用于"全部"分组）
  const allWechatEvidences = evidences?.filter((evidence: any) => 
    evidence.classification_category === "微信聊天记录"
  ) || []

  // 获取当前选中的特征分组信息
  const selectedFeatureGroup = caseData?.association_evidence_features?.find((feature: any) => 
    feature.slot_group_name === selectedGroup
  )
  


  // 获取所有唯一的slot信息，按分组筛选
  const allSlots = caseData?.association_evidence_features?.reduce((acc: any[], feature: any) => {
    // 如果选择了特定分组，只处理该分组的特征
    if (selectedGroup && selectedGroup !== '全部证据' && feature.slot_group_name !== selectedGroup) {
      return acc
    }
    
    // 如果选择"全部证据"，不显示任何特征
    if (selectedGroup === '全部证据') {
      return acc
    }
    
    feature.evidence_features?.forEach((slot: any) => {
      // 检查是否已存在相同的slot_name
      const existingSlot = acc.find(s => s.slot_name === slot.slot_name)
      if (!existingSlot) {
        acc.push({
          ...slot,
          groupName: feature.slot_group_name
        })
      }
    })
    return acc
  }, []) || []

  // 处理全选逻辑
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const currentGroupEvidences = selectedGroup === '全部证据' 
        ? allWechatEvidences
        : groupedEvidences[selectedGroup] || []
      const allIds = currentGroupEvidences.map((evidence: any) => evidence.id)
      setSelectedEvidenceIds(allIds)
    } else {
      setSelectedEvidenceIds([])
    }
  }

  // 处理单个选择逻辑
  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      const newIds = [...selectedEvidenceIds, id]
      setSelectedEvidenceIds(newIds)
    } else {
      const newIds = selectedEvidenceIds.filter(selectedId => selectedId !== id)
      setSelectedEvidenceIds(newIds)
    }
  }

  // 处理slot点击
  const handleSlotClick = (slot: any) => {
    setSelectedSlot(slot)
    
    // 根据slot_value_from_url高亮对应的证据
    const evidenceIds = slot.slot_value_from_url?.map((id: string) => parseInt(id)) || []
    setSelectedEvidenceIds(evidenceIds)
  }

  if (caseError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-2">加载案件数据失败</div>
          <Button onClick={() => window.location.reload()}>重试</Button>
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-4 items-start h-[calc(100vh-400px)]">
      {/* 左栏：证据列表 */}
      <Card className="col-span-3 card-shadow h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            关联特征分组
            <Badge variant="secondary" className="text-xs">
              {Object.keys(groupedEvidences).length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full flex flex-col">
          {/* 分组筛选 */}
          <div className="px-3 pb-3">
            <ScrollArea className="h-28">
                              <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedGroup('全部证据')
                      setSelectedEvidence(null)
                      setSelectedEvidenceIds([]) // 清空选中的证据ID
                      // 分组选择不再自动设置选中状态，让用户手动选择
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${selectedGroup === '全部证据' ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">全部证据</span>
                      <Badge variant="outline" className="text-xs">{allWechatEvidences.length}</Badge>
                    </div>
                  </button>
                {Object.entries(groupedEvidences).map(([groupName, evidences]) => (
                  <button
                    key={groupName}
                    onClick={() => {
                      setSelectedGroup(groupName)
                      setSelectedEvidence(null)
                      setSelectedEvidenceIds([]) // 清空选中的证据ID
                      // 分组选择不再自动设置选中状态，让用户手动选择
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${selectedGroup === groupName ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{groupName || '未分组'}</span>
                      <Badge variant="outline" className="text-xs">{evidences.length}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <Separator />
          {/* 证据列表 */}
          <ScrollArea className="flex-1 custom-scrollbar">
            <div className="p-3 space-y-2">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={selectedEvidenceIds.length === (selectedGroup === '全部证据' ? allWechatEvidences.length : (groupedEvidences[selectedGroup] || []).length)}
                  onChange={handleSelectAll}
                  className="mr-2 h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
                />
                <span className="ml-2 text-xs text-muted-foreground">全选</span>
                {selectedGroup !== '全部证据' && (
                  <span className="ml-2 text-xs text-muted-foreground">长按拖动可重新排序</span>
                )}
              </div>
              
              {/* 拖拽排序区域 */}
              {selectedGroup !== '全部证据' ? (
                <DraggableEvidenceList
                  evidences={groupedEvidences[selectedGroup] || []}
                  selectedEvidenceIds={selectedEvidenceIds}
                  selectedEvidence={selectedEvidence}
                  setSelectedEvidence={setSelectedEvidence}
                  handleSelectAll={handleSelectAll}
                  handleSelectOne={handleSelectOne}
                  onEvidenceReorder={onEvidenceReorder}
                />
              ) : (
                <div className="space-y-2">
                  {allWechatEvidences.map((evidence: any, index: number) => {
                    const checked = selectedEvidenceIds.includes(evidence.id)
                    return (
                      <div
                        key={`${evidence.id}-${index}`}
                        onClick={() => setSelectedEvidence(evidence)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all duration-200 border flex items-start ${
                          selectedEvidence?.id === evidence.id
                            ? "bg-primary/10 border-primary/30 shadow-sm"
                            : selectedEvidenceIds.includes(evidence.id)
                            ? "bg-primary/5 border-primary/20"
                            : "hover:bg-muted/50 border-transparent hover:border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectOne(evidence.id, e.target.checked)
                          }}
                          className="mr-2 h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
                        />
                        <div className="flex-shrink-0">
                          {(evidence.format?.toLowerCase() ?? "") === "mp3" ? (
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-md flex items-center justify-center">
                              <Video className="h-5 w-5 text-purple-600" />
                            </div>
                          ) : evidence.file_url ? (
                            <img
                              src={evidence.file_url}
                              alt={evidence.file_name || ''}
                              className="w-10 h-10 object-cover rounded-md"
                              onError={(e) => {
                                // 图片加载失败时，替换为占位符
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                                      <svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                      </svg>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                              <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 ml-2 overflow-hidden">
                          <div className="group relative">
                            <h4 className="font-medium text-sm text-foreground break-words leading-tight" title={evidence.file_name}>
                              {evidence.file_name}
                            </h4>
                          </div>
                          <div className="flex items-start space-x-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {evidence.file_extension?.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {(evidence.file_size / 1024).toFixed(1)} KB
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中栏：图片预览 */}
      <Card className="col-span-6 card-shadow h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">关联图片预览</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          {selectedEvidence ? (
            <div className="h-full">
              <div className="p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-2">证据预览</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvidence.file_name || `证据${selectedEvidence.id}`}
                  </p>
                </div>
                
                {/* 单个图片预览 */}
                <div className="relative overflow-hidden rounded-lg border bg-muted/30">
                  <img
                    src={selectedEvidence.file_url}
                    alt={`证据图片 ${selectedEvidence.file_name || selectedEvidence.id}`}
                    className="w-full h-auto max-h-[calc(100vh-500px)] object-contain transition-all duration-300 cursor-pointer hover:scale-105"
                    onClick={() => setIsPreviewOpen(true)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-64 bg-muted/30 flex items-center justify-center">
                            <div class="text-center">
                              <svg class="h-16 w-16 text-muted-foreground mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                              <p class="text-muted-foreground">暂无预览</p>
                            </div>
                          </div>
                        `;
                      }
                    }}
                  />
                  {/* 放大按钮 */}
                  <div className="absolute top-3 right-3 flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="bg-background/80 backdrop-blur-sm h-8"
                      onClick={() => setIsPreviewOpen(true)}
                    >
                      <ZoomIn className="h-3.5 w-3.5 mr-1.5" />
                      放大
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">
                  请从左侧选择证据进行预览
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 右栏：特征标注 */}
      <Card className="col-span-3 card-shadow h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            特征提取结果
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-full">
          <ScrollArea className="h-full custom-scrollbar">
            <div className="p-3 space-y-2">
              {/* 特征分组元属性显示 */}
              {selectedFeatureGroup && selectedGroup !== '全部证据' && selectedFeatureGroup.evidence_features && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
                  <h4 className="font-medium text-sm mb-2">{selectedFeatureGroup.slot_group_name}</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>审核状态:</span>
                      <span className="text-foreground">{getStatusText(selectedFeatureGroup.evidence_feature_status)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>提取时间:</span>
                      <span className="text-foreground">
                        {selectedFeatureGroup.features_extracted_at ? 
                          new Date(selectedFeatureGroup.features_extracted_at).toLocaleString('zh-CN') : 
                          '未知'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>特征完整性:</span>
                      <span className={`${(selectedFeatureGroup as any).features_complete ? 'text-green-600' : 'text-red-600'}`}>
                        {(selectedFeatureGroup as any).features_complete ? '完整' : '不完整'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {((editing ? editForm.evidence_features : allSlots) || []).length > 0 ? (
                <>
                  {/* 必需特征 */}
                  {((editing ? editForm.evidence_features : allSlots) || [])
                    .filter((slot: any) => slot.slot_required !== false)
                    .map((slot: any, index: number) => {
                      const isSelected = selectedSlot?.slot_name === slot.slot_name
                      const colors = getFeatureColor(slot)
                      
                      return (
                        <div key={index} className={`p-2 rounded-md border space-y-1 ${colors.container}`}>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs font-medium">词槽名:</Label>
                            <span className="text-xs">{slot.slot_name}</span>
                            {/* 校对状态图标 */}
                            {slot.slot_proofread_at && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="ml-2 relative group cursor-pointer">
                                    {/* 毛玻璃矩形标签 */}
                                    <div 
                                      className={`
                                        w-8 h-4 rounded-sm flex items-center justify-center
                                        backdrop-blur-sm border border-white/30
                                        transition-all duration-300 ease-out
                                        animate-proofread-breathe group-hover:animate-none
                                        group-hover:scale-110 group-hover:shadow-xl group-hover:-translate-y-1
                                        ${slot.slot_is_consistent 
                                          ? 'bg-green-500/80 text-white shadow-md shadow-green-500/30 group-hover:bg-green-400/90 group-hover:shadow-green-500/40' 
                                          : 'bg-red-500/80 text-white shadow-md shadow-red-500/30 group-hover:bg-red-400/90 group-hover:shadow-red-500/40'
                                        }
                                      `}
                                      style={{
                                        animation: 'proofreadBreathe 4s ease-in-out infinite',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.animation = 'none';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.animation = 'proofreadBreathe 4s ease-in-out infinite';
                                      }}
                                    >
                                      {slot.slot_is_consistent ? (
                                        <CheckCircle className="w-3 h-3 drop-shadow-sm" />
                                      ) : (
                                        <XCircle className="w-3 h-3 drop-shadow-sm" />
                                      )}
                                    </div>
                                    
                                    {/* 底部阴影 */}
                                    <div 
                                      className={`
                                        absolute top-5 left-1/2 -translate-x-1/2 
                                        w-5 h-1 rounded-full blur-sm opacity-30
                                        transition-all duration-300
                                        ${slot.slot_is_consistent ? 'bg-green-500' : 'bg-red-500'}
                                        group-hover:opacity-60 group-hover:w-6
                                      `}
                                    ></div>
                                    
                                    {/* 光晕效果 */}
                                    <div className={`
                                      absolute inset-0 rounded-sm opacity-0 
                                      transition-all duration-300 blur-sm
                                      group-hover:opacity-40 group-hover:scale-125
                                      ${slot.slot_is_consistent ? 'bg-green-400' : 'bg-red-400'}
                                    `}></div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent 
                                  side="top" 
                                  className={`max-w-xs p-3 shadow-lg border-2 ${
                                    slot.slot_is_consistent 
                                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50' 
                                      : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50'
                                  }`}
                                >
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm">
                                      校对结果: {slot.slot_is_consistent ? '✅ 一致' : '❌ 不一致'}
                                    </div>
                                    {slot.slot_expected_value && (
                                      <div className="text-xs">
                                        <span className="font-medium">期待值:</span> {slot.slot_expected_value}
                                      </div>
                                    )}
                                    {slot.slot_proofread_reasoning && (
                                      <div className="text-xs">
                                        <span className="font-medium">原因:</span> {slot.slot_proofread_reasoning}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      校对时间: {new Date(slot.slot_proofread_at).toLocaleString('zh-CN')}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            )}
                          </div>
                      <div>
                        <Label className="text-xs">词槽值:</Label>
                        {editing ? (
                          <Input
                            value={slot.slot_value || ""}
                            onChange={(e) => {
                              const newFeatures = [...(editForm.evidence_features || [])];
                              newFeatures[index].slot_value = e.target.value;
                              setEditForm({ ...editForm, evidence_features: newFeatures });
                            }}
                            className={colors.input}
                          />
                        ) : (
                          <span className={`text-xs font-medium ${colors.text}`}>
                            {slot.slot_value || "未知"}
                          </span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">置信度:</Label>
                        {editing ? (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={slot.confidence || 0}
                            onChange={(e) => {
                              const newFeatures = [...(editForm.evidence_features || [])];
                              newFeatures[index].confidence = parseFloat(e.target.value);
                              // 当用户编辑置信度时，自动将reasoning改为"人工编辑"
                              newFeatures[index].reasoning = "人工编辑";
                              setEditForm({ ...editForm, evidence_features: newFeatures });
                            }}
                            className="text-xs h-6"
                          />
                        ) : (
                          <span className="text-xs">{((slot.confidence || 0) * 100).toFixed(2)}%</span>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">理由:</Label>
                        {editing ? (
                          <Textarea
                            value={slot.reasoning || ""}
                            onChange={(e) => {
                              const newFeatures = [...(editForm.evidence_features || [])];
                              newFeatures[index].reasoning = e.target.value;
                              setEditForm({ ...editForm, evidence_features: newFeatures });
                            }}
                            rows={2}
                            className="text-xs"
                          />
                        ) : (
                          <span className="text-xs">{slot.reasoning || "无"}</span>
                        )}
                      </div>
                    </div>
                  )
                })}

                  {/* 非必需特征展开按钮 */}
                  {((editing ? editForm.evidence_features : allSlots) || []).filter((slot: any) => slot.slot_required === false).length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                      className="w-full text-xs h-8 mt-2"
                    >
                      {showOptionalFields ? '收起' : '展开'} 非必需特征 
                      ({((editing ? editForm.evidence_features : allSlots) || []).filter((slot: any) => slot.slot_required === false).length} 个)
                      <svg 
                        className={`ml-1 h-3 w-3 transition-transform duration-200 ${showOptionalFields ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Button>
                  )}

                  {/* 非必需特征 */}
                  {showOptionalFields && ((editing ? editForm.evidence_features : allSlots) || [])
                    .filter((slot: any) => slot.slot_required === false)
                    .map((slot: any, index: number) => {
                      const isSelected = selectedSlot?.slot_name === slot.slot_name
                      const colors = getFeatureColor(slot)
                      
                      return (
                        <div key={`optional-${index}`} className={`p-2 rounded-md border space-y-1 ${colors.container} opacity-80`}>
                          <div className="flex items-center gap-1">
                            <Label className="text-xs font-medium text-muted-foreground">词槽名:</Label>
                            <span className="text-xs text-muted-foreground">{slot.slot_name}</span>
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                              可选
                            </Badge>
                          </div>
                          <div>
                            <Label className="text-xs">词槽值:</Label>
                            {editing ? (
                              <Input
                                value={slot.slot_value || ""}
                                onChange={(e) => {
                                  const newFeatures = [...(editForm.evidence_features || [])];
                                  const originalIndex = (editing ? editForm.evidence_features : allSlots || []).findIndex((f: any) => f === slot);
                                  newFeatures[originalIndex].slot_value = e.target.value;
                                  setEditForm({ ...editForm, evidence_features: newFeatures });
                                }}
                                className={colors.input}
                              />
                            ) : (
                              <span className={`text-xs font-medium ${colors.text}`}>
                                {slot.slot_value || "未知"}
                              </span>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">置信度:</Label>
                            {editing ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={slot.confidence || 0}
                                onChange={(e) => {
                                  const newFeatures = [...(editForm.evidence_features || [])];
                                  const originalIndex = (editing ? editForm.evidence_features : allSlots || []).findIndex((f: any) => f === slot);
                                  newFeatures[originalIndex].confidence = parseFloat(e.target.value);
                                  newFeatures[originalIndex].reasoning = "人工编辑";
                                  setEditForm({ ...editForm, evidence_features: newFeatures });
                                }}
                                className="text-xs h-6"
                              />
                            ) : (
                              <span className="text-xs">{((slot.confidence || 0) * 100).toFixed(2)}%</span>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">理由:</Label>
                            {editing ? (
                              <Textarea
                                value={slot.reasoning || ""}
                                onChange={(e) => {
                                  const newFeatures = [...(editForm.evidence_features || [])];
                                  const originalIndex = (editing ? editForm.evidence_features : allSlots || []).findIndex((f: any) => f === slot);
                                  newFeatures[originalIndex].reasoning = e.target.value;
                                  setEditForm({ ...editForm, evidence_features: newFeatures });
                                }}
                                rows={2}
                                className="text-xs"
                              />
                            ) : (
                              <span className="text-xs">{slot.reasoning || "无"}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                  <div className="text-center">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-base">
                      {selectedGroup === '全部证据' 
                        ? '请选择具体分组查看特征提取结果' 
                        : '暂无特征提取结果'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {/* 编辑/保存按钮 */}
              {selectedFeatureGroup && selectedGroup !== '全部证据' && selectedFeatureGroup.evidence_features && (
                <div className="flex gap-2 mt-2">
                  {editing ? (
                    <>
                      <Button onClick={() => {
                        console.log('保存按钮被点击')
                        console.log('editForm:', editForm)
                        console.log('selectedFeatureGroup:', selectedFeatureGroup)
                        handleSave(editForm, setEditing)
                      }}>保存</Button>
                      <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => {
                      console.log('编辑按钮被点击')
                      console.log('selectedFeatureGroup:', selectedFeatureGroup)
                      setEditing(true);
                      setEditForm({
                        id: selectedFeatureGroup.id,
                        slot_group_name: selectedFeatureGroup.slot_group_name,
                        evidence_feature_status: selectedFeatureGroup.evidence_feature_status,
                        evidence_features: selectedFeatureGroup.evidence_features || []
                      });
                    }}>编辑标注</Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>

  )
}

export function EvidenceReasoning({ 
  caseId, 
  onBack, 
  initialSelectedGroup 
}: { 
  caseId: string | number; 
  onBack?: () => void;
  initialSelectedGroup?: string;
}) {
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<number[]>([])
  const [selectedSlot, setSelectedSlot] = useState<any>(null)
  const [selectedGroup, setSelectedGroup] = useState<string>(initialSelectedGroup || '全部证据')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewEvidenceIds, setReviewEvidenceIds] = useState<number[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
  const [showOptionalFields, setShowOptionalFields] = useState(false)
  // WebSocket进度管理
  const { progress: wsProgress, error: wsError, isProcessing, startAutoProcess, disconnect } = useAutoProcessWebSocket()

  const [isCompleted, setIsCompleted] = useState(false)
  const { toast } = useToast()







  // 获取案件数据
  const { data: caseData } = useSWR(
    ['case', caseId.toString()],
    caseFetcher
  )

  // 获取证据列表用于审核
  const { data: evidenceData } = useSWR(
    ['evidences', caseId.toString()],
    async () => {
      try {
        return await evidenceApi.getEvidences({
          case_id: typeof caseId === 'string' ? parseInt(caseId) : caseId,
          page: 1,
          pageSize: 1000
        })
      } catch (error) {
        console.error('Failed to fetch evidences:', error)
        return { data: [] }
      }
    }
  )
  const evidenceList = evidenceData?.data || []
  
  // 筛选出微信聊天记录类型的证据（用于图片预览导航）
  const filteredEvidenceList = evidenceList.filter((evidence: any) => 
    evidence.classification_category === "微信聊天记录"
  )

  // 键盘导航处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPreviewOpen || filteredEvidenceList.length <= 1) return;
      
      const currentIndex = filteredEvidenceList.findIndex((e: any) => e.id === selectedEvidence?.id);
      
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredEvidenceList.length - 1;
          setSelectedEvidence(filteredEvidenceList[prevIndex]);
          break;
        case 'ArrowRight':
          event.preventDefault();
          const nextIndex = currentIndex < filteredEvidenceList.length - 1 ? currentIndex + 1 : 0;
          setSelectedEvidence(filteredEvidenceList[nextIndex]);
          break;
        case 'Escape':
          event.preventDefault();
          setIsPreviewOpen(false);
          break;
      }
    };

    if (isPreviewOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPreviewOpen, selectedEvidence, filteredEvidenceList]);

  // 保持选中状态 - 当数据刷新时，保持当前选中的分组和特征
  useEffect(() => {
    if (caseData && selectedGroup && selectedGroup !== '全部证据') {
      // 确保选中的分组仍然存在
      const currentGroup = caseData.association_evidence_features?.find(
        (f: any) => f.slot_group_name === selectedGroup
      )
      if (!currentGroup) {
        // 如果当前分组不存在了，重置为全部证据
        setSelectedGroup('全部证据')
        setSelectedSlot(null)
        setSelectedEvidenceIds([]) // 清空选中的证据ID
      }
    }
  }, [caseData, selectedGroup])



  // WebSocket进度监听
  useEffect(() => {
    if (wsProgress?.status === 'completed') {
      toast({ title: "智能推理完成", description: wsProgress.message })
      setSelectedEvidenceIds([])
      setIsCompleted(true)
      mutate(['case', caseId.toString()])
      setTimeout(() => setIsCompleted(false), 3000)
    } else if (wsProgress?.status === 'error') {
      toast({ title: "智能推理失败", description: wsProgress.message || "处理过程中发生错误", variant: "destructive" })
      setSelectedEvidenceIds([])
      setIsCompleted(false)
    } else if (wsError) {
      toast({ title: "智能推理失败", description: wsError, variant: "destructive" })
      setSelectedEvidenceIds([])
      setIsCompleted(false)
    }
  }, [wsProgress, wsError, toast, caseId, mutate])

  // 智能分析处理 - 使用WebSocket
  const handleAutoProcess = async () => {
    try {
      if (selectedEvidenceIds.length === 0) {
        toast({ 
          title: "提示", 
          description: "请先选择证据", 
          variant: "destructive" 
        })
        return
      }

      // 获取选中证据的详细信息，确保都是微信聊天记录类型
      const evidenceResponse = await evidenceApi.getEvidencesByIds(selectedEvidenceIds)
      const selectedEvidences = evidenceResponse.data.filter((evidence: any) => 
        evidence.classification_category === "微信聊天记录"
      )

      if (selectedEvidences.length === 0) {
        toast({
          title: "提示",
          description: "选中的证据中没有微信聊天记录类型",
          variant: "destructive",
        })
        return
      }

      // 使用WebSocket进行智能推理
      startAutoProcess({
        case_id: Number(caseId),
        evidence_ids: selectedEvidences.map((e: any) => e.id),
        auto_classification: false,
        auto_feature_extraction: true
      }, undefined, '/cases/ws/auto-process')
      
    } catch (e: any) {
      toast({ title: "智能推理失败", description: e?.message || '未知错误', variant: "destructive" })
    }
  }

  // 保存标注
  const handleSave = async (editForm: any, setEditing: (v: boolean) => void) => {
    try {
      console.log('开始保存，editForm:', editForm)
      
      if (!editForm || !editForm.evidence_features) {
        console.log('保存失败：editForm或evidence_features为空')
        toast({
          title: "保存失败",
          description: "没有可编辑的特征组",
          variant: "destructive",
        })
        return
      }

      // 调用API保存标注信息
      console.log('保存特征组:', editForm)
      
      // 构建更新请求数据，确保包含所有必需字段
      const updateData = {
        slot_group_name: editForm.slot_group_name,
        evidence_features: editForm.evidence_features.map((slot: any) => ({
          slot_name: slot.slot_name,
          slot_desc: slot.slot_desc || slot.slot_name,
          slot_value_type: slot.slot_value_type || "string",
          slot_required: slot.slot_required !== undefined ? slot.slot_required : true,
          slot_value: slot.slot_value,
          slot_value_from_url: slot.slot_value_from_url || [],
          confidence: slot.confidence,
          reasoning: slot.reasoning
        }))
      }
      
      console.log('更新数据:', updateData)
      
      // 调用API更新特征组
      if (editForm.id) {
        console.log('调用API更新特征组，ID:', editForm.id)
        const result = await caseApi.updateAssociationEvidenceFeature(editForm.id, updateData)
        console.log('API调用结果:', result)
        
        toast({
          title: "保存成功",
          description: "特征组信息已保存",
        })
        
        setEditing(false)
        setEditForm({})
        
        // 重新获取案件数据以更新显示，保持选中状态
        await mutate(['case', caseId.toString()])
      } else {
        console.log('保存失败：editForm.id为空')
        toast({
          title: "保存失败",
          description: "无法找到特征组ID",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('保存失败:', error)
      console.error('错误详情:', (error as any)?.message || error)
      toast({
        title: "保存失败",
        description: (error as any)?.message || "请稍后重试",
        variant: "destructive",
      })
    }
  }

  // 批量删除功能
  const handleBatchDelete = async () => {
    try {
      if (selectedEvidenceIds.length === 0) {
        toast({ 
          title: "提示", 
          description: "请先选择证据", 
          variant: "destructive" 
        });
        return;
      }
      
      await evidenceApi.batchDeleteEvidences(selectedEvidenceIds);
      toast({ 
        title: "删除成功", 
        description: `成功删除 ${selectedEvidenceIds.length} 个证据` 
      });
      setSelectedEvidenceIds([]);
      
      // 重新获取所有相关数据以更新显示
      await Promise.all([
        mutate(['case', caseId.toString()]),
        mutate(['evidences', caseId.toString()]),
        // 更新EvidenceReasoningContent中的微信聊天记录数据
        mutate(['evidences', caseId])
      ]);
      
      // 如果当前选中的证据被删除了，清空选中状态
      if (selectedEvidence && selectedEvidenceIds.includes(selectedEvidence.id)) {
        setSelectedEvidence(null);
      }
      
      // 清空选中的分组，因为可能相关的特征组也被删除了
      if (selectedGroup !== '全部证据') {
        setSelectedGroup('全部证据');
        setSelectedSlot(null);
      }
    } catch (error: any) {
      toast({ 
        title: "删除失败", 
        description: error?.message || '未知错误', 
        variant: "destructive" 
      });
    }
  };

  // 处理证据重新排序
  const handleEvidenceReorder = async (newOrder: any[]) => {
    try {
      // 获取当前选中的特征组
      const selectedFeatureGroup = caseData?.association_evidence_features?.find((feature: any) => 
        feature.slot_group_name === selectedGroup
      )
      
      if (!selectedFeatureGroup) {
        toast({ title: "错误", description: "未找到对应的特征组", variant: "destructive" })
        return
      }
      
      // 提取新的证据ID顺序
      const newEvidenceIds = newOrder.map((evidence: any) => evidence.id)
      
      // 调用API更新association_evidence_ids
      await caseApi.updateAssociationEvidenceFeature(selectedFeatureGroup.id, {
        association_evidence_ids: newEvidenceIds
      })
      
      toast({ title: "排序更新成功", description: "证据顺序已更新" })
      
      // 重新获取案件数据以更新显示
      await mutate(['case', caseId.toString()])
    } catch (error: any) {
      toast({ title: "排序更新失败", description: error?.message || "请稍后重试", variant: "destructive" })
    }
  }

  // 批量审核功能
  const handleBatchReview = async () => {
    if (reviewEvidenceIds.length === 0) return
    setReviewing(true)
    try {
      // 批量更新 AssociationEvidenceFeature 记录的 evidence_feature_status
      const updatePromises = reviewEvidenceIds.map(async (featureId) => {
        return await caseApi.updateAssociationEvidenceFeature(featureId, {
          evidence_feature_status: "checked"
        })
      })
      
      await Promise.all(updatePromises)
      toast({ title: "批量审核成功", description: `成功审核 ${reviewEvidenceIds.length} 个特征组` })
      setIsReviewDialogOpen(false)
      setReviewEvidenceIds([])
      
      // 重新获取案件数据以更新显示，保持选中状态
      await mutate(['case', caseId.toString()])
    } catch (e: any) {
      toast({ title: "批量审核失败", description: e?.message || '未知错误', variant: "destructive" })
    } finally {
      setReviewing(false)
    }
  }

  return (
    <>
      {/* 校对图标呼吸动画样式 */}
      <style jsx>{`
        @keyframes proofreadBreathe {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2px);
          }
        }
      `}</style>
      
      <div className="space-y-6">
      {/* 注入拖拽样式 */}
      <style dangerouslySetInnerHTML={{ __html: dragStyles }} />
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">联合证据分析</h1>
          <p className="text-muted-foreground mt-2">关联证据特征分析与推理</p>
        </div>
        <div className="flex gap-3 items-center ml-auto">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg" 
            onClick={() => setIsReviewDialogOpen(true)}
          >
            审核证据
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>返回案件</Button>
          )}
        </div>
      </div>

      {/* 关联特征概览 */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200/30 dark:border-purple-800/30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">关联特征概览</h3>
            <p className="text-xs text-muted-foreground mt-1">
              显示当前案件联合证据分析结果汇总
            </p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">关联特征组</div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {caseData?.association_evidence_features?.length || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">已审核</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {caseData?.association_evidence_features?.filter((f: any) => f.evidence_feature_status === "checked").length || 0}
              </div>
            </div>
          </div>
        </div>
        
        {/* 案件基本信息 */}
        {caseData && (
          <div className="mb-3 p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-border/50">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
              案件基本信息
            </h4>
            <div className="space-y-3">
              {/* 第一行：债权人，债务人，欠款金额 */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">债权人:</span>
                  <span className="font-medium max-w-[80px] truncate" title={caseData.creditor_name}>
                    {caseData.creditor_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">债务人:</span>
                  <span className="font-medium max-w-[80px] truncate" title={caseData.debtor_name || ''}>
                    {caseData.debtor_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">欠款金额:</span>
                  <span className="font-medium">
                    {caseData.loan_amount !== null && caseData.loan_amount !== undefined 
                      ? `¥${caseData.loan_amount.toLocaleString()}` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
              
              {/* 第二行：ID，创建时间，更新时间 */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">案件ID:</span>
                  <span className="font-medium">{caseData.id || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">创建时间:</span>
                  <span className="font-medium">
                    {caseData.created_at ? new Date(caseData.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">更新时间:</span>
                  <span className="font-medium">
                    {caseData.updated_at ? new Date(caseData.updated_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 关联特征状态统计 */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            关联特征状态统计
          </h4>
                      <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-border/50">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {evidenceList?.filter((evidence: any) => evidence.classification_category === "微信聊天记录").length || 0}
                </div>
                <div className="text-xs text-muted-foreground font-medium">证据总数</div>
                <div className="text-xs text-muted-foreground mt-0.5">已上传的微信聊天记录总数</div>
              </div>
              <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-border/50">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {caseData?.association_evidence_features?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground font-medium">特征组总数</div>
                <div className="text-xs text-muted-foreground mt-0.5">已识别的关联特征组总数</div>
              </div>
              <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-border/50">
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {caseData?.association_evidence_features?.filter((f: any) => {
                    // 检查特征完整性
                    if (!f.features_complete) return false;
                    
                    // 检查是否已审核
                    if (f.evidence_feature_status === "checked") return false;
                    
                    // 检查所有需要校对的特征是否都校对成功
                    if (f.evidence_features && Array.isArray(f.evidence_features)) {
                      for (const slot of f.evidence_features) {
                        if (slot.slot_proofread_at && !slot.slot_is_consistent) {
                          return false;
                        }
                      }
                    }
                    
                    return true;
                  }).length || 0}
                </div>
                <div className="text-xs text-muted-foreground font-medium">待审核</div>
                <div className="text-xs text-muted-foreground mt-0.5">特征完整且校对通过，等待人工审核确认</div>
              </div>
              <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-border/50">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {caseData?.association_evidence_features?.filter((f: any) => {
                    // 必须已审核
                    if (f.evidence_feature_status !== "checked") return false;
                    
                    // 检查特征完整性
                    if (!f.features_complete) return false;
                    
                    // 检查所有需要校对的特征是否都校对成功
                    if (f.evidence_features && Array.isArray(f.evidence_features)) {
                      for (const slot of f.evidence_features) {
                        if (slot.slot_proofread_at && !slot.slot_is_consistent) {
                          return false;
                        }
                      }
                    }
                    
                    return true;
                  }).length || 0}
                </div>
                <div className="text-xs text-muted-foreground font-medium">已审核</div>
                <div className="text-xs text-muted-foreground mt-0.5">人工验证确认无误</div>
              </div>
            </div>
        </div>
      </div>

            {/* 智能推理和批量删除按钮 */}
      {(selectedEvidenceIds.length > 0 || isProcessing || isCompleted) && (
        <div className="mb-2 flex items-center gap-3">
          {/* 批量删除按钮 */}
          <Button
            variant="destructive"
            onClick={handleBatchDelete}
            disabled={isProcessing}
          >
            批量删除
          </Button>

          {/* 标准宽度的智能推理按钮 */}
          <Button 
            onClick={handleAutoProcess} 
            disabled={isProcessing && !isCompleted} 
            className={`relative overflow-hidden transition-all duration-300 ${
              isCompleted
                ? 'bg-green-500 text-white shadow-md' 
                : isProcessing 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
            }`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isCompleted ? (
                <>
                  <span>100%</span>
                  <span>✓</span>
                  <span className="animate-sparkle">🎆</span>
                </>
              ) : isProcessing ? (
                "推理中..."
              ) : (
                "智能推理"
              )}
            </span>
            
            {/* 水波动画进度条 */}
            {(isProcessing || isCompleted) && (wsProgress || isCompleted) && (
              <div className="absolute inset-0 overflow-hidden">
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/40 to-white/20 animate-shimmer"
                  style={{ 
                    width: `${isCompleted ? 100 : (wsProgress?.progress || 0)}%`,
                    transition: 'width 0.8s ease-out'
                  }}
                />
                {/* 水波效果 */}
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" 
                       style={{ animationDelay: '0s' }} />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" 
                       style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            )}
          </Button>
          
          {/* 状态文本 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {selectedEvidenceIds.length > 0 ? (
              <>
                <span>已选 {selectedEvidenceIds.length} 项</span>
                <span>•</span>
              </>
            ) : null}
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              {isCompleted ? '推理完成' : isProcessing ? '智能推理' : '智能推理'}
            </span>
          </div>
          
          {/* 进度状态显示 */}
          {(wsProgress || isCompleted) && !isCompleted && (
            <div className="flex items-center gap-2">
              <div className="bg-muted/30 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground status-text">
                      {wsProgress?.status === 'classifying' ? '证据分类中' :
                       wsProgress?.status === 'classified' ? '证据分类完成' :
                       wsProgress?.status === 'extracting' ? '证据特征分析中' :
                       wsProgress?.status === 'ocr_processing' ? 'OCR处理中' :
                       wsProgress?.status === 'ocr_success' ? 'OCR处理成功' :
                       wsProgress?.status === 'ocr_error' ? 'OCR处理失败' :
                       wsProgress?.status === 'llm_processing' ? 'LLM处理中' :
                       wsProgress?.status === 'features_extracted' ? '证据特征分析完成' :
                       wsProgress?.status === 'completed' ? '处理完成' : '处理中'}
                      <span className="animate-bounce-dots">...</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 进度百分比 */}
              <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                {Math.round(wsProgress?.progress || 0)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* 主要内容 */}
      <EvidenceReasoningContent
        caseId={caseId}
        selectedEvidenceIds={selectedEvidenceIds}
        setSelectedEvidenceIds={setSelectedEvidenceIds}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        handleAutoProcess={handleAutoProcess}
        handleSave={handleSave}
        toast={toast}
        editing={editing}
        setEditing={setEditing}
        editForm={editForm}
        setEditForm={setEditForm}
        setIsPreviewOpen={setIsPreviewOpen}
        setSelectedEvidence={setSelectedEvidence}
        selectedEvidence={selectedEvidence}
        onEvidenceReorder={handleEvidenceReorder}
        showOptionalFields={showOptionalFields}
        setShowOptionalFields={setShowOptionalFields}
      />

      {/* 批量审核弹窗 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>批量审核关联证据特征</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              选择需要审核的关联证据特征（仅显示特征完整、校对通过且未验证的特征组）
            </div>
            
            {/* 待审核特征组列表 */}
            <div className="max-h-[400px] overflow-y-auto border rounded-lg p-4">
              <div className="space-y-2">
                {caseData?.association_evidence_features
                  ?.filter((feature: any) => {
                    // 检查特征完整性
                    if (!feature.features_complete) return false;
                    
                    // 检查是否已审核
                    if (feature.evidence_feature_status === "checked") return false;
                    
                    // 检查所有需要校对的特征是否都校对成功
                    if (feature.evidence_features && Array.isArray(feature.evidence_features)) {
                      for (const slot of feature.evidence_features) {
                        if (slot.slot_proofread_at && !slot.slot_is_consistent) {
                          return false;
                        }
                      }
                    }
                    
                    return true;
                  })
                  .map((feature: any) => {
                    const isSelected = reviewEvidenceIds.includes(feature.id);
                    return (
                      <div
                        key={feature.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30" 
                            : "hover:bg-muted/50 border-border"
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setReviewEvidenceIds(reviewEvidenceIds.filter(id => id !== feature.id));
                          } else {
                            setReviewEvidenceIds([...reviewEvidenceIds, feature.id]);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
                          />
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-md flex items-center justify-center">
                              <Brain className="h-6 w-6 text-purple-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground truncate">
                              {feature.slot_group_name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              特征数量: {feature.evidence_features?.length || 0} • 提取时间: {
                                feature.features_extracted_at ? 
                                  new Date(feature.features_extracted_at).toLocaleString('zh-CN') : 
                                  '未知'
                              }
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(feature.evidence_feature_status)} variant="outline">
                                {getStatusText(feature.evidence_feature_status)}
                              </Badge>
                              <Badge 
                                className={feature.features_complete 
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                                  : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                } 
                                variant="outline"
                              >
                                {feature.features_complete ? '特征完整' : '特征不完整'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                
                {/* 空状态显示 */}
                {caseData?.association_evidence_features
                  ?.filter((feature: any) => {
                    // 检查特征完整性
                    if (!feature.features_complete) return false;
                    
                    // 检查是否已审核
                    if (feature.evidence_feature_status === "checked") return false;
                    
                    // 检查所有需要校对的特征是否都校对成功
                    if (feature.evidence_features && Array.isArray(feature.evidence_features)) {
                      for (const slot of feature.evidence_features) {
                        if (slot.slot_proofread_at && !slot.slot_is_consistent) {
                          return false;
                        }
                      }
                    }
                    
                    return true;
                  }).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>暂无待审核的特征组</p>
                    <p className="text-sm">所有特征组都已验证完成或特征不完整/校对未通过</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* 底部操作 */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                已选择 {reviewEvidenceIds.length} 个特征组
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={handleBatchReview}
                  disabled={reviewEvidenceIds.length === 0 || reviewing}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white"
                >
                  {reviewing ? "审核中..." : `确认审核 ${reviewEvidenceIds.length} 个特征组`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 图片预览弹窗 */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-none w-auto h-auto p-0 bg-transparent border-0 shadow-none">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <div className="relative">
            <img
              src={selectedEvidence?.file_url}
              alt={selectedEvidence?.file_name || ''}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
            />
            
            {/* 关闭按钮 */}
            <Button 
              onClick={() => setIsPreviewOpen(false)} 
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-0"
              size="sm"
            >
              关闭
            </Button>
            
            {/* 上一张按钮 */}
            {filteredEvidenceList.length > 1 && (
              <Button 
                onClick={() => {
                  const currentIndex = filteredEvidenceList.findIndex((e: any) => e.id === selectedEvidence?.id);
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredEvidenceList.length - 1;
                  setSelectedEvidence(filteredEvidenceList[prevIndex]);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0"
                size="sm"
              >
                ←
              </Button>
            )}
            
            {/* 下一张按钮 */}
            {filteredEvidenceList.length > 1 && (
              <Button 
                onClick={() => {
                  const currentIndex = filteredEvidenceList.findIndex((e: any) => e.id === selectedEvidence?.id);
                  const nextIndex = currentIndex < filteredEvidenceList.length - 1 ? currentIndex + 1 : 0;
                  setSelectedEvidence(filteredEvidenceList[nextIndex]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0"
                size="sm"
              >
                →
              </Button>
            )}
            
            {/* 图片计数器 */}
            {filteredEvidenceList.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {filteredEvidenceList.findIndex((e: any) => e.id === selectedEvidence?.id) + 1} / {filteredEvidenceList.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </>
  )
} 