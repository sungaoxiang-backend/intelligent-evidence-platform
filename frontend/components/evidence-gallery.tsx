"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Upload,
  Search,
  Filter,
  Eye,
  Download,
  FileText,
  ImageIcon,
  Video,
  File,
  Brain,
  Tag,
  ZoomIn,
  Edit,
  Loader2,
} from "lucide-react"
import { evidenceApi } from "@/lib/api"
import { caseApi } from "@/lib/api"
import type { Evidence } from "@/lib/types"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"

export function EvidenceGallery({ caseId, onBack }: { caseId: string | number; onBack?: () => void }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>(undefined)
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
  const [evidenceList, setEvidenceList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [aiClassify, setAiClassify] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [caseOptions, setCaseOptions] = useState<{ id: number; title: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const { toast } = useToast();

  // 动态分组：有分类的按evidence_type分组，无分类归为“其他”
  const groupMap: Record<string, any[]> = {};
  evidenceList.forEach(e => {
    const type = e.evidence_type || '其他';
    if (!groupMap[type]) groupMap[type] = [];
    groupMap[type].push(e);
  });
  const groupKeys = Object.keys(groupMap);
  // 当前选中的分组
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  // 当前分组下的证据
  const groupedEvidence = activeCategory === '全部'
    ? evidenceList
    : (groupMap[activeCategory] || []);

  useEffect(() => {
    loadEvidence()
    loadCases()
  }, [searchTerm, page, pageSize])

  const loadCases = async () => {
    try {
      const res = await caseApi.getCases({ page: 1, pageSize: 100 })
      setCaseOptions(res.data.map((c: any) => ({ id: c.id, title: c.title })))
    } catch {
      setCaseOptions([])
    }
  }

  const loadEvidence = async () => {
    setLoading(true)
    try {
      const response = await evidenceApi.getEvidences({
        page,
        pageSize,
        search: searchTerm,
        case_id: Number(caseId),
      })
      setEvidenceList(response.data)
      setTotal(response.pagination?.total || 0)
    } catch (error) {
      setEvidenceList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedCaseId || uploadFiles.length === 0) return
    setUploading(true)
    try {
      await evidenceApi.uploadEvidences({
        case_id: selectedCaseId,
        files: uploadFiles,
        withClassification: aiClassify,
      })
      setIsUploadDialogOpen(false)
      setUploadFiles([])
      setSelectedCaseId(undefined)
      loadEvidence()
    } catch (e) {
      // 错误处理
    } finally {
      setUploading(false)
    }
  }

  // 证据类型枚举
  const evidenceTypeOptions = [
    { value: "chat", label: "聊天记录" },
    { value: "document", label: "书面证据" },
    { value: "payment", label: "支付凭证" },
    { value: "audio", label: "音频证据" },
    { value: "scene", label: "现场证据" },
    { value: "other", label: "其他" },
  ]

  // 上传文件选择并立即上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && selectedCaseId) {
      setUploading(true)
      try {
        await evidenceApi.uploadEvidences({
          case_id: selectedCaseId,
          files: Array.from(e.target.files),
          withClassification: false,
        })
        setIsUploadDialogOpen(false)
        setUploadFiles([])
        setSelectedCaseId(undefined)
        loadEvidence()
      } catch (err) {
        // 错误处理
      } finally {
        setUploading(false)
      }
    } else {
      setUploadFiles(e.target.files ? Array.from(e.target.files) : [])
    }
  }

  const categories = [
    { id: "all", label: "全部证据", count: evidenceList.length },
    { id: "聊天记录", label: "聊天记录", count: evidenceList.filter((e) => e.evidence_type === "聊天记录").length },
    { id: "书面证据", label: "书面证据", count: evidenceList.filter((e) => e.evidence_type === "书面证据").length },
    { id: "支付凭证", label: "支付凭证", count: evidenceList.filter((e) => e.evidence_type === "支付凭证").length },
    { id: "音频证据", label: "音频证据", count: evidenceList.filter((e) => e.evidence_type === "音频证据").length },
    { id: "现场证据", label: "现场证据", count: evidenceList.filter((e) => e.evidence_type === "现场证据").length },
  ]

  const getFileIcon = (format: string | undefined) => {
    switch ((format?.toLowerCase() ?? "")) {
      case "pdf":
        return <FileText className="h-5 w-5 text-red-600" />
      case "jpg":
      case "png":
      case "jpeg":
        return <ImageIcon className="h-5 w-5 text-blue-600" />
      case "mp3":
      case "wav":
        return <Video className="h-5 w-5 text-purple-600" />
      default:
        return <File className="h-5 w-5 text-muted-foreground" />
    }
  }

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

  const filteredEvidence = evidenceList.filter((evidence) => {
    const matchesSearch =
      (evidence.file_name?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
      (evidence.evidence_type?.toLowerCase() ?? "").includes(searchTerm.toLowerCase()) ||
      (evidence.case?.title?.toLowerCase() ?? "").includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  // 全选/反选逻辑
  const allIds = groupedEvidence.map(e => e.id)
  const isAllSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id))
  const isIndeterminate = selectedIds.length > 0 && !isAllSelected
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }
  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
  }

  // 多选智能分类
  const [classifying, setClassifying] = useState(false);
  const handleBatchClassify = async () => {
    setClassifying(true);
    try {
      // 取选中证据的 file_url
      const urls = groupedEvidence.filter(e => selectedIds.includes(e.id)).map(e => e.file_url)
      await evidenceApi.classifyEvidencesByUrls(urls);
      toast({ title: "智能分类完成" });
      setSelectedIds([]);
      loadEvidence();
    } catch (e: any) {
      toast({ title: "智能分类失败", description: e?.message || '', variant: "destructive" });
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">证据管理</h1>
          <p className="text-muted-foreground mt-2">智能证据处理</p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack}>返回案件</Button>
        )}
      </div>

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

      {/* 多选智能分类按钮 */}
      {selectedIds.length > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <Button onClick={handleBatchClassify} disabled={classifying} className="bg-gradient-to-r from-blue-500 to-green-500 text-white">
            {classifying ? "分类中..." : "智能分类"}
          </Button>
          <span className="text-sm text-muted-foreground">已选 {selectedIds.length} 项</span>
        </div>
      )}

      {/* 三栏布局 */}
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
                    key="全部"
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
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="mr-2 h-4 w-4 rounded border border-primary focus:ring-2 focus:ring-primary"
                    />
                    <span className="ml-2 text-xs text-muted-foreground">全选</span>
                  </div>
                  {groupedEvidence.map((evidence) => {
                    const checked = selectedIds.includes(evidence.id)
                    return (
                      <div
                        key={evidence.id}
                        onClick={() => setSelectedEvidence(evidence)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all duration-200 border flex items-center ${
                          selectedEvidence?.id === evidence.id
                            ? "bg-primary/10 border-primary/30 shadow-sm"
                            : "hover:bg-muted/50 border-transparent hover:border-border"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={checked => handleSelectOne(evidence.id, !!checked)}
                          className="mr-2"
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
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate text-foreground" title={evidence.file_name || ''}>
                            {evidence.file_name || ''}
                          </h4>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <Badge className={getStatusColor(evidence.status)} variant="outline">
                              {evidence.status}
                            </Badge>
                            {evidence.isKey && (
                              <Badge variant="destructive" className="text-xs">
                                关键
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {(evidence.format ?? "") + " • " + (evidence.size ?? "")}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">证据ID:</span>
                        <span className="font-medium">{selectedEvidence.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">证据类型:</span>
                        <span className="font-medium">{selectedEvidence.evidence_type || '未分类'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">文件名:</span>
                        <span className="font-medium">{selectedEvidence.file_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">文件格式:</span>
                        <span className="font-medium">{selectedEvidence.file_extension}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">文件大小:</span>
                        <span className="font-medium">{selectedEvidence.file_size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">上传时间:</span>
                        <span className="font-medium">{selectedEvidence.created_at}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* AI分类结果 */}
                  {selectedEvidence.is_classified && (
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Brain className="h-3.5 w-3.5 text-blue-600" />
                        <h4 className="font-medium text-foreground text-sm">AI分类结果</h4>
                        <Badge variant="outline" className="text-xs">
                          置信度: {((selectedEvidence.classification_confidence || 0) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">分类理由:</Label>
                          <div className="text-sm bg-muted/50 p-2.5 rounded-md mt-1 border">
                            {selectedEvidence.classification_reasoning || ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* 操作按钮 */}
                  <div className="space-y-2">
                    <Button className="w-full h-8 text-sm">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      下载原文件
                    </Button>
                    <Button variant="outline" className="w-full bg-transparent h-8 text-sm">
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      编辑标注
                    </Button>
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
    </div>
  )
}

