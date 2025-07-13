"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Edit, Trash2, Tag, Calendar, User, FileText, Brain } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { EvidenceType } from "@/types";

export default function EvidenceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const evidenceId = parseInt(params.id as string);
  const queryClient = useQueryClient();

  // 获取证据详情
  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ["evidence", evidenceId],
    queryFn: () => apiClient.getEvidence(evidenceId),
  });

  // 获取证据详情（包含案件信息）
  const { data: evidenceWithCaseData } = useQuery({
    queryKey: ["evidence-with-case", evidenceId],
    queryFn: () => apiClient.getEvidenceWithCase(evidenceId),
  });

  // 删除证据
  const deleteEvidenceMutation = useMutation({
    mutationFn: () => apiClient.deleteEvidence(evidenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidences"] });
      toast.success("证据删除成功");
      router.push("/evidences");
    },
    onError: () => {
      toast.error("删除失败，请重试");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  const evidence = evidenceData?.data;
  const evidenceWithCase = evidenceWithCaseData?.data;

  if (!evidence) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">证据不存在</div>
      </div>
    );
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // 获取文件类型
  const getFileType = (extension: string) => {
    const ext = extension.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp"].includes(ext)) {
      return "图片";
    } else if (["pdf"].includes(ext)) {
      return "PDF文档";
    } else if (["doc", "docx"].includes(ext)) {
      return "Word文档";
    } else if (["xls", "xlsx"].includes(ext)) {
      return "Excel表格";
    } else if (["mp4", "avi", "mov"].includes(ext)) {
      return "视频";
    } else if (["mp3", "wav", "m4a"].includes(ext)) {
      return "音频";
    }
    return "文件";
  };

  // 判断是否为图片
  const isImage = (extension: string) => {
    const ext = extension.toLowerCase();
    return ["jpg", "jpeg", "png", "gif", "bmp"].includes(ext);
  };

  // 获取证据类型标签 - 简化版本
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{evidence.file_name}</h1>
            <p className="text-muted-foreground">证据详情</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => window.open(evidence.file_url, "_blank")}
          >
            <Download className="mr-2 h-4 w-4" />
            下载
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                删除
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
                  onClick={() => deleteEvidenceMutation.mutate()}
                >
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 文件预览 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>文件预览</CardTitle>
            </CardHeader>
            <CardContent>
              {isImage(evidence.file_extension) ? (
                <div className="flex justify-center">
                  <img
                    src={evidence.file_url}
                    alt={evidence.file_name}
                    className="max-w-full max-h-96 object-contain rounded-lg border"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">{getFileType(evidence.file_extension)}</p>
                  <p className="text-sm text-muted-foreground">{evidence.file_name}</p>
                  <Button
                    className="mt-4"
                    onClick={() => window.open(evidence.file_url, "_blank")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    下载查看
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 证据信息 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>证据信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">文件名</span>
                </div>
                <p className="text-sm">{evidence.file_name}</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">文件类型</span>
                </div>
                <p className="text-sm">{getFileType(evidence.file_extension)} (.{evidence.file_extension})</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">文件大小</span>
                </div>
                <p className="text-sm">{formatFileSize(evidence.file_size)}</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">上传时间</span>
                </div>
                <p className="text-sm">
                  {new Date(evidence.created_at).toLocaleString("zh-CN")}
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">上传者</span>
                </div>
                <p className="text-sm">员工 #{evidence.uploaded_by_id}</p>
              </div>

              <Separator />

              {/* 添加AI分类信息 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">AI分类结果</span>
                </div>
                {evidence.is_classified && evidence.evidence_type ? (
                  <div className="space-y-2">
                    <Badge variant={getConfidenceColor(evidence.classification_confidence)}>
                      {getEvidenceTypeLabel(evidence.evidence_type)}
                    </Badge>
                    {evidence.classification_confidence && (
                      <p className="text-xs text-muted-foreground">
                        置信度: {(evidence.classification_confidence * 100).toFixed(1)}%
                      </p>
                    )}
                    {evidence.classification_reasoning && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">分类理由:</p>
                        <p className="bg-muted p-2 rounded text-xs">
                          {evidence.classification_reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge variant="secondary">未分类</Badge>
                )}
              </div>

              {evidence.tags && evidence.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">标签</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {evidence.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 关联案件信息 */}
          {evidenceWithCase?.case && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>关联案件</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{evidenceWithCase.case.title}</p>
                  <p className="text-sm text-muted-foreground">
                    案件编号: {evidenceWithCase.case.case_number}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/cases/${evidenceWithCase.case.id}`)}
                  >
                    查看案件详情
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}