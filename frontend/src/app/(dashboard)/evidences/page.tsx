"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Eye, Upload, FileText, Download, Brain } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Evidence, EvidenceType } from "@/types";

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

  const router = useRouter();
  const queryClient = useQueryClient();

  // 获取证据列表
  const { data: evidencesData, isLoading } = useQuery({
    queryKey: ["evidences", currentPage, pageSize, selectedCaseId],
    queryFn: () =>
      apiClient.getEvidences({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        case_id: selectedCaseId,
      }),
  });

  // 获取案件列表用于筛选
  const { data: casesData } = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiClient.getCases({ skip: 0, limit: 1000 }),
  });

  // 删除证据
  const deleteEvidenceMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteEvidence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences"] });
      toast.success("证据删除成功");
    },
    onError: () => {
      toast.error("删除失败，请重试");
    },
  });

  const evidences = evidencesData?.data || [];

  // 过滤证据
  const filteredEvidences = evidences.filter((evidence: Evidence) =>
    evidence.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    const ext = extension.toLowerCase();
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

  // 获取证据类型标签
  // 修改 getEvidenceTypeLabel 函数，直接处理字符串类型
  const getEvidenceTypeLabel = (type?: string) => {
  // 后端直接返回中文字符串，无需转换
  return type || "未分类";
  };

  // 获取置信度颜色
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "secondary";
    if (confidence >= 0.8) return "default";
    if (confidence >= 0.6) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">证据管理</h1>
          <p className="text-muted-foreground">管理和查看所有证据文件</p>
        </div>
        <Button onClick={() => setIsUploadDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          上传证据
        </Button>
      </div>

      {/* 删除第137-148行的意外注释和代码 */}
      
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

      <Card>
        <CardHeader>
          <CardTitle>证据列表</CardTitle>
          <CardDescription>查看和管理所有证据文件</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索证据文件名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <select
              className="px-3 py-2 border border-input bg-background rounded-md"
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

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件</TableHead>
                    <TableHead>案件</TableHead>
                    <TableHead>分类</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvidences.map((evidence: Evidence) => (
                    <TableRow key={evidence.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getFileIcon(evidence.file_extension)}</span>
                          <div>
                            <div className="font-medium">{evidence.file_name}</div>
                            <div className="text-sm text-muted-foreground">
                              .{evidence.file_extension}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">案件 #{evidence.case_id}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {evidence.is_classified && evidence.evidence_type ? (
                            <>
                              <Badge variant={getConfidenceColor(evidence.classification_confidence)}>
                                {getEvidenceTypeLabel(evidence.evidence_type)}
                              </Badge>
                              {evidence.classification_confidence && (
                                <div className="text-xs text-muted-foreground">
                                  置信度: {(evidence.classification_confidence * 100).toFixed(1)}%
                                </div>
                              )}
                            </>
                          ) : (
                            <Badge variant="secondary">未分类</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(evidence.file_size)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {evidence.tags?.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(evidence.created_at).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/evidences/${evidence.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(evidence.file_url, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除证据文件 "{evidence.file_name}" 吗？此操作无法撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteEvidenceMutation.mutate(evidence.id)}
                                >
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 删除第306行的注释 */}
              {evidencesData?.pagination && evidencesData.pagination.pages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: evidencesData.pagination.pages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(evidencesData.pagination.pages, currentPage + 1))}
                          className={currentPage >= evidencesData.pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  
                  <div className="text-sm text-muted-foreground mt-2 text-center">
                    显示 {(currentPage - 1) * pageSize + 1} 到 {Math.min(currentPage * pageSize, evidencesData.pagination.total)} 条，共 {evidencesData.pagination.total} 条
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}