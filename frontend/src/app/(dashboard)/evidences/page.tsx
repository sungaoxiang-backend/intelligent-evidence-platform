"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Upload, FileText, Download, Paperclip, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Evidence, EvidenceWithCase } from "@/types";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { BatchUploadWithClassification } from "@/components/evidences/batch-upload-with-classification";

export default function EvidencesPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<number | undefined>();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceWithCase | null>(null);

  const queryClient = useQueryClient();

  // 获取证据列表
  const { data: evidencesData, isLoading } = useQuery({
    queryKey: ["evidences", currentPage, pageSize, selectedCaseId, searchTerm],
    queryFn: () =>
      apiClient.getEvidences({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        case_id: selectedCaseId,
        search: searchTerm,
      }),
  });

  // 获取案件列表用于筛选
  const { data: casesData } = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiClient.getCases({ skip: 0, limit: 1000 }),
  });

  const evidences = evidencesData?.data || [];
  const totalEvidences = evidencesData?.total || 0;
  const totalPages = Math.ceil(totalEvidences / pageSize);

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 获取文件类型图标
  const getFileIcon = (extension: string) => {
    const ext = extension?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
      return "🖼️";
    } else if (["pdf"].includes(ext)) {
      return "📄";
    } else if (["doc", "docx"].includes(ext)) {
      return "📝";
    } else if (["xls", "xlsx"].includes(ext)) {
      return "📊";
    } else if (["mp4", "avi", "mov"].includes(ext)) {
      return "🎥";
    } else if (["mp3", "wav", "m4a"].includes(ext)) {
      return "🎵";
    }
    return "📎";
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">证据管理</h1>
          <p className="text-muted-foreground">浏览、预览和标注您的证据文件</p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          上传证据
        </Button>
      </div>

      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>上传证据</DialogTitle>
          </DialogHeader>
          <BatchUploadWithClassification 
            onUploadComplete={(evidences) => {
              setIsUploadDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["evidences"] });
              toast.success(`成功上传 ${evidences.length} 个证据文件`);
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 h-0">
        {/* Left Panel: Thumbnail List */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>文件列表</CardTitle>
              <div className="flex items-center space-x-2 pt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索文件名..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <select
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                  value={selectedCaseId || ""}
                  onChange={(e) => setSelectedCaseId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">所有案件</option>
                  {casesData?.data?.map((case_: any) => (
                    <option key={case_.id} value={case_.id}>
                      {case_.title}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">加载中...</p>
                </div>
              ) : evidences.length > 0 ? (
                evidences.map((evidence) => (
                  <div
                    key={evidence.id}
                    className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer border ${selectedEvidence?.id === evidence.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedEvidence(evidence)}
                  >
                    <div className="text-2xl">
                      {['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(evidence.file_extension?.toLowerCase()) ? (
                        <img src={evidence.file_url} alt={evidence.file_name} className="w-10 h-10 object-cover rounded-md bg-slate-200" />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-slate-200 rounded-md">
                          {getFileIcon(evidence.file_extension)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 truncate">{evidence.file_name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">未找到证据</p>
                </div>
              )}
            </CardContent>
            {totalPages > 1 && (
              <div className="p-4 border-t">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }} disabled={currentPage === 1} />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-4 py-2 text-sm">{currentPage} / {totalPages}</span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }} disabled={currentPage === totalPages} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </Card>
        </div>

        {/* Middle Panel: Preview */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>文件预览</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              {selectedEvidence ? (
                (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(selectedEvidence.file_extension?.toLowerCase())) ? (
                  <img src={selectedEvidence.file_url} alt={selectedEvidence.file_name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12" />
                    <p className="mt-2">此文件类型不支持预览。</p>
                  </div>
                )
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>请从左侧选择一个文件进行预览</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Details */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>数据标注</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {selectedEvidence ? (
                <div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold">文件名:</span>
                      <span className="text-right truncate">{selectedEvidence.file_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">所属案件:</span>
                      <span className="text-right truncate">{selectedEvidence.case?.title || '未关联'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">文件大小:</span>
                      <span>{formatFileSize(selectedEvidence.file_size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">上传时间:</span>
                      <span>{new Date(selectedEvidence.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="font-semibold mb-2">智能识别结果</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-semibold">证据分类:</span>
                        <Badge variant={selectedEvidence.evidence_type ? 'default' : 'secondary'}>
                          {selectedEvidence.evidence_type || '未分类'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">识别标签:</span>
                        <span className="text-right">无</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="font-semibold mb-2">分析摘要</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvidence.classification_reasoning || '暂无分析摘要。'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground pt-10">
                  <p>请选择一个文件查看详情</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}