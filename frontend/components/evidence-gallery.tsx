"use client"

import { useState, Suspense, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Filter,
  Eye,
  Download,
  Video,
  ZoomIn,
  Edit,
  Brain,
  Upload,
} from "lucide-react"
import { evidenceApi } from "@/lib/api"
import { caseApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// SWR数据获取函数
const evidenceFetcher = async ([key, caseId, search, page, pageSize]: [string, string, string, number, number]) => {
  const response = await evidenceApi.getEvidences({
    page,
    pageSize,
    search,
    case_id: Number(caseId),
  })
  return response
}

const casesFetcher = async ([key]: [string]) => {
  const res = await caseApi.getCases({ page: 1, pageSize: 100 })
  return res.data.map((c: any) => ({ id: c.id, title: c.title })) || []
}

// 动态分组逻辑
const groupEvidence = (evidenceList: any[]) => {
  const groupMap: Record<string, any[]> = {};
  evidenceList.forEach(e => {
    const type = e.evidence_type || '其他';
    if (!groupMap[type]) groupMap[type] = [];
    groupMap[type].push(e);
  });
  return groupMap;
};

// 使用Suspense的证据列表组件
function EvidenceGalleryContent({ 
  caseId, 
  searchTerm, 
  page, 
  pageSize, 
  selectedEvidence, 
  setSelectedEvidence,
  selectedIds,
  setSelectedIds,
  handleBatchClassify,
  classifying,
  handleBatchFeatureExtraction,
  extracting,
  handleSave,
}: {
  caseId: string | number
  searchTerm: string
  page: number
  pageSize: number
  selectedEvidence: any
  setSelectedEvidence: (evidence: any) => void
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  handleBatchClassify: () => void
  classifying: boolean
  handleBatchFeatureExtraction: () => void
  extracting: boolean
  handleSave: (editForm: any, setEditing: (v: boolean) => void) => void
}) {
  const { data: evidenceData } = useSWR(
    ['/api/evidences', String(caseId), searchTerm, page, pageSize],
    evidenceFetcher,
    {
      suspense: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const evidenceList = evidenceData?.data || []
  const groupMap = groupEvidence(evidenceList)
  const groupKeys = Object.keys(groupMap)
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const getStatusColor = (status: string) => {
    switch (status) {
      case "已标注":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
      case "待标注":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400"
      case "标注中":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
      case "已拒绝":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const groupedEvidence = activeCategory === '全部'
    ? evidenceList
    : (groupMap[activeCategory] || []);

  const allIds = groupedEvidence.map((e: any) => e.id)
  const isAllSelected = allIds.length > 0 && allIds.every((id: number) => selectedIds.includes(id))

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter((i) => i !== id))
  }

  // 右侧数据标注区域
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>(selectedEvidence)

  useEffect(() => {
    setEditForm(selectedEvidence)
  }, [selectedEvidence])

  // // 编辑保存逻辑
  // const handleSave = async () => {
  //   try {
  //     // 只提交 schema 允许的字段
  //     const payload: any = {
  //       classification_category: editForm.classification_category,
  //       classification_confidence: editForm.classification_confidence,
  //       classification_reasoning: editForm.classification_reasoning,
  //     };
  //     if (Array.isArray(editForm.evidence_features)) {
  //       payload.evidence_features = editForm.evidence_features.map((slot: any) => ({
  //         slot_value: slot.slot_value
  //       }))
  //     }
  //     await evidenceApi.updateEvidence(editForm.id, payload)
  //     setEditing(false)
  //     // 刷新数据
  //     await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
  //     toast({ title: "保存成功" })
  //   } catch (e: any) {
  //     toast({ title: "保存失败", description: e?.message || '未知错误', variant: "destructive" })
  //   }
  // }

  if (!editForm) return null;

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)]">
      {/* 左栏：文件列表 */}
      <Card className="col-span-3 card-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            全部分类
            <Badge variant="secondary" className="text-xs">
              {evidenceList.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 分类筛选 */}
          <div className="px-3 pb-3">
            <ScrollArea className="h-28">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveCategory('全部')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeCategory === '全部' ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">全部证据</span>
                    <Badge variant="outline" className="text-xs">{evidenceList.length}</Badge>
                  </div>
                </button>
                {groupKeys.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeCategory === cat ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{cat}</span>
                      <Badge variant="outline" className="text-xs">{groupMap[cat].length}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <Separator />
          {/* 文件列表 */}
          <ScrollArea className="h-[calc(100%-160px)] custom-scrollbar">
            <div className="p-3 space-y-2">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="mr-2 h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
                />
                <span className="ml-2 text-xs text-muted-foreground">全选</span>
              </div>
              {groupedEvidence.map((evidence: any) => {
                const checked = selectedIds.includes(evidence.id)
                return (
                  <div
                    key={evidence.id}
                    onClick={() => setSelectedEvidence(evidence)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all duration-200 border flex items-start ${
                      selectedEvidence?.id === evidence.id
                        ? "bg-primary/10 border-primary/30 shadow-sm"
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
                      ) : (
                        evidence.file_url ? (
                          <img
                            src={evidence.file_url || undefined}
                            alt={evidence.file_name || ''}
                            className="w-10 h-10 object-cover rounded-md"
                          />
                        ) : null
                      )}
                    </div>
                    <div className="flex-1 min-w-0 ml-2 overflow-hidden">
                      <div className="group relative">
                        <h4 className="font-medium text-sm text-foreground break-words leading-tight" title={evidence.file_name || ''}>
                          {evidence.file_name || ''}
                        </h4>
                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-popover text-popover-foreground p-2 rounded-md shadow-lg border max-w-[200px] text-xs whitespace-normal">
                          {evidence.file_name || ''}
                        </div>
                      </div>
                      <div className="flex items-start space-x-1.5 mt-1 flex-wrap">
                        <Badge className={getStatusColor(evidence.status)} variant="outline">
                          {evidence.status}
                        </Badge>
                        {evidence.isKey && (
                          <Badge variant="destructive" className="text-xs">
                            关键
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 break-words leading-tight" title={(evidence.format ?? "") + " • " + (evidence.size ?? "")}>
                        {(evidence.format ?? "") + " • " + (evidence.size ?? "")}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中栏：文件预览 */}
      <Card className="col-span-6 card-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">文件预览</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedEvidence ? (
            <div className="h-full">
              {(selectedEvidence?.format?.toLowerCase() ?? "") === "mp3" ? (
                <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/10 dark:to-purple-800/10">
                  <Video className="h-20 w-20 text-purple-600 mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-3">{selectedEvidence.file_name || ''}</h3>
                  <audio controls className="w-full max-w-md">
                    <source src={selectedEvidence.file_url} type="audio/mpeg" />
                    您的浏览器不支持音频播放
                  </audio>
                  <div className="mt-3 text-sm text-muted-foreground">
                    时长: {selectedEvidence.metadata?.duration || "未知"}
                  </div>
                </div>
              ) : (
                <div className="relative h-full">
                  {selectedEvidence?.file_url ? (
                    <img
                      src={selectedEvidence.file_url || undefined}
                      alt={selectedEvidence?.file_name || ''}
                      className="w-full h-full object-contain bg-muted/30"
                    />
                  ) : null}
                  <div className="absolute top-3 right-3 flex space-x-2">
                    <Button size="sm" variant="secondary" className="bg-background/80 backdrop-blur-sm h-8">
                      <ZoomIn className="h-3.5 w-3.5 mr-1.5" />
                      放大
                    </Button>
                    <Button size="sm" variant="secondary" className="bg-background/80 backdrop-blur-sm h-8">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      下载
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">请从左侧选择一个文件进行预览</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 右栏：数据标注 */}
      <Card className="col-span-3 card-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">数据标注</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {selectedEvidence ? (
            <ScrollArea className="h-full custom-scrollbar">
              <div className="p-3 space-y-4">
                {/* 基本信息 */}
                <div>
                  <h4 className="font-medium text-foreground mb-2 text-sm">基本信息</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">证据ID:</span>
                      <span className="font-medium text-right break-all">{selectedEvidence.id}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">证据类型:</span>
                      <span className="font-medium text-right break-words max-w-[120px]" title={selectedEvidence.evidence_type}>{selectedEvidence.evidence_type || '未分类'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">文件名:</span>
                      <span className="font-medium text-right break-words max-w-[120px]" title={selectedEvidence.file_name}>{selectedEvidence.file_name}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">文件格式:</span>
                      <span className="font-medium text-right">{selectedEvidence.file_extension}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">文件大小:</span>
                      <span className="font-medium text-right">{selectedEvidence.file_size}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">上传时间:</span>
                      <span className="font-medium text-right break-words max-w-[120px]" title={selectedEvidence.created_at}>{selectedEvidence.created_at ? new Date(selectedEvidence.created_at).toLocaleString() : '-'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">更新时间:</span>
                      <span className="font-medium text-right break-words max-w-[120px]" title={selectedEvidence.updated_at}>{selectedEvidence.updated_at ? new Date(selectedEvidence.updated_at).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 分类结果 */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="h-3.5 w-3.5 text-blue-600" />
                    <h4 className="font-medium text-foreground text-sm">AI分类结果</h4>
                    <Badge variant="outline" className="text-xs">
                      置信度: {((editForm.classification_confidence || 0) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">分类类别:</Label>
                      {editing ? (
                        <Input
                          value={editForm.classification_category || ""}
                          onChange={e => setEditForm((f: any) => ({ ...f, classification_category: e.target.value }))}
                        />
                      ) : (
                        <div className="text-xs">{editForm.classification_category || "未分类"}</div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">置信度:</Label>
                      {editing ? (
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={editForm.classification_confidence ?? ""}
                          onChange={e => setEditForm((f: any) => ({ ...f, classification_confidence: Number(e.target.value) }))}
                        />
                      ) : (
                        <div className="text-xs">{((editForm.classification_confidence || 0) * 100).toFixed(2)}%</div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">分类理由:</Label>
                      {editing ? (
                        <Textarea
                          value={editForm.classification_reasoning || ""}
                          onChange={e => setEditForm((f: any) => ({ ...f, classification_reasoning: e.target.value }))}
                        />
                      ) : (
                        <div className="text-xs bg-muted/50 p-2 rounded-md mt-1 border max-h-[100px] overflow-y-auto">
                          {editForm.classification_reasoning || ''}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">分类时间:</Label>
                      <div className="text-xs">{editForm.classified_at ? new Date(editForm.classified_at).toLocaleString() : "-"}</div>
                    </div>
                  </div>
                </div>

                {/* 特征提取结果 */}
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Brain className="h-3.5 w-3.5 text-purple-600" />
                    <h4 className="font-medium text-foreground text-sm">特征提取结果</h4>
                  </div>
                  <div className="space-y-2">
                    {(editForm.evidence_features || []).map((slot: any, idx: number) => (
                      <div key={idx} className="bg-purple-50 p-2 rounded-md border space-y-1">
                        <div>
                          <Label className="text-xs">词槽名:</Label>
                          <span className="text-xs">{slot.slot_name}</span>
                        </div>
                        <div>
                          <Label className="text-xs">词槽值:</Label>
                          {editing ? (
                            <Input
                              value={slot.slot_value}
                              onChange={e => {
                                const newFeatures = [...editForm.evidence_features]
                                newFeatures[idx].slot_value = e.target.value
                                setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                              }}
                            />
                          ) : (
                            <span className="text-xs">{slot.slot_value}</span>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">置信度:</Label>
                          <span className="text-xs">{((slot.confidence || 0) * 100).toFixed(2)}%</span>
                        </div>
                        <div>
                          <Label className="text-xs">理由:</Label>
                          <span className="text-xs">{slot.reasoning}</span>
                        </div>
                      </div>
                    ))}
                    <div>
                      <Label className="text-xs text-muted-foreground">特征提取时间:</Label>
                      <div className="text-xs">{editForm.features_extracted_at ? new Date(editForm.features_extracted_at).toLocaleString() : "-"}</div>
                    </div>
                  </div>
                </div>

                {/* 编辑/保存按钮 */}
                <div className="flex gap-2 mt-2">
                  {editing ? (
                    <>
                      <Button onClick={() => handleSave(editForm, setEditing)}>保存</Button>
                      <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setEditing(true)}>编辑标注</Button>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">请选择一个文件查看详情</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function EvidenceGallery({ caseId, onBack }: { caseId: string | number; onBack?: () => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [classifying, setClassifying] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // 获取证据列表
  const { data: evidenceData } = useSWR(
    ['/api/evidences', String(caseId), searchTerm, page, pageSize],
    evidenceFetcher,
    {
      suspense: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )
  const evidenceList = evidenceData?.data || []

  // 自动选中第一个证据
  useEffect(() => {
    if (evidenceList.length > 0) {
      setSelectedEvidence(evidenceList[0]);
    } else {
      setSelectedEvidence(null);
    }
  }, [evidenceList]);

  const handleBatchClassify = async () => {
    setClassifying(true)
    try {
      if (selectedIds.length === 0) {
        toast({ title: "提示", description: "请先选择证据", variant: "destructive" })
        return
      }
      const formData = new FormData()
      formData.append("case_id", String(caseId))
      selectedIds.forEach(id => formData.append("evidence_ids", String(id)))
      formData.append("auto_classification", "true")
      formData.append("auto_feature_extraction", "false")
      await evidenceApi.autoProcess(formData)
      toast({ title: "智能分类完成", description: `成功分类 ${selectedIds.length} 个证据` })
      setSelectedIds([])
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
    } catch (e: any) {
      toast({ title: "智能分类失败", description: e?.message || '未知错误', variant: "destructive" })
    } finally {
      setClassifying(false)
    }
  }

  const handleBatchFeatureExtraction = async () => {
    setExtracting(true)
    try {
      if (selectedIds.length === 0) {
        toast({ title: "提示", description: "请先选择证据", variant: "destructive" })
        return
      }
      // 适配后端逻辑：特征提取必须依赖分类
      // 这里始终 auto_classification=true, auto_feature_extraction=true
      const formData = new FormData()
      formData.append("case_id", String(caseId))
      selectedIds.forEach(id => formData.append("evidence_ids", String(id)))
      formData.append("auto_classification", "true")
      formData.append("auto_feature_extraction", "true")
      await evidenceApi.autoProcess(formData)
      toast({ title: "特征提取完成", description: `成功提取 ${selectedIds.length} 个证据的特征` })
      setSelectedIds([])
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
    } catch (e: any) {
      toast({ title: "特征提取失败", description: e?.message || '未知错误', variant: "destructive" })
    } finally {
      setExtracting(false)
    }
  }

  // 在 EvidenceGallery 组件作用域内定义 handleSave
  const handleSave = async (editForm: any, setEditing: (v: boolean) => void) => {
    try {
      const payload: any = {
        classification_category: editForm.classification_category,
        classification_confidence: editForm.classification_confidence,
        classification_reasoning: editForm.classification_reasoning,
      };
      if (Array.isArray(editForm.evidence_features)) {
        payload.evidence_features = editForm.evidence_features.map((slot: any) => ({
          slot_value: slot.slot_value
        }))
      }
      await evidenceApi.updateEvidence(editForm.id, payload)
      setEditing(false)
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
      toast({ title: "保存成功" })
    } catch (e: any) {
      toast({ title: "保存失败", description: e?.message || '未知错误', variant: "destructive" })
    }
  }

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
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
    } catch (e) {
      toast({ title: "上传失败", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">证据管理</h1>
          <p className="text-muted-foreground mt-2">智能证据处理</p>
        </div>
        <div className="flex gap-3 items-center ml-auto">
          <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg" onClick={() => setIsUploadDialogOpen(true)}>
            上传证据
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>返回案件</Button>
          )}
        </div>
      </div>
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
                <p className="text-sm text-gray-500">支持 PDF、JPG、PNG、MP3 等格式，最大 50MB</p>
                <Input type="file" className="hidden" id="fileUpload" multiple onChange={e => {
                  if (e.target.files) setSelectedFiles(Array.from(e.target.files))
                }} />
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
      {/* 搜索栏 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="搜索证据名称、案件、类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted/50 border-0 focus:bg-background"
          />
        </div>
        <Button variant="outline" className="border-primary/20 hover:bg-primary/5 bg-transparent">
          <Filter className="h-4 w-4 mr-2" />
          高级筛选
        </Button>
      </div>

      {/* 多选智能分类和特征提取按钮 */}
      {selectedIds.length > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <Button onClick={handleBatchClassify} disabled={classifying} className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
            {classifying ? "分类中..." : "智能分类"}
          </Button>
          <Button onClick={handleBatchFeatureExtraction} disabled={extracting} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            {extracting ? "提取中..." : "特征提取"}
          </Button>
          <span className="text-sm text-muted-foreground">已选 {selectedIds.length} 项</span>
        </div>
      )}

      <Suspense fallback={<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>}>
        <EvidenceGalleryContent 
          caseId={caseId}
          searchTerm={searchTerm}
          page={page}
          pageSize={pageSize}
          selectedEvidence={selectedEvidence}
          setSelectedEvidence={setSelectedEvidence}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          handleBatchClassify={handleBatchClassify}
          classifying={classifying}
          handleBatchFeatureExtraction={handleBatchFeatureExtraction}
          extracting={extracting}
          handleSave={handleSave}
        />
      </Suspense>
    </div>
  )
}