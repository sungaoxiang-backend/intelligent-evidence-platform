"use client"

import { evidenceApi } from "@/lib/api"
import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Upload,
  Search,
  Eye,
  Download,
  FileText,
  ImageIcon,
  Video,
  File,
} from "lucide-react"
import { Pagination } from "@/components/pagination"
import { useToast } from "@/components/ui/use-toast"
import { caseApi } from "@/lib/api"
import useSWR, { mutate } from "swr"

// SWR数据获取函数
const evidenceFetcher = async ([key, search, page, pageSize]: [string, string, number, number]) => {
  const response = await evidenceApi.getEvidences({
    page,
    pageSize,
    search,
    withCase: true,
  })
  return response
}

const caseFetcher = async ([key]: [string]) => {
  const res = await caseApi.getCases({ page: 1, pageSize: 100 })
  return res.data || []
}

// 使用Suspense的证据数据展示组件
function EvidenceTableContent({ 
  searchTerm, 
  page, 
  pageSize, 
  onPreview, 
  onDownload, 
  onDelete 
}: {
  searchTerm: string
  page: number
  pageSize: number
  onPreview: (evidence: any) => void
  onDownload: (evidence: any) => void
  onDelete: (evidence: any) => void
}) {
  const { data, error } = useSWR(
    ['/api/evidences', searchTerm, page, pageSize],
    evidenceFetcher,
    {
      suspense: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  if (error) {
    throw error
  }

  const evidenceList = data?.data || []
  const total = data?.pagination?.total || 0

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
        return <File className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "已审核":
        return "bg-green-100 text-green-800"
      case "待审核":
        return "bg-orange-100 text-orange-800"
      case "已拒绝":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  function getFileType(fileName: string | undefined) {
    if (!fileName) return "-"
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext) return "-"
    switch (ext) {
      case "pdf": return "PDF"
      case "jpg": case "jpeg": return "图片(JPG)"
      case "png": return "图片(PNG)"
      case "mp3": return "音频(MP3)"
      case "wav": return "音频(WAV)"
      default: return ext.toUpperCase()
    }
  }

  function formatFileSize(size: number | undefined) {
    if (!size && size !== 0) return "-"
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="min-w-full text-sm align-middle">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">证据名称</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">文件类型</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">文件大小</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">关联案件</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-left">上传时间</th>
              <th className="px-4 py-3 font-medium text-gray-700 text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {evidenceList.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-400 py-8">暂无数据</td></tr>
            ) : (
              evidenceList.map((evidence) => (
                <tr key={evidence.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">{evidence.file_name || '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{getFileType(evidence.file_name)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatFileSize(evidence.file_size)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {"case" in evidence && evidence.case?.title ? evidence.case.title : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{evidence.created_at ? new Date(evidence.created_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onPreview(evidence)}>预览</Button>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => onDownload(evidence)}>下载</Button>
                    <Button variant="destructive" size="sm" onClick={() => onDelete(evidence)}>删除</Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-6">
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / pageSize) || 1}
          pageSize={pageSize}
          total={total}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          loading={false}
        />
      </div>
    </>
  )
}

export function EvidenceManagement() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const { toast } = useToast()
  const [previewEvidence, setPreviewEvidence] = useState<any | null>(null)
  const [deleteEvidence, setDeleteEvidence] = useState<any | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadCaseId, setUploadCaseId] = useState("")

  const handlePreview = (evidence: any) => {
    setPreviewEvidence(evidence)
  }

  const handleDownload = (evidence: any) => {
    if (evidence.file_url) {
      const link = document.createElement('a')
      link.href = evidence.file_url
      link.download = evidence.file_name || 'evidence'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      toast({ title: "无可用文件下载链接", variant: "destructive" })
    }
  }

  const handleDelete = (evidence: any) => {
    setDeleteEvidence(evidence)
  }

  const confirmDelete = async () => {
    if (!deleteEvidence) return
    try {
      await evidenceApi.deleteEvidence(deleteEvidence.id)
      toast({ title: "删除成功" })
      setDeleteEvidence(null)
      mutate(['/api/evidences', searchTerm, page, pageSize])
    } catch {
      toast({ title: "删除失败", variant: "destructive" })
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles(files)
      if (uploadCaseId && files.length > 0) {
        setIsUploadDialogOpen(false)
        autoUpload(files, uploadCaseId)
      }
    }
  }

  function handleCaseChange(val: string) {
    setUploadCaseId(val)
    if (selectedFiles.length > 0 && val) {
      setIsUploadDialogOpen(false)
      autoUpload(selectedFiles, val)
    }
  }

  async function autoUpload(files: File[], caseId: string) {
    if (!caseId || files.length === 0) return
    setUploading(true)
    try {
      await evidenceApi.uploadEvidences({ case_id: Number(caseId), files })
      toast({ title: "上传成功" })
      setUploadCaseId("")
      setSelectedFiles([])
      mutate(['/api/evidences', searchTerm, page, pageSize])
    } catch (e) {
      toast({ title: "上传失败", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">证据管理</h1>
          <p className="text-gray-600 mt-1">管理案件相关的所有证据材料</p>
        </div>
        <Button size="lg" className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg" onClick={() => setIsUploadDialogOpen(true)}>
          上传证据
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="搜索证据名称、案件、类型..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 使用Suspense包装数据展示 */}
      <Suspense fallback={<div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div></div>}>
        <EvidenceTableContent 
          searchTerm={searchTerm}
          page={page}
          pageSize={pageSize}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      </Suspense>

      {/* 上传证据弹窗 */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>上传新证据</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="caseSelect">关联案件 *</Label>
              <Suspense fallback={<div className="text-sm text-gray-500">加载案件...</div>}>
                <CaseSelect 
                  value={uploadCaseId} 
                  onChange={handleCaseChange} 
                />
              </Suspense>
            </div>
            <div>
              <Label htmlFor="fileUpload">上传文件 *</Label>
              <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">点击上传或拖拽文件到此处</p>
                <p className="text-sm text-gray-500">支持 PDF、JPG、PNG、MP3 等格式，最大 50MB</p>
                <Input type="file" className="hidden" id="fileUpload" multiple onChange={handleFileChange} />
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 预览弹窗 */}
      <Dialog open={!!previewEvidence} onOpenChange={v => !v && setPreviewEvidence(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>证据预览</DialogTitle>
          </DialogHeader>
          {previewEvidence && previewEvidence.file_url ? (
            previewEvidence.file_name?.toLowerCase().endsWith('.pdf') ? (
              <iframe src={previewEvidence.file_url} className="w-full h-[60vh]" />
            ) : (
              <img src={previewEvidence.file_url} alt={previewEvidence.file_name} className="max-w-full max-h-[60vh] mx-auto" />
            )
          ) : (
            <div className="text-center text-gray-400">无可用文件</div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteEvidence} onOpenChange={v => !v && setDeleteEvidence(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="py-4">确定要删除该证据"{deleteEvidence?.file_name}"吗？此操作不可恢复。</div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteEvidence(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 案件选择组件
function CaseSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const { data: caseList } = useSWR(['/api/cases'], caseFetcher, {
    suspense: true,
    revalidateOnFocus: false,
  })

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="选择关联案件" />
      </SelectTrigger>
      <SelectContent>
        {caseList?.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}