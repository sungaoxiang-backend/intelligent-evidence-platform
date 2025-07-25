"use client"

import { useState, Suspense, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { useAutoProcessWebSocket } from "@/hooks/use-websocket"
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

// 判断特征提取是否完整
const isFeatureComplete = (evidence: any) => {
  const features = evidence.evidence_features || [];
  if (features.length === 0) return false;
  
  const completedFeatures = features.filter((f: any) => 
    f.slot_value && f.slot_value !== "未知" && f.slot_value.trim() !== ""
  );
  
  return completedFeatures.length === features.length;
};

// 获取状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case "checked":
      return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
    case "features_extracted":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
    case "classified":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
    case "uploaded":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
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
    case "classified":
      return "已分类";
    case "uploaded":
      return "已上传";
    default:
      return "未知状态";
  }
};

// 动态分组逻辑
const groupEvidence = (evidenceList: any[]) => {
  const groupMap: Record<string, any[]> = {};
  evidenceList.forEach(e => {
    // 优先使用AI分类结果，如果没有则使用evidence_type，都没有则归类为'其他'
    let type = e.classification_category || e.evidence_type || '其他';
    
    // 确保分类名称不为空字符串或null
    if (!type || type.trim() === '') {
      type = '其他';
    }
    
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
  handleBatchAnalysis,
  handleSave,
  toast,
}: {
  caseId: string | number
  searchTerm: string
  page: number
  pageSize: number
  selectedEvidence: any
  setSelectedEvidence: (evidence: any) => void
  selectedIds: number[]
  setSelectedIds: (ids: number[]) => void
  handleBatchAnalysis: () => void
  handleSave: (editForm: any, setEditing: (v: boolean) => void) => void
  toast: any
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

  // 这个函数现在在外部定义，这里删除重复定义

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

  // 处理文件下载
  const handleDownload = () => {
    if (selectedEvidence?.file_url) {
      try {
        const link = document.createElement('a')
        link.href = selectedEvidence.file_url
        link.download = selectedEvidence.file_name || 'evidence'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // 这里可以添加成功提示，但需要toast context
      } catch (error) {
        console.error('下载失败:', error)
        // 这里可以添加错误提示，但需要toast context
      }
    } else {
      console.warn('文件URL不存在')
      // 这里可以添加错误提示，但需要toast context
    }
  }

  // 右侧数据标注区域
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>(selectedEvidence)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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
    <div className="grid grid-cols-12 gap-4 items-start">
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
                      <span className="font-medium">{cat || '其他'}</span>
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
                        : evidence.evidence_status === "checked"
                        ? "hover:bg-green-50/50 border-green-200/30 hover:border-green-300/50 bg-green-50/30"
                        : evidence.evidence_status === "features_extracted"
                        ? "hover:bg-blue-50/50 border-blue-200/30 hover:border-blue-300/50 bg-blue-50/30"
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
                        <h4 className="font-medium text-sm text-foreground break-words leading-tight" title={evidence.file_name || ''}>
                          {evidence.file_name || ''}
                        </h4>
                        <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-popover text-popover-foreground p-2 rounded-md shadow-lg border max-w-[200px] text-xs whitespace-normal">
                          {evidence.file_name || ''}
                        </div>
                      </div>
                      <div className="flex items-start space-x-1.5 mt-1 flex-wrap">
                        <Badge className={getStatusColor(evidence.evidence_status)} variant="outline">
                          {getStatusText(evidence.evidence_status)}
                        </Badge>
                        {evidence.isKey && (
                          <Badge variant="destructive" className="text-xs">
                            关键
                          </Badge>
                        )}
                        {/* 特征提取完整度指示器 */}
                        {evidence.evidence_features && evidence.evidence_features.length > 0 && (
                          <Badge 
                            className={`${isFeatureComplete(evidence) ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs font-medium`}
                            variant="outline"
                          >
                            {isFeatureComplete(evidence) ? "特征完整" : "特征不完整"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 break-words leading-tight" title={(evidence.format ?? "") + " • " + (evidence.size ?? "")}>
                        {(evidence.format ?? "") + " • " + (evidence.size ?? "")}
                      </p>
                      {/* 显示分类信息 */}
                      {(evidence.classification_category || evidence.evidence_type) && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 break-words leading-tight" title={evidence.classification_category || evidence.evidence_type || '其他'}>
                          {evidence.classification_category || evidence.evidence_type || '其他'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 中栏：文件预览 */}
      <Card className="col-span-6 card-shadow sticky top-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">文件预览</CardTitle>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100vh-280px)]">
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
                <div 
                  className="relative h-full overflow-hidden"
                >
                  {selectedEvidence?.file_url ? (
                    <img
                      src={selectedEvidence.file_url}
                      alt={selectedEvidence?.file_name || ''}
                      className="w-full h-full object-contain bg-muted/30 cursor-pointer transition-all duration-300"
                      onClick={() => setIsPreviewOpen(true)}
                      onError={(e) => {
                        // 图片加载失败时，替换为占位符
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="h-full flex items-center justify-center bg-muted/30">
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
                  ) : (
                    <div className="h-full flex items-center justify-center bg-muted/30">
                      <div className="text-center">
                        <svg className="h-16 w-16 text-muted-foreground mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        <p className="text-muted-foreground">暂无预览</p>
                      </div>
                    </div>
                  )}
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
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="bg-background/80 backdrop-blur-sm h-8"
                      onClick={handleDownload}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      下载
                    </Button>
                  </div>
                  
                  {/* 大图弹窗 Dialog */}
                  <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                    <DialogContent className="flex flex-col items-center justify-center bg-black/80">
                      <DialogTitle className="sr-only">图片预览</DialogTitle>
                      <img
                        src={selectedEvidence?.file_url}
                        alt={selectedEvidence?.file_name || ''}
                        style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
                      />
                      <Button onClick={() => setIsPreviewOpen(false)} className="mt-4">关闭</Button>
                    </DialogContent>
                  </Dialog>
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
                    <span className="font-medium text-right break-words max-w-[120px]" title={selectedEvidence.classification_category || selectedEvidence.evidence_type}>
                      {selectedEvidence.classification_category || selectedEvidence.evidence_type || '未分类'}
                    </span>
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
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">证据状态:</span>
                    <Badge className={getStatusColor(selectedEvidence.evidence_status)} variant="outline">
                      {getStatusText(selectedEvidence.evidence_status)}
                    </Badge>
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
                  {editForm.evidence_features && editForm.evidence_features.length > 0 && (
                    <Badge 
                      className={`${isFeatureComplete(editForm) ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs font-medium`}
                      variant="outline"
                    >
                      {isFeatureComplete(editForm) ? "特征完整" : "特征不完整"}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {(editForm.evidence_features || []).map((slot: any, idx: number) => (
                    <div key={idx} className={`p-2 rounded-md border space-y-1 ${
                      slot.slot_value && slot.slot_value !== "未知" && slot.slot_value.trim() !== ""
                        ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800/30"
                        : "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800/30"
                    }`}>
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
                            className={slot.slot_value && slot.slot_value !== "未知" && slot.slot_value.trim() !== "" 
                              ? "border-green-300 focus:border-green-500" 
                              : "border-red-300 focus:border-red-500"
                            }
                          />
                        ) : (
                          <span className={`text-xs font-medium ${
                            slot.slot_value && slot.slot_value !== "未知" && slot.slot_value.trim() !== ""
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }`}>
                            {slot.slot_value}
                          </span>
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
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewEvidenceIds, setReviewEvidenceIds] = useState<number[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [statusAnimation, setStatusAnimation] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // WebSocket进度管理
  const { progress: wsProgress, error: wsError, isProcessing, startAutoProcess, disconnect } = useAutoProcessWebSocket()

  // 获取案件信息
  const { data: caseData } = useSWR(
    ['/api/cases', String(caseId)],
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

  // 计算特征完整率和证据完备率
  const featureCompleteCount = evidenceList.filter((e: any) => isFeatureComplete(e)).length
  const featureCompleteReviewedCount = evidenceList.filter((e: any) => isFeatureComplete(e) && e.evidence_status === "checked").length
  
  const featureCompleteRate = evidenceList.length > 0 ? Math.round((featureCompleteCount / evidenceList.length) * 100) : 0
  const evidenceCompleteRate = evidenceList.length > 0 ? Math.round((featureCompleteReviewedCount / evidenceList.length) * 100) : 0

  // 自动选中第一个证据
  useEffect(() => {
    if (evidenceList.length > 0) {
      setSelectedEvidence(evidenceList[0]);
    } else {
      setSelectedEvidence(null);
    }
  }, [evidenceList]);

  // WebSocket进度监听
  useEffect(() => {
    if (wsProgress?.status === 'completed') {
      toast({ title: "智能分析完成", description: wsProgress.message })
      setSelectedIds([])
      setIsCompleted(true) // 设置完成状态
      mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
      
      // 不立即调用disconnect，让WebSocket hook自己管理清理
      // setTimeout(() => {
      //   setIsCompleted(false)
      //   disconnect()
      // }, 3000)
    } else if (wsProgress?.status === 'ocr_success') {
      // OCR成功状态不需要显示toast，因为会很频繁
      // 只记录日志，不中断流程
    } else if (wsProgress?.status === 'ocr_error') {
      // OCR错误不应该中断整个流程，只显示警告
      toast({ 
        title: "OCR处理警告", 
        description: wsProgress.message || "某个证据OCR处理失败，但会继续处理其他证据", 
        variant: "destructive" 
      })
      // 不清理selectedIds，继续处理其他证据
    } else if (wsProgress?.status === 'error') {
      toast({ title: "智能分析失败", description: wsProgress.message || "处理过程中发生错误", variant: "destructive" })
      setSelectedIds([])
      // 立即清理错误状态
      setTimeout(() => {
        disconnect()
      }, 1000)
    } else if (wsError) {
      toast({ title: "智能分析失败", description: wsError, variant: "destructive" })
      setSelectedIds([])
      // 立即清理错误状态
      setTimeout(() => {
        disconnect()
      }, 1000)
    }
  }, [wsProgress, wsError, caseId, searchTerm, page, pageSize, toast, disconnect])

  // 状态切换动画
  useEffect(() => {
    if (wsProgress?.status) {
      setStatusAnimation(true)
      const timer = setTimeout(() => setStatusAnimation(false), 600)
      return () => clearTimeout(timer)
    }
  }, [wsProgress?.status])



  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  // 智能分类功能已注释 - 分类和特征提取合并为一个原子操作
  // const handleBatchClassify = async () => {
  //   setClassifying(true)
  //   try {
  //     if (selectedIds.length === 0) {
  //       toast({ title: "提示", description: "请先选择证据", variant: "destructive" })
  //       return
  //     }
  //     const formData = new FormData()
  //     formData.append("case_id", String(caseId))
  //     selectedIds.forEach(id => formData.append("evidence_ids", String(id)))
  //     formData.append("auto_classification", "true")
  //     formData.append("auto_feature_extraction", "false")
  //     await evidenceApi.autoProcess(formData)
  //     toast({ title: "智能分类完成", description: `成功分类 ${selectedIds.length} 个证据` })
  //     setSelectedIds([])
  //     await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
  //   } catch (e: any) {
  //     toast({ title: "智能分类失败", description: e?.message || '未知错误', variant: "destructive" })
  //   } finally {
  //     setClassifying(false)
  //   }
  // }

  const handleBatchAnalysis = async () => {
    try {
      if (selectedIds.length === 0) {
        toast({ title: "提示", description: "请先选择证据", variant: "destructive" })
        return
      }
      
      // 使用WebSocket进行智能分析
      startAutoProcess({
        case_id: Number(caseId),
        evidence_ids: selectedIds,
        auto_classification: true,
        auto_feature_extraction: true
      }, () => {
        // 完成回调：清理完成状态
        setIsCompleted(false)
      })
      
    } catch (e: any) {
      toast({ title: "智能分析失败", description: e?.message || '未知错误', variant: "destructive" })
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

  // 批量审核逻辑
  async function handleBatchReview() {
    if (reviewEvidenceIds.length === 0) return
    setReviewing(true)
    try {
      await evidenceApi.batchCheckEvidence({
        evidence_ids: reviewEvidenceIds
      })
      toast({ title: "批量审核成功", description: `成功审核 ${reviewEvidenceIds.length} 个证据` })
      setIsReviewDialogOpen(false)
      setReviewEvidenceIds([])
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
    } catch (e: any) {
      toast({ title: "批量审核失败", description: e?.message || '未知错误', variant: "destructive" })
    } finally {
      setReviewing(false)
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
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg" 
            onClick={() => setIsReviewDialogOpen(true)}
          >
            审核证据
          </Button>
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

      {/* 批量审核弹窗 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>批量审核证据</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              选择需要审核的证据（仅显示特征完整且未审核的证据）
            </div>
            
            {/* 待审核证据列表 */}
            <div className="max-h-[400px] overflow-y-auto border rounded-lg p-4">
              <div className="space-y-2">
                {evidenceList
                  .filter((e: any) => isFeatureComplete(e) && e.evidence_status !== "checked")
                  .map((evidence: any) => {
                    const isSelected = reviewEvidenceIds.includes(evidence.id);
                    return (
                      <div
                        key={evidence.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30" 
                            : "hover:bg-muted/50 border-border"
                        }`}
                        onClick={() => {
                          if (isSelected) {
                            setReviewEvidenceIds(reviewEvidenceIds.filter(id => id !== evidence.id));
                          } else {
                            setReviewEvidenceIds([...reviewEvidenceIds, evidence.id]);
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
                            {evidence.file_url ? (
                              <img
                                src={evidence.file_url}
                                alt={evidence.file_name}
                                className="w-12 h-12 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                <Eye className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground truncate">
                              {evidence.file_name}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {evidence.classification_category} • {evidence.file_extension}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge className={getStatusColor(evidence.evidence_status)} variant="outline">
                                {getStatusText(evidence.evidence_status)}
                              </Badge>
                              {evidence.evidence_features && evidence.evidence_features.length > 0 && (
                                <Badge 
                                  className={`${isFeatureComplete(evidence) ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs`}
                                  variant="outline"
                                >
                                  {isFeatureComplete(evidence) ? "特征完整" : "特征不完整"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              {evidenceList.filter((e: any) => isFeatureComplete(e) && e.evidence_status !== "checked").length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无待审核的证据</p>
                  <p className="text-sm">所有证据都已审核完成或特征不完整</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                已选择 {reviewEvidenceIds.length} 个证据
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>
                  取消
                </Button>
                <Button 
                  onClick={handleBatchReview} 
                  disabled={reviewing || reviewEvidenceIds.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {reviewing ? "审核中..." : `确认审核 ${reviewEvidenceIds.length} 个证据`}
                </Button>
              </div>
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

      {/* 案件和证据概览 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
        {/* 标题和说明 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">案件和证据概览</h3>
            <p className="text-xs text-muted-foreground mt-1">
              显示当前案件基本信息和证据处理流程状态统计
            </p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">证据特征完整率</div>
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{featureCompleteRate}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">证据审核完备率</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{evidenceCompleteRate}%</div>
            </div>
          </div>
        </div>
        
        {/* 案件基本信息 */}
        {caseData && (
          <div className="mb-3 p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              案件基本信息
            </h4>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">案件ID:</span>
                <span className="font-medium">{caseData.data.id || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">案件类型:</span>
                <Badge variant="outline" className="text-xs">
                  {caseData.data.case_type === 'debt' ? '债务纠纷' : 
                   caseData.data.case_type === 'contract' ? '合同纠纷' :
                   caseData.data.case_type === 'property' ? '财产纠纷' :
                   caseData.data.case_type || '未知'}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">债权人:</span>
                <span className="font-medium max-w-[100px] truncate" title={caseData.data.creditor_name}>
                  {caseData.data.creditor_name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">债务人:</span>
                <span className="font-medium max-w-[100px] truncate" title={caseData.data.debtor_name}>
                  {caseData.data.debtor_name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">创建时间:</span>
                <span className="font-medium">
                  {caseData.data.created_at ? new Date(caseData.data.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">更新时间:</span>
                <span className="font-medium">
                  {caseData.data.updated_at ? new Date(caseData.data.updated_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* 证据处理状态统计 */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            证据处理状态统计
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {evidenceList.length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">总证据数</div>
              <div className="text-xs text-muted-foreground mt-0.5">已上传的证据文件总数</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-green-200/30 dark:border-green-800/30">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {evidenceList.filter((e: any) => e.evidence_status === "checked").length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">已审核</div>
              <div className="text-xs text-muted-foreground mt-0.5">人工审核确认无误</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-orange-200/30 dark:border-orange-800/30">
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {evidenceList.filter((e: any) => e.evidence_status === "features_extracted").length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">待审核</div>
              <div className="text-xs text-muted-foreground mt-0.5">AI已处理，等待人工审核</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-gray-200/30 dark:border-gray-800/30">
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                {evidenceList.filter((e: any) => e.evidence_status === "uploaded" || e.evidence_status === "classified").length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">待处理</div>
              <div className="text-xs text-muted-foreground mt-0.5">等待AI处理或分类</div>
            </div>
          </div>
          
          {/* 状态说明 */}
          <div className="mt-2 pt-2 border-t border-blue-200/30 dark:border-blue-800/30">
            <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>已审核</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span>待审核</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                <span>待处理</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 智能分析按钮 - 标准版本 */}
      {(selectedIds.length > 0 || isProcessing || isCompleted) && (
        <div className="mb-2 flex items-center gap-3">
          {/* 标准宽度的智能分析按钮 */}
          <Button 
            onClick={handleBatchAnalysis} 
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
                "分析中..."
              ) : (
                "智能分析"
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
            {selectedIds.length > 0 ? (
              <>
                <span>已选 {selectedIds.length} 项</span>
                <span>•</span>
              </>
            ) : null}
            <span className="flex items-center gap-1">
              <Brain className="h-3 w-3" />
              {isCompleted ? '分析完成' : isProcessing ? '自动分类 + 特征提取' : '自动分类 + 特征提取'}
            </span>
          </div>
          
          {/* 进度状态显示 */}
          {(wsProgress || isCompleted) && !isCompleted && (
            <div className="flex items-center gap-2">
              <div className="bg-muted/30 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="min-w-0">
                    <div className={`text-xs font-medium text-foreground status-text ${statusAnimation ? 'flip-up' : ''}`}>
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
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {wsProgress?.progress ? Math.round(wsProgress.progress) : 0}%
              </div>
            </div>
          )}
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
          handleBatchAnalysis={handleBatchAnalysis}
          handleSave={handleSave}
          toast={toast}
        />
      </Suspense>
    </div>
  )
}