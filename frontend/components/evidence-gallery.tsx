"use client"

import { useState, Suspense, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Eye,
  Download,
  Video,
  ZoomIn,
  Brain,
  Upload,
  FileText,
} from "lucide-react"
import { evidenceApi } from "@/lib/api"
import { caseApi } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useGlobalTasks } from "@/contexts/global-task-context"
import { useEvidenceAnalysis } from "@/hooks/use-celery-tasks"

// SWR数据获取函数
const evidenceFetcher = async ([_key, caseId, search, page, pageSize]: [string, string, string, number, number]) => {
  const response = await evidenceApi.getEvidences({
    page,
    pageSize,
    search,
    case_id: Number(caseId),
    sort_by: "created_at",  // 按上传时间排序
    sort_order: "desc",     // 降序，新上传的在上面
  })
  return response
}



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

// 获取证据类型支持的角色列表
const getSupportedRolesForEvidenceType = (evidenceType: string): string[] => {
  // 这里可以根据evidence_types.yaml的配置来返回支持的角色
  // 暂时硬编码一些常见的证据类型，后续可以从配置文件或API获取
  const evidenceTypeRoles: Record<string, string[]> = {
    "微信个人主页": ["creditor", "debtor"],
    "身份证": ["creditor", "debtor"],
    "中华人民共和国居民户籍档案": ["creditor", "debtor"],
    "公司营业执照": ["creditor", "debtor"],
    "个体工商户营业执照": ["creditor", "debtor"],
    "公司全国企业公示系统截图": ["creditor", "debtor"],
    "个体工商户全国企业公示系统截图": ["creditor", "debtor"],
    "经常居住地证明": ["creditor", "debtor"],
  };
  
  return evidenceTypeRoles[evidenceType] || [];
};

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

// 获取特征项的颜色样式
const getFeatureColor = (slot: any) => {
  const slotRequired = slot.slot_required ?? true; // 默认为true
  const slotValue = slot.slot_value;
  
  // 检查是否有有效值，支持多种数据类型
  const hasValue = slotValue && 
    slotValue !== "未知" && 
    slotValue !== "" && 
    slotValue !== null && 
    slotValue !== undefined;
  
  // 判断特征是否有效：有值即可
  const isValid = hasValue;
  
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
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
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
  
  // 使用所有证据，不进行筛选
  const filteredEvidenceList = evidenceList
  
  const groupMap = groupEvidence(filteredEvidenceList)
  const groupKeys = Object.keys(groupMap)
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  // 这个函数现在在外部定义，这里删除重复定义

  const groupedEvidence = activeCategory === '全部'
    ? filteredEvidenceList
    : (groupMap[activeCategory] || []);

  const allIds = groupedEvidence.map((e: any) => e.id)
  const isAllSelected = allIds.length > 0 && allIds.every((id: string) => selectedIds.includes(id))

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
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
  const [editForm, setEditForm] = useState<any>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)

  useEffect(() => {
    // 只有在非编辑状态下才同步数据，避免编辑时数据被重置
    if (!editing && selectedEvidence) {
      setEditForm(selectedEvidence)
    }
  }, [selectedEvidence, editing])

  // 如果没有选中的证据或editForm，显示提示信息
  if (!selectedEvidence || !editForm) {
    return (
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* 左栏：文件列表 */}
        <Card className="col-span-3 card-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              全部分类
              <Badge variant="secondary" className="text-xs">
                {filteredEvidenceList.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 分类筛选 */}
            <div className="px-3 pb-3">
              <ScrollArea className="h-28">
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setActiveCategory('全部')
                      setSelectedIds([]) // 清空选中的证据ID
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeCategory === '全部' ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">全部证据</span>
                      <Badge variant="outline" className="text-xs">{filteredEvidenceList.length}</Badge>
                    </div>
                  </button>
                  {groupKeys.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat)
                        setSelectedIds([]) // 清空选中的证据ID
                      }}
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
                              className={`${evidence.features_complete ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs font-medium`}
                              variant="outline"
                            >
                              {evidence.features_complete ? "特征完整" : "特征不完整"}
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
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">请从左侧选择一个文件进行预览</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 右栏：数据标注 */}
        <Card className="col-span-3 card-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">数据标注</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-base">请选择一个文件查看详情</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 items-start">
      {/* 左栏：文件列表 */}
      <Card className="col-span-3 card-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            全部分类
            <Badge variant="secondary" className="text-xs">
              {filteredEvidenceList.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 分类筛选 */}
          <div className="px-3 pb-3">
            <ScrollArea className="h-28">
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveCategory('全部')
                    setSelectedIds([]) // 清空选中的证据ID
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors ${activeCategory === '全部' ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">全部证据</span>
                    <Badge variant="outline" className="text-xs">{filteredEvidenceList.length}</Badge>
                  </div>
                </button>
                {groupKeys.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat)
                      setSelectedIds([]) // 清空选中的证据ID
                    }}
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
                            className={`${evidence.features_complete ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs font-medium`}
                            variant="outline"
                          >
                            {evidence.features_complete ? "特征完整" : "特征不完整"}
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
                    
                    {/* 证据角色选择 */}
                    {(() => {
                      // 检查当前证据类型是否配置了supported_roles
                      const evidenceType = selectedEvidence.classification_category || selectedEvidence.evidence_type;
                      const supportedRoles = getSupportedRolesForEvidenceType(evidenceType);
                      
                      // 添加调试信息
                      console.log('Evidence Role Debug:', {
                        evidenceType,
                        supportedRoles,
                        selectedEvidenceEvidenceRole: selectedEvidence.evidence_role,
                        editFormEvidenceRole: editForm.evidence_role,
                        editing
                      });
                      
                      if (supportedRoles && supportedRoles.length > 0) {
                        return (
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-muted-foreground shrink-0">证据角色:</span>
                            {editing ? (
                              <select
                                value={editForm.evidence_role || ''}
                                onChange={e => setEditForm((f: any) => ({ ...f, evidence_role: e.target.value }))}
                                className="text-xs border rounded px-2 py-1 bg-background"
                              >
                                <option value="">请选择角色</option>
                                {supportedRoles.map((role: string) => (
                                  <option key={role} value={role}>
                                    {role === 'creditor' ? '债权人' : role === 'debtor' ? '债务人' : role}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-medium text-right">
                                {editForm.evidence_role ? 
                                  (editForm.evidence_role === 'creditor' ? '债权人' : 
                                   editForm.evidence_role === 'debtor' ? '债务人' : 
                                   editForm.evidence_role) : 
                                  '未指定'}
                              </span>
                            )}
                          </div>
                        );
                      }
                      
                      // 如果没有支持的角色，也显示字段但标记为不支持
                      return (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">证据角色:</span>
                          <span className="font-medium text-right text-muted-foreground">
                            此证据类型不支持角色选择
                          </span>
                        </div>
                      );
                    })()}
                    
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
                        className={`${editForm.features_complete ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs font-medium`}
                        variant="outline"
                      >
                        {editForm.features_complete ? "特征完整" : "特征不完整"}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {/* 直接使用 evidence_features 中的 required 信息进行分组 */}
                    {(() => {
                      const features = editForm.evidence_features || [];
                      
                      // 1. 找出所有分组的字段（required 是字符串的）
                      const groupedFields = new Map<string, any[]>();
                      const processedFields = new Set<string>();
                      
                      features.forEach((feature: any) => {
                        if (typeof feature.slot_required === 'string' && feature.slot_required !== 'true' && feature.slot_required !== 'false') {
                          // 创建分组键，确保互相引用的字段在同一个组
                          const groupKey = [feature.slot_name, feature.slot_required].sort().join('_');
                          if (!groupedFields.has(groupKey)) {
                            groupedFields.set(groupKey, []);
                          }
                          groupedFields.get(groupKey)!.push(feature);
                          processedFields.add(feature.slot_name);
                        }
                      });
                      
                      // 2. 处理独立的必需字段（required 是 true 且不在分组中的）
                      const independentFeatures = features.filter((feature: any) => 
                        feature.slot_required === true && !processedFields.has(feature.slot_name)
                      );
                      
                      // 3. 处理可选字段（required 是 false 且不在分组中的）
                      const optionalFeatures = features.filter((feature: any) => 
                        feature.slot_required === false && !processedFields.has(feature.slot_name)
                      );
                      
                      return (
                        <>
                          {/* 分组特征 */}
                          {Array.from(groupedFields.entries()).map(([groupKey, groupFeatures]) => {
                            // 检查组内是否有字段有值（不是"未知"）
                            const hasValidValue = groupFeatures.some((f: any) => {
                              const value = f.slot_value;
                              return value && value !== "未知" && value !== "" && value !== null && value !== undefined;
                            });
                            const colors = getFeatureColor(groupFeatures[0]); // 使用第一个字段的颜色
                            
                            return (
                              <div key={groupKey} className={`p-3 rounded-md border space-y-3 ${
                                hasValidValue 
                                  ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-700" 
                                  : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-700"
                              }`}>
                                {/* 分组标题 */}
                                <div className={`text-xs font-medium pb-2 border-b ${
                                  hasValidValue 
                                    ? "text-green-700 dark:text-green-300 border-green-200" 
                                    : "text-red-700 dark:text-red-300 border-red-200"
                                }`}>
                                  任意一个特征必须
                                </div>
                                
                                {/* 分组内的字段 */}
                                <div className="space-y-3">
                                  {groupFeatures.map((feature: any, featureIndex: number) => {
                                    const originalIdx = features.findIndex((f: any) => f === feature);
                                    
                                    return (
                                      <div key={feature.slot_name} className="space-y-2">
                                        <div className="flex items-center gap-1">
                                          <Label className="text-xs font-medium">词槽名:</Label>
                                          <span className="text-xs">{feature.slot_name}</span>
                                        </div>
                                        <div>
                                          <Label className="text-xs">词槽值:</Label>
                                          {editing ? (
                                            <Input
                                              value={feature.slot_value}
                                              onChange={e => {
                                                const newFeatures = [...features]
                                                newFeatures[originalIdx].slot_value = e.target.value
                                                setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                              }}
                                              className={colors.input}
                                            />
                                          ) : (
                                            <span className={`text-xs font-medium ${colors.text}`}>
                                              {String(feature.slot_value)}
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
                                              value={feature.confidence || 0}
                                              onChange={e => {
                                                const newFeatures = [...features]
                                                newFeatures[originalIdx].confidence = parseFloat(e.target.value)
                                                newFeatures[originalIdx].reasoning = "人工编辑"
                                                setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                              }}
                                              className="text-xs h-6"
                                            />
                                          ) : (
                                            <span className="text-xs">{((feature.confidence || 0) * 100).toFixed(2)}%</span>
                                          )}
                                        </div>
                                        <div>
                                          <Label className="text-xs">理由:</Label>
                                          {editing ? (
                                            <Textarea
                                              value={feature.reasoning || ""}
                                              onChange={e => {
                                                const newFeatures = [...features]
                                                newFeatures[originalIdx].reasoning = e.target.value
                                                setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                              }}
                                              rows={2}
                                              className="text-xs"
                                            />
                                          ) : (
                                            <span className="text-xs">{feature.reasoning}</span>
                                          )}
                                        </div>
                                        
                                        {/* 字段分隔线（除了最后一个字段） */}
                                        {featureIndex < groupFeatures.length - 1 && (
                                          <Separator className="my-3" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* 独立必需特征 */}
                          {independentFeatures.map((feature: any, idx: number) => {
                            const colors = getFeatureColor(feature)
                            const originalIdx = features.findIndex((f: any) => f === feature)
                            return (
                              <div key={originalIdx} className={`p-2 rounded-md border space-y-1 ${colors.container}`}>
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs font-medium">词槽名:</Label>
                                  <span className="text-xs">{feature.slot_name}</span>
                                </div>
                                <div>
                                  <Label className="text-xs">词槽值:</Label>
                                  {editing ? (
                                    <Input
                                      value={feature.slot_value}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].slot_value = e.target.value
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      className={colors.input}
                                    />
                                  ) : (
                                    <span className={`text-xs font-medium ${colors.text}`}>
                                      {String(feature.slot_value)}
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
                                      value={feature.confidence || 0}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].confidence = parseFloat(e.target.value)
                                        newFeatures[originalIdx].reasoning = "人工编辑"
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      className="text-xs h-6"
                                    />
                                  ) : (
                                    <span className="text-xs">{((feature.confidence || 0) * 100).toFixed(2)}%</span>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs">理由:</Label>
                                  {editing ? (
                                    <Textarea
                                      value={feature.reasoning || ""}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].reasoning = e.target.value
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      rows={2}
                                      className="text-xs"
                                    />
                                  ) : (
                                    <span className="text-xs">{feature.reasoning}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          
                          {/* 非必需特征展开按钮 */}
                          {optionalFeatures.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowOptionalFields(!showOptionalFields)}
                              className="w-full text-xs h-8 mt-2"
                            >
                              {showOptionalFields ? '收起' : '展开'} 非必需特征 
                              ({optionalFeatures.length} 个)
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
                          {showOptionalFields && optionalFeatures.map((feature: any, idx: number) => {
                            const colors = getFeatureColor(feature)
                            const originalIdx = features.findIndex((f: any) => f === feature)
                            return (
                              <div key={originalIdx} className={`p-2 rounded-md border space-y-1 ${colors.container}`}>
                                <div className="flex items-center gap-1">
                                  <Label className="text-xs font-medium">词槽名:</Label>
                                  <span className="text-xs">{feature.slot_name}</span>
                                </div>
                                <div>
                                  <Label className="text-xs">词槽值:</Label>
                                  {editing ? (
                                    <Input
                                      value={feature.slot_value}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].slot_value = e.target.value
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      className={colors.input}
                                    />
                                  ) : (
                                    <span className={`text-xs font-medium ${colors.text}`}>
                                      {String(feature.slot_value)}
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
                                      value={feature.confidence || 0}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].confidence = parseFloat(e.target.value)
                                        newFeatures[originalIdx].reasoning = "人工编辑"
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      className="text-xs h-6"
                                    />
                                  ) : (
                                    <span className="text-xs">{((feature.confidence || 0) * 100).toFixed(2)}%</span>
                                  )}
                                </div>
                                <div>
                                  <Label className="text-xs">理由:</Label>
                                  {editing ? (
                                    <Textarea
                                      value={feature.reasoning || ""}
                                      onChange={e => {
                                        const newFeatures = [...features]
                                        newFeatures[originalIdx].reasoning = e.target.value
                                        setEditForm((f: any) => ({ ...f, evidence_features: newFeatures }))
                                      }}
                                      rows={2}
                                      className="text-xs"
                                    />
                                  ) : (
                                    <span className="text-xs">{feature.reasoning}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )
                    })()}
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

export function EvidenceGallery({ caseId, onBack, onGoToCaseDetail }: { caseId: string | number; onBack?: () => void; onGoToCaseDetail?: () => void }) {
  const searchTerm = ""
  const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const { toast } = useToast()
  const [page] = useState(1)
  const [pageSize] = useState(20)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [reviewEvidenceIds, setReviewEvidenceIds] = useState<number[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // 获取URL查询参数
  const searchParams = useSearchParams()

  // 全局任务管理
  const { tasks, addTask, updateTask, removeTask } = useGlobalTasks()
  const { startEvidenceAnalysis } = useEvidenceAnalysis({ addTask, updateTask, removeTask })

  // 获取当前任务状态 - 简化版本，只用于显示，不用于控制按钮状态
  const getCurrentTaskStatus = () => {
    const runningTasks = tasks.filter(task => task.status === 'running')
    if (runningTasks.length > 0) {
      return {
        isProcessing: true,
        progress: runningTasks[0].progress,
        status: runningTasks[0].status,
        message: runningTasks[0].message
      }
    }
    
    return {
      isProcessing: false,
      progress: 0,
      status: '',
      message: ''
    }
  }

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

  // 使用所有证据，不进行筛选
  const filteredEvidenceList = evidenceList

  // 键盘导航处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检查是否有预览弹窗打开
      const isPreviewOpen = document.querySelector('[data-state="open"]') !== null;
      
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
          // 关闭预览弹窗
          const closeButton = document.querySelector('[data-state="open"] button[aria-label="Close"]') as HTMLButtonElement;
          if (closeButton) {
            closeButton.click();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEvidence, filteredEvidenceList]);

  // 计算特征完整率和证据完备率
  const featureCompleteCount = filteredEvidenceList.filter((e: any) => e.features_complete).length
  const evidenceReviewedCount = filteredEvidenceList.filter((e: any) => isEvidenceReadyForReview(e) && e.evidence_status === "checked").length

  // 自动选中第一个证据，但保持当前选中状态
  useEffect(() => {
    if (filteredEvidenceList.length > 0) {
      // 检查URL参数中是否有指定的证据ID
      const evidenceIdFromUrl = searchParams.get('evidence')
      
      if (evidenceIdFromUrl) {
        const targetEvidence = filteredEvidenceList.find((e: any) => e.id === parseInt(evidenceIdFromUrl))
        if (targetEvidence) {
          setSelectedEvidence(targetEvidence)
          // 如果URL中指定了证据，也自动选中它
          if (!selectedIds.includes(targetEvidence.id)) {
            setSelectedIds([targetEvidence.id])
          }
          return
        }
      }
      
      // 如果当前没有选中的证据，或者当前选中的证据不在过滤后的列表中，则选中第一个
      if (!selectedEvidence || !filteredEvidenceList.find((e: any) => e.id === selectedEvidence.id)) {
        setSelectedEvidence(filteredEvidenceList[0]);
      }
    } else {
      setSelectedEvidence(null);
    }
  }, [filteredEvidenceList, selectedEvidence, searchParams, selectedIds]);


  // 组件卸载时清理
  useEffect(() => {
    return () => {
      setSelectedIds([])
    }
  }, [])

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
      
      // 获取案件信息和证据类型
      const caseTitle = caseData?.title || `案件 ${caseId}`
      const evidenceTypes = filteredEvidenceList
        .filter(evidence => selectedIds.includes(evidence.id))
        .map(evidence => evidence.classification_category)
        .filter(Boolean)

      // 使用Celery异步任务进行智能分析
      const result = await startEvidenceAnalysis({
        case_id: Number(caseId),
        evidence_ids: selectedIds,
        auto_classification: true,
        auto_feature_extraction: true,
        caseTitle,
        evidenceTypes
      })

      if (result.success) {
        // 任务启动成功，清空选择
        setSelectedIds([])
      }
      
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
      
      // 添加证据角色字段
      if (editForm.evidence_role !== undefined) {
        payload.evidence_role = editForm.evidence_role;
      }
      
      if (Array.isArray(editForm.evidence_features)) {
        payload.evidence_features = editForm.evidence_features.map((slot: any) => ({
          slot_name: slot.slot_name,
          slot_desc: slot.slot_desc || slot.slot_name,
          slot_value_type: slot.slot_value_type || "string",
          slot_required: slot.slot_required !== undefined ? slot.slot_required : true,
          slot_value: slot.slot_value,
          confidence: slot.confidence,
          reasoning: slot.reasoning
        }))
      }
      await evidenceApi.updateEvidence(editForm.id, payload)
      setEditing(false)
      
      // 刷新证据列表
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize])
      
      // 重新获取更新后的证据列表数据，并更新selectedEvidence
      const updatedData = await evidenceFetcher(['/api/evidences', String(caseId), searchTerm, page, pageSize])
      const updatedEvidence = updatedData?.data?.find((e: any) => e.id === editForm.id)
      if (updatedEvidence) {
        setSelectedEvidence(updatedEvidence)
      }
      
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

  // 批量删除逻辑
  const handleBatchDelete = async () => {
    try {
      if (selectedIds.length === 0) {
        toast({ title: "提示", description: "请先选择证据", variant: "destructive" });
        return;
      }
      await evidenceApi.batchDeleteEvidences(selectedIds.map(id => Number(id)));
      toast({ title: "删除成功", description: `成功删除 ${selectedIds.length} 个证据` });
      setSelectedIds([]);
      setIsDeleteDialogOpen(false);
      await mutate(['/api/evidences', String(caseId), searchTerm, page, pageSize]);
    } catch (e: any) {
      toast({ title: "删除失败", description: e?.message || '未知错误', variant: "destructive" });
    }
  };

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
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        .animate-sparkle {
          animation: sparkle 1s infinite;
        }
        
        @keyframes bounce-dots {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-2px);
          }
          60% {
            transform: translateY(-1px);
          }
        }
        
        .animate-bounce-dots {
          animation: bounce-dots 1.5s infinite;
        }
      `}</style>
      
      <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">独立证据分析</h1>
          <p className="text-muted-foreground mt-2">批量进行证据的分类和特征分析，特殊分类"微信聊天记录"需要进一步的联合特征分析</p>
        </div>
        <div className="flex gap-3 items-center ml-auto">
          {/* 审核证据按钮已注释 */}
          {/* <Button 
            size="lg" 
            className="bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg" 
            onClick={() => setIsReviewDialogOpen(true)}
          >
            审核证据
          </Button> */}
          <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg" onClick={() => setIsUploadDialogOpen(true)}>
            上传证据
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack}>返回案件列表</Button>
          )}
          {onGoToCaseDetail && (
            <Button 
              variant="outline" 
              onClick={onGoToCaseDetail}
              className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              <FileText className="w-4 h-4 mr-1" />
              案件详情
            </Button>
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
                <p className="text-sm text-gray-500">支持 JPG、PNG、BMP、WEBP 等图片格式，最大 50MB</p>
                <Input 
                  type="file" 
                  className="hidden" 
                  id="fileUpload" 
                  multiple 
                  accept="image/*"
                  onChange={e => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files)
                      const supportedFormats = ['jpg', 'jpeg', 'png', 'bmp', 'webp']
                      
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

      {/* 批量审核弹窗 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>批量审核证据</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              选择需要审核的证据（仅显示特征完整、校对通过且未审核的证据）
            </div>
            
            {/* 待审核证据列表 */}
            <div className="max-h-[400px] overflow-y-auto border rounded-lg p-4">
              <div className="space-y-2">
                {evidenceList
                  .filter((e: any) => isEvidenceReadyForReview(e) && e.evidence_status !== "checked")
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
                                  className={`${evidence.features_complete ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"} text-xs`}
                                  variant="outline"
                                >
                                  {evidence.features_complete ? "特征完整" : "特征不完整"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              {evidenceList.filter((e: any) => isEvidenceReadyForReview(e) && e.evidence_status !== "checked").length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>暂无待审核的证据</p>
                  <p className="text-sm">所有证据都已审核完成或特征不完整/校对未通过</p>
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
      {/* 搜索栏已移除 */}

      {/* 案件和证据概览 */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
        {/* 标题和说明 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">案件概览</h3>
          </div>
        </div>
        
        {/* 案件基本信息 */}
        {caseData && (
          <div className="mb-3 p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              案件基本信息
            </h4>
            <div className="space-y-3">
              {/* 第一行：债权人，债务人，欠款金额 */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">债权人:</span>
                  <span className="font-medium max-w-[80px] truncate" title={caseData.data.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || 'N/A'}>
                    {caseData.data.case_parties?.find((p: any) => p.party_role === "creditor")?.party_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">债务人:</span>
                  <span className="font-medium max-w-[80px] truncate" title={caseData.data.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || 'N/A'}>
                    {caseData.data.case_parties?.find((p: any) => p.party_role === "debtor")?.party_name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">欠款金额:</span>
                  <span className="font-medium">
                    {caseData.data.loan_amount !== null && caseData.data.loan_amount !== undefined 
                      ? `¥${caseData.data.loan_amount.toLocaleString()}` 
                      : 'N/A'}
                  </span>
                </div>
              </div>
              
              {/* 第二行：ID，创建时间，更新时间 */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">案件ID:</span>
                  <span className="font-medium">{caseData.data.id || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">创建时间:</span>
                  <span className="font-medium">
                    {caseData.data.created_at ? new Date(caseData.data.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">更新时间:</span>
                  <span className="font-medium">
                    {caseData.data.updated_at ? new Date(caseData.data.updated_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 证据处理状态统计 */}
        {/* <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            证据处理状态统计
          </h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {filteredEvidenceList.length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">证据总数</div>
              <div className="text-xs text-muted-foreground mt-0.5">已上传的证据文件总数</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-gray-200/30 dark:border-gray-800/30">
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">
                {filteredEvidenceList.filter((e: any) => e.evidence_status === "uploaded" || e.evidence_status === "classified").length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">待处理</div>
              <div className="text-xs text-muted-foreground mt-0.5">等待AI处理或分类</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-orange-200/30 dark:border-orange-800/30">
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {filteredEvidenceList.filter((e: any) => e.evidence_status === "features_extracted" && isEvidenceReadyForReview(e)).length}
              </div>
              <div className="text-xs text-muted-foreground font-medium">待审核</div>
              <div className="text-xs text-muted-foreground mt-0.5">特征完整且校对通过，等待人工审核</div>
            </div>
            <div className="text-center p-2 bg-white/50 dark:bg-white/5 rounded-lg border border-green-200/30 dark:border-green-800/30">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {evidenceReviewedCount}
              </div>
              <div className="text-xs text-muted-foreground font-medium">已审核</div>
              <div className="text-xs text-muted-foreground mt-0.5">人工审核确认无误</div>
            </div>
          </div>
          

        </div> */}
      </div>

            {/* 智能分析和批量删除按钮 */}
      <div className="mb-2 flex items-center gap-3">
        {/* 批量删除按钮 */}
        <Button
          variant="destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
          disabled={selectedIds.length === 0}
        >
          批量删除
        </Button>

        {/* 智能分析按钮 */}
        <Button 
          onClick={handleBatchAnalysis} 
          disabled={selectedIds.length === 0} 
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
        >
          <span className="flex items-center gap-2">
            {selectedIds.length === 0 ? (
              "请选择证据"
            ) : (
              "智能分析"
            )}
          </span>
        </Button>
        
        {/* 状态文本 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedIds.length > 0 ? (
            <>
              <span>已选 {selectedIds.length} 项</span>
              <span>•</span>
            </>
          ) : (
            <span className="text-orange-600 dark:text-orange-400">未选择证据</span>
          )}
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            自动分类 + 特征提取
          </span>
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div>
            <p>确定要删除选中的 {selectedIds.length} 个证据吗？此操作不可撤销。</p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleBatchDelete}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>

      

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
    </>
  )
}