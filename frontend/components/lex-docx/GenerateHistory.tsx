"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Download, FileText, Calendar, User, Search, Filter, Eye } from "lucide-react"
import { lexDocxApi, type DocumentGeneration } from "@/lib/api/lex-docx"
import { usePaginatedSWR } from "@/hooks/use-paginated-swr"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface GenerateHistoryProps {
  templateId?: number
  generatedBy?: number
  className?: string
}

export function GenerateHistory({
  templateId,
  generatedBy,
  className,
}: GenerateHistoryProps) {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [templateFilter, setTemplateFilter] = useState<number | null>(
    templateId || null
  )
  const [userFilter, setUserFilter] = useState<number | null>(generatedBy || null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [selectedGeneration, setSelectedGeneration] = useState<DocumentGeneration | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  // 使用 SWR 获取生成记录列表
  const {
    data: generations,
    loading,
    error,
    page,
    pageSize,
    total,
    setPage,
    setPageSize,
    mutate,
  } = usePaginatedSWR<DocumentGeneration>(
    "/lex-docx/generations",
    async (params) => {
      const result = await lexDocxApi.getGenerations({
        template_id: templateFilter || undefined,
        generated_by: userFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
      })
      return result
    },
    [templateFilter, userFilter, startDate, endDate],
    20,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      dedupingInterval: 10000,
    }
  )

  // 处理下载
  const handleDownload = async (generation: DocumentGeneration) => {
    setDownloadingId(generation.id)
    try {
      // 使用 document_url 直接下载
      const link = document.createElement("a")
      link.href = generation.document_url
      link.download = generation.document_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "下载成功",
        description: "文档已开始下载",
      })
    } catch (error) {
      toast({
        title: "下载失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  // 处理筛选重置
  const handleResetFilters = () => {
    setSearchTerm("")
    setTemplateFilter(templateId || null)
    setUserFilter(generatedBy || null)
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  // 过滤记录（客户端搜索）
  const filteredGenerations = generations?.filter((generation) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesFilename = generation.document_filename
        .toLowerCase()
        .includes(searchLower)
      if (!matchesFilename) {
        return false
      }
    }
    return true
  })

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 搜索和筛选栏 */}
      <div className="p-4 border-b space-y-3 bg-background">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="搜索文件名..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetFilters}
          >
            <Filter className="h-4 w-4 mr-2" />
            重置筛选
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              开始日期
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              结束日期
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-destructive">
            <p>{error.message || "加载失败"}</p>
          </div>
        ) : !filteredGenerations || filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2" />
            <p>暂无生成记录</p>
          </div>
        ) : (
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件名</TableHead>
                  <TableHead>模板ID</TableHead>
                  <TableHead>生成人</TableHead>
                  <TableHead>生成时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGenerations.map((generation) => (
                  <TableRow key={generation.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {generation.document_filename}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">#{generation.template_id}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>用户 #{generation.generated_by}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(
                            new Date(generation.generated_at),
                            "yyyy-MM-dd HH:mm"
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedGeneration(generation)
                            setShowDetailDialog(true)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          详情
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(generation)}
                          disabled={downloadingId === generation.id}
                        >
                          {downloadingId === generation.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                              下载中...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              下载
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {filteredGenerations && filteredGenerations.length > 0 && (
        <div className="p-4 border-t flex items-center justify-between bg-background">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => setPageSize(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                上一页
              </Button>
              <span className="text-sm px-2">
                {page} / {Math.ceil(total / pageSize) || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= Math.ceil(total / pageSize)}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 记录详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>生成记录详情</DialogTitle>
            <DialogDescription>
              查看生成记录的详细信息和表单数据
            </DialogDescription>
          </DialogHeader>

          {selectedGeneration && (
            <div className="space-y-4 py-4">
              {/* 基本信息 */}
              <div className="space-y-2">
                <h3 className="font-semibold">基本信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">记录ID:</span>
                    <span className="ml-2 font-medium">#{selectedGeneration.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">模板ID:</span>
                    <span className="ml-2 font-medium">#{selectedGeneration.template_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">生成人:</span>
                    <span className="ml-2 font-medium">用户 #{selectedGeneration.generated_by}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">生成时间:</span>
                    <span className="ml-2 font-medium">
                      {format(new Date(selectedGeneration.generated_at), "yyyy-MM-dd HH:mm:ss")}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">文件名:</span>
                    <span className="ml-2 font-medium">{selectedGeneration.document_filename}</span>
                  </div>
                </div>
              </div>

              {/* 表单数据 */}
              <div className="space-y-2">
                <h3 className="font-semibold">表单数据</h3>
                <div className="border rounded-lg p-4 bg-muted/50">
                  {Object.keys(selectedGeneration.form_data).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(selectedGeneration.form_data).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2">
                          <span className="text-sm font-medium text-muted-foreground min-w-[120px]">
                            {key}:
                          </span>
                          <span className="text-sm flex-1">
                            {Array.isArray(value) ? (
                              <span>{value.join(", ")}</span>
                            ) : typeof value === "object" && value !== null ? (
                              <pre className="text-xs bg-background p-2 rounded overflow-auto">
                                {JSON.stringify(value, null, 2)}
                              </pre>
                            ) : (
                              <span>{String(value)}</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">无表单数据</p>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailDialog(false)}
                >
                  关闭
                </Button>
                <Button
                  onClick={() => {
                    handleDownload(selectedGeneration)
                    setShowDetailDialog(false)
                  }}
                  disabled={downloadingId === selectedGeneration.id}
                >
                  {downloadingId === selectedGeneration.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      下载中...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      下载文档
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

