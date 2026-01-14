"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Plus, Trash2, FileText, Download, MessageSquare, ChevronRight, ArrowLeft, Upload, Edit2, Sparkles } from "lucide-react"
import { caseAnalysisApi, CaseInfoCommit, CaseAnalysisReport } from "@/lib/api-case-analysis"
import { Case } from "@/lib/types"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { SelectCaseSwitcher } from "@/components/select-case-switcher"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { evidenceApi } from "@/lib/api"
import { AnalysisReportView } from "@/components/case-analysis/analysis-report-view"
import { LoadingView } from "@/components/case-analysis/loading-view"
import { LegalReportContent } from "@/lib/api-case-analysis"

export default function CaseAnalysisDetailPage() {
    const params = useParams()
    const router = useRouter()
    const caseId = Number(params.caseId)

    const [caseInfo, setCaseInfo] = useState<Case | null>(null)
    const [commits, setCommits] = useState<CaseInfoCommit[]>([])
    const [reports, setReports] = useState<CaseAnalysisReport[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCommitIds, setSelectedCommitIds] = useState<number[]>([])

    // Report state
    const [activeReport, setActiveReport] = useState<CaseAnalysisReport | null>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisProgress, setAnalysisProgress] = useState(0)
    const [analysisMessage, setAnalysisMessage] = useState("")
    const [taskLogs, setTaskLogs] = useState<string[]>([])

    // New/Edit Commit State
    const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false)
    const [editingCommit, setEditingCommit] = useState<CaseInfoCommit | null>(null)
    const [commitStatement, setCommitStatement] = useState("")

    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [commitFiles, setCommitFiles] = useState<{ name: string; url: string; type: string }[]>([])

    // Delete Confirmation State
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)


    useEffect(() => {
        if (caseId) fetchData()
    }, [caseId])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [caseData, commitsData, reportsData] = await Promise.all([
                caseAnalysisApi.getCase(caseId),
                caseAnalysisApi.getCommits(caseId).catch(() => []),
                caseAnalysisApi.getReports(caseId).catch(() => [])
            ])
            setCaseInfo(caseData)
            setCommits(commitsData)
            setReports(reportsData)

            // Check for pending/processing reports and start polling if needed
            const pendingReports = reportsData.filter(r => r.status === 'pending' || r.status === 'processing')
            if (pendingReports.length > 0) {
                setActiveReport(pendingReports[0])
                startPolling(pendingReports[0])
            } else {
                // Show latest completed report
                const completedReports = reportsData.filter(r => r.status === 'completed')
                if (completedReports.length > 0) {
                    setActiveReport(completedReports[0])
                }
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // Polling for task status
    const startPolling = useCallback((report: CaseAnalysisReport) => {
        setIsAnalyzing(true)
        setAnalysisMessage("正在分析中...")
        setAnalysisProgress(10)
        setTaskLogs([])

        let pollCount = 0
        const maxPolls = 100 // 5分钟(100次 * 3秒)
        const startTime = Date.now()

        const pollInterval = setInterval(async () => {
            try {
                pollCount++

                // 超时检测（5分钟）
                const elapsedMinutes = (Date.now() - startTime) / 60000
                if (pollCount >= maxPolls || elapsedMinutes >= 5) {
                    setIsAnalyzing(false)
                    clearInterval(pollInterval)
                    toast({
                        title: "分析超时",
                        description: "任务执行时间过长，请刷新页面查看状态",
                        variant: "destructive"
                    })
                    fetchData() // 刷新数据
                    return
                }

                // Refresh reports to check status
                const updatedReports = await caseAnalysisApi.getReports(caseId)
                const currentReport = updatedReports.find(r => r.id === report.id)

                if (!currentReport) {
                    // 报告不见了，可能被删除
                    setIsAnalyzing(false)
                    clearInterval(pollInterval)
                    toast({
                        title: "报告不存在",
                        description: "分析报告可能已被删除",
                        variant: "destructive"
                    })
                    fetchData()
                    return
                }

                if (currentReport.status === 'completed') {
                    setActiveReport(currentReport)
                    setIsAnalyzing(false)
                    setAnalysisProgress(100)
                    setAnalysisMessage("分析完成")
                    setTaskLogs([]) // clear logs
                    clearInterval(pollInterval)
                    toast({ title: "分析完成", description: "案件分析报告已生成" })
                    fetchData()
                } else if (currentReport.status === 'failed') {
                    setIsAnalyzing(false)
                    clearInterval(pollInterval)
                    toast({
                        title: "分析失败",
                        description: currentReport.error_message || "未知错误",
                        variant: "destructive"
                    })
                    fetchData()
                } else if (currentReport.status === 'processing') {
                    // 实时进度解析
                    const msg = currentReport.error_message
                    if (msg && !msg.includes('Error')) {
                        // 简单的进度估算逻辑
                        let progress = 10
                        if (msg.includes("法律思维推演")) progress = 40
                        else if (msg.includes("起草详细报告")) progress = 60
                        else {
                            const match = msg.match(/已生成 (\d+) 字/)
                            if (match) {
                                const count = parseInt(match[1])
                                progress = Math.min(95, 60 + (count / 3000) * 35)
                            }
                        }

                        setAnalysisProgress(progress)
                        setAnalysisMessage(msg)
                        setTaskLogs(prev => {
                            if (prev.length === 0 || prev[prev.length - 1] !== msg) {
                                return [...prev, msg]
                            }
                            return prev
                        })
                    } else {
                        // Fallback processing message
                        const estimatedProgress = Math.min(10 + (pollCount * 2), 90)
                        setAnalysisProgress(estimatedProgress)
                        setAnalysisMessage(`正在分析中... (${Math.floor(elapsedMinutes * 60)}秒)`)
                    }
                } else if (currentReport.status === 'pending') {
                    // 仍在等待
                    setAnalysisMessage("等待任务启动...")
                }
            } catch (e) {
                console.error("轮询失败:", e)
                // 不要因为单次失败就停止轮询
            }
        }, 3000) // Poll every 3 seconds

        // 返回清理函数
        return () => clearInterval(pollInterval)
    }, [caseId, fetchData])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return

        setUploading(true)
        try {
            const files = Array.from(e.target.files)
            const res = await evidenceApi.uploadEvidences({
                case_id: caseId,
                files: files,
                withClassification: false
            })

            const uploaded = res.data.map(ev => ({
                name: ev.file_name,
                url: ev.file_url,
                type: ev.file_extension || 'unknown'
            }))

            setCommitFiles(prev => [...prev, ...uploaded])
            toast({ title: "文件上传成功", description: `已上传 ${files.length} 个文件` })
        } catch (error) {
            console.error("Upload failed", error)
            toast({ title: "上传失败", description: "请重试", variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    const openNewCommitDialog = () => {
        setEditingCommit(null)
        setCommitStatement("")
        setCommitFiles([])
        setIsCommitDialogOpen(true)
    }

    const openEditCommitDialog = (commit: CaseInfoCommit) => {
        setEditingCommit(commit)
        setCommitStatement(commit.statement || "")
        setCommitFiles(commit.materials || [])
        setIsCommitDialogOpen(true)
    }

    const handleSaveCommit = async () => {
        try {
            if (editingCommit) {
                // Update existing commit
                await caseAnalysisApi.updateCommit(caseId, editingCommit.id, {
                    statement: commitStatement,
                    materials: commitFiles
                })
                toast({ title: "更新成功" })
            } else {
                // Create new commit
                await caseAnalysisApi.createCommit(caseId, {
                    statement: commitStatement,
                    materials: commitFiles
                })
                toast({ title: "提交成功" })
            }
            setIsCommitDialogOpen(false)
            fetchData()
            // Reset state
            setCommitStatement("")
            setCommitFiles([])
            setEditingCommit(null)
        } catch (e) {
            console.error(e)
            toast({ title: editingCommit ? "更新失败" : "提交失败", description: "后端接口可能尚未就绪", variant: "destructive" })
        }
    }

    const toggleCommitSelection = (id: number) => {
        setSelectedCommitIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const handleDeleteCommits = async () => {
        if (!selectedCommitIds.length) return
        setIsDeleteDialogOpen(true)
    }

    const confirmDeleteCommits = async () => {
        try {
            await caseAnalysisApi.deleteCommits(caseId, selectedCommitIds)
            toast({ title: "删除成功", description: `已删除 ${selectedCommitIds.length} 条记录` })
            setSelectedCommitIds([])
            setIsSelectionMode(false)
            fetchData()
        } catch (e) {
            console.error(e)
            toast({ title: "删除失败", description: "请重试", variant: "destructive" })
        } finally {
            setIsDeleteDialogOpen(false)
        }
    }

    const handleViewReportVersion = async (commit: CaseInfoCommit) => {
        // Find reports where this commit is the latest one (highest ID) in the reference list
        // This ensures we view the report that was generated specifically for this commit state
        const specificReports = reports.filter(r =>
            r.status === 'completed' &&
            r.ref_commit_ids.includes(commit.id) &&
            Math.max(...r.ref_commit_ids) === commit.id
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        if (specificReports.length > 0) {
            setActiveReport(specificReports[0])
            toast({
                title: "报告已切换",
                description: `查看基于提交 #${commit.id} 的分析报告`
            })
            return
        }

        // Fallback: if no specific report found (maybe logic changed or special case), 
        // try to find any report containing this commit
        const relevantReports = reports.filter(r =>
            r.ref_commit_ids.includes(commit.id) && r.status === 'completed'
        ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        if (relevantReports.length > 0) {
            setActiveReport(relevantReports[0])
            toast({
                title: "报告已切换",
                description: `查看包含提交 #${commit.id} 的最新报告`
            })
        } else {
            toast({
                title: "暂无相关报告",
                description: `该提交尚未生成分析报告`,
                variant: "destructive"
            })
        }
    }

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>
    }

    if (!caseInfo) {
        return <div>案件未找到</div>
    }

    // Determine parties
    const creditor = caseInfo.case_parties?.find(p => p.party_role === 'creditor')
    const debtor = caseInfo.case_parties?.find(p => p.party_role === 'debtor')

    return (
        <div className="container mx-auto py-4 px-4 h-[calc(100vh-4rem)] flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/case-analysis')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-xl font-bold">案件信息 #{caseInfo.id}</h1>
                </div>

                <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">切换案件:</span>
                    <SelectCaseSwitcher currentId={caseId} />
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
                {/* Left Column (35%) */}
                <div className="col-span-4 flex flex-col gap-4 overflow-hidden h-full">

                    {/* Merged Case Overview Card */}
                    <Card className="shrink-0">
                        <CardHeader className="py-3 bg-muted/20 border-b">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-sm">案件概况</h3>
                                <Badge variant={caseInfo?.case_status === 'draft' ? "outline" : "default"} className="text-xs px-1.5 py-0 h-5">
                                    {caseInfo?.case_status}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-3 text-sm space-y-3">
                            {/* Basic Info Row */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">案由</span>
                                    <span className="font-medium">{caseInfo.case_type === 'debt' ? '民间借贷纠纷' : '合同纠纷'}</span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">标的金额</span>
                                    <span className="font-medium font-mono">¥{caseInfo.loan_amount?.toLocaleString() || "0"}</span>
                                </div>
                            </div>

                            <Separator />

                            {/* Parties Row */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {/* Creditor */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">债权人</span>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-primary">
                                                    <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80" side="right" align="start">
                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between border-b pb-2">
                                                        <h4 className="font-medium">债权人详情</h4>
                                                        <div className="flex gap-1">
                                                            {creditor?.party_type === 'person' && <Badge variant="secondary" className="text-xs">个人</Badge>}
                                                            {creditor?.party_type === 'company' && <Badge variant="secondary" className="text-xs">公司</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm space-y-2 pt-1">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <span className="text-muted-foreground">名称</span>
                                                            <span className="col-span-2 font-medium">{creditor?.party_name}</span>
                                                        </div>
                                                        {creditor && (
                                                            <>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <span className="text-muted-foreground">电话</span>
                                                                    <span className="col-span-2">{creditor.phone || "-"}</span>
                                                                </div>
                                                                {creditor.party_type === 'person' && (
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <span className="text-muted-foreground">身份证</span>
                                                                        <span className="col-span-2">{creditor.id_card || "-"}</span>
                                                                    </div>
                                                                )}
                                                                {creditor.party_type === 'company' && (
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <span className="text-muted-foreground">信用代码</span>
                                                                        <span className="col-span-2 text-xs break-all">{creditor.company_code || "-"}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <span className="font-medium truncate" title={creditor?.party_name}>{creditor?.party_name || "未设置"}</span>
                                </div>

                                {/* Debtor */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">债务人</span>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-primary">
                                                    <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80" side="right" align="start">
                                                <div className="grid gap-2">
                                                    <div className="flex items-center justify-between border-b pb-2">
                                                        <h4 className="font-medium">债务人详情</h4>
                                                        <div className="flex gap-1">
                                                            {debtor?.party_type === 'person' && <Badge variant="secondary" className="text-xs">个人</Badge>}
                                                            {debtor?.party_type === 'company' && <Badge variant="secondary" className="text-xs">公司</Badge>}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm space-y-2 pt-1">
                                                        <div className="grid grid-cols-3 gap-2">
                                                            <span className="text-muted-foreground">名称</span>
                                                            <span className="col-span-2 font-medium">{debtor?.party_name}</span>
                                                        </div>
                                                        {debtor && (
                                                            <>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <span className="text-muted-foreground">电话</span>
                                                                    <span className="col-span-2">{debtor.phone || "-"}</span>
                                                                </div>
                                                                {debtor.party_type === 'person' && (
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <span className="text-muted-foreground">身份证</span>
                                                                        <span className="col-span-2">{debtor.id_card || "-"}</span>
                                                                    </div>
                                                                )}
                                                                {debtor.party_type === 'company' && (
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <span className="text-muted-foreground">信用代码</span>
                                                                        <span className="col-span-2 text-xs break-all">{debtor.company_code || "-"}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <span className="font-medium truncate" title={debtor?.party_name}>{debtor?.party_name || "未设置"}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Commits Section */}
                    <Card className="flex-1 flex flex-col overflow-hidden min-h-0 border-t-4 border-t-primary/5">
                        <CardHeader className="py-2 px-3 border-b flex flex-row items-center justify-between bg-muted/10">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                分析记录
                                <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] justify-center">{commits.length}</Badge>
                            </h3>
                            <div className="flex items-center gap-1">
                                {isSelectionMode ? (
                                    <>
                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsSelectionMode(false)}>取消</Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            disabled={selectedCommitIds.length === 0}
                                            onClick={handleDeleteCommits}
                                        >
                                            删除({selectedCommitIds.length})
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsSelectionMode(true)} title="管理记录">
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                )}

                                <Button variant="default" size="sm" className="h-7 px-2 text-xs shadow-sm ml-1" onClick={openNewCommitDialog}>
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    补充信息
                                </Button>
                            </div>

                        </CardHeader>
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-4">
                                {commits.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                                        <MessageSquare className="h-8 w-8 opacity-20" />
                                        <p className="text-xs">暂无分析记录，请点击"补充信息"</p>
                                    </div>
                                ) : (
                                    commits.map((commit, idx) => (
                                        <div key={commit.id} className="relative pl-4 pb-4 last:pb-0">
                                            {/* Timeline Line */}
                                            {idx !== commits.length - 1 && (
                                                <div className="absolute left-[5px] top-2 bottom-0 w-px bg-border" />
                                            )}
                                            {/* Timeline Dot */}
                                            <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-primary/20 ring-4 ring-background" />

                                            <div
                                                className={`group flex gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40 cursor-pointer ${selectedCommitIds.includes(commit.id) ? "bg-muted border-primary/50" : "bg-card"
                                                    } ${activeReport?.ref_commit_ids.includes(commit.id) ? "ring-2 ring-primary/30" : ""}`}
                                                onClick={() => !isSelectionMode && handleViewReportVersion(commit)}
                                            >
                                                {isSelectionMode && (
                                                    <Checkbox
                                                        checked={selectedCommitIds.includes(commit.id)}
                                                        onCheckedChange={() => toggleCommitSelection(commit.id)}
                                                        className="mt-1 mr-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                <div className="flex-1 space-y-2 overflow-hidden">
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>{new Date(commit.created_at).toLocaleString()}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-mono opacity-50">#{commit.id}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    openEditCommitDialog(commit)
                                                                }}
                                                            >
                                                                <Edit2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Statement */}
                                                    <div className="relative">
                                                        <div className="text-foreground leading-relaxed whitespace-pre-wrap break-words">
                                                            {commit.statement || <span className="text-muted-foreground italic">无文字陈述</span>}
                                                        </div>
                                                    </div>

                                                    {/* Materials */}
                                                    {commit.materials && commit.materials.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 pt-1">
                                                            {commit.materials.map((m, i) => (
                                                                <a
                                                                    key={i}
                                                                    href={m.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 rounded bg-muted/80 px-2 py-1 text-xs hover:bg-muted transition-colors border max-w-full"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    <FileText className="h-3 w-3 shrink-0" />
                                                                    <span className="truncate max-w-[150px]">{m.name}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Right Column (65%) */}
                <div className="col-span-8 h-full flex flex-col overflow-hidden">
                    <Card className="h-full flex flex-col overflow-hidden">
                        <CardHeader className="py-3 border-b flex flex-row justify-between items-center">
                            <div className="flex items-center space-x-4">
                                <h3 className="font-semibold text-lg">案件报告</h3>
                                {activeReport && (
                                    <div className="flex items-center gap-2">
                                        <Badge variant={
                                            activeReport.status === 'completed' ? 'default' :
                                                activeReport.status === 'processing' ? 'secondary' :
                                                    activeReport.status === 'failed' ? 'destructive' : 'outline'
                                        } className="font-normal text-xs">
                                            {activeReport.status === 'completed' ? '已完成' :
                                                activeReport.status === 'processing' ? '处理中' :
                                                    activeReport.status === 'failed' ? '失败' : '等待中'}
                                        </Badge>
                                        {activeReport.ref_commit_ids.length > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                依据提交: {activeReport.ref_commit_ids.map(id => `#${id}`).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {activeReport?.status === 'completed' && <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-2" />导出</Button>}
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-0">
                            {isAnalyzing ? (
                                <div className="h-full flex flex-col items-center justify-center bg-gray-50/50">
                                    <LoadingView
                                        progress={analysisProgress}
                                        message={analysisMessage || "正在初始化..."}
                                        logs={taskLogs}
                                    />
                                </div>
                            ) : activeReport?.error_message && activeReport.status === 'failed' ? (
                                <div className="h-full flex flex-col items-center justify-center text-destructive p-8">
                                    <p className="text-lg font-medium">分析失败</p>
                                    <p className="text-sm mt-2 max-w-lg text-center bg-destructive/10 p-4 rounded border border-destructive/20">{activeReport.error_message}</p>
                                </div>
                            ) : !activeReport || !activeReport.content ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <FileText className="h-16 w-16 mb-4 opacity-20" />
                                    <p>暂无分析报告</p>
                                    <p className="text-sm">Agent 将根据左侧提交的记录生成报告</p>
                                </div>
                            ) : (
                                <div className="h-auto w-full">
                                    <AnalysisReportView content={activeReport.content as LegalReportContent} />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Commit Dialog */}
            <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCommit ? '编辑提交' : '新建提交'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>用户陈述</Label>
                            <Textarea
                                value={commitStatement}
                                onChange={e => setCommitStatement(e.target.value)}
                                placeholder="输入用户描述..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>材料文件</Label>
                            <div className="flex flex-col space-y-2">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors relative">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="p-2 bg-muted rounded-full">
                                            <Upload className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-medium">点击上传或拖拽文件到此处</p>
                                        <p className="text-xs text-muted-foreground">支持图片、PDF、Excel、Word等格式，最大 50MB</p>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => document.getElementById('file-upload-input')?.click()}
                                        >
                                            选择文件
                                        </Button>
                                    </div>
                                    <Input
                                        id="file-upload-input"
                                        type="file"
                                        multiple
                                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                    />
                                </div>
                                {uploading && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        正在上传...
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {commitFiles.map((f, i) => (
                                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                                            {f.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveCommit} disabled={uploading}>
                            {editingCommit ? '保存' : '提交'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Validating Delete Alert Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            您确定要删除选中的 {selectedCommitIds.length} 条提交记录吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteCommits} className="bg-destructive hover:bg-destructive/90">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
