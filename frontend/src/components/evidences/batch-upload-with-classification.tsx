"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "./file-upload";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Evidence, EvidenceType } from "@/types";
import { Brain, Upload, CheckCircle, AlertCircle } from "lucide-react";

interface BatchUploadWithClassificationProps {
  onUploadComplete?: (evidences: Evidence[]) => void;
}

export function BatchUploadWithClassification({ onUploadComplete }: BatchUploadWithClassificationProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number>();
  const [tags, setTags] = useState<string>("");
  const [enableClassification, setEnableClassification] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<Evidence[]>([]);

  // 获取案件列表
  const { data: casesData } = useQuery({
    queryKey: ["cases"],
    queryFn: () => apiClient.getCases({ skip: 0, limit: 1000 }),
  });

  // 批量上传mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ files, caseId, tags, withClassification }: {
      files: File[];
      caseId: number;
      tags?: string[];
      withClassification: boolean;
    }) => {
      if (withClassification) {
        return apiClient.batchCreateEvidencesWithClassification(files, caseId, tags);
      } else {
        return apiClient.batchCreateEvidences(files, caseId, tags);
      }
    },
    onSuccess: (data) => {
      setUploadResults(data.data || []);
      toast.success(`成功上传 ${data.data?.length || 0} 个文件`);
      onUploadComplete?.(data.data || []);
      setIsUploading(false);
      setUploadProgress(100);
    },
    onError: (error) => {
      console.error("Upload failed:", error);
      toast.error("上传失败，请重试");
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  const handleUpload = async () => {
    if (!selectedCaseId) {
      toast.error("请选择案件");
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("请选择要上传的文件");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 500);

    const tagsArray = tags.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);

    uploadMutation.mutate({
      files: selectedFiles,
      caseId: selectedCaseId,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      withClassification: enableClassification,
    });
  };

  const getEvidenceTypeLabel = (type?: EvidenceType) => {
    const labels: Record<EvidenceType, string> = {
      [EvidenceType.WECHAT_CHAT]: "微信聊天记录",
      [EvidenceType.ALIPAY_TRANSFER]: "支付宝转账",
      [EvidenceType.IOU]: "借条",
      [EvidenceType.CONTRACT]: "合同",
      [EvidenceType.BANK_STATEMENT]: "银行流水",
      [EvidenceType.INVOICE]: "发票",
      [EvidenceType.RECEIPT]: "收据",
      [EvidenceType.ID_CARD]: "身份证",
      [EvidenceType.BUSINESS_LICENSE]: "营业执照",
      [EvidenceType.COURT_DOCUMENT]: "法院文件",
      [EvidenceType.OTHER]: "其他",
    };
    return type ? labels[type] : "未分类";
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "secondary";
    if (confidence >= 0.8) return "default";
    if (confidence >= 0.6) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      {/* 上传配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传证据文件
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 案件选择 */}
          <div className="space-y-2">
            <Label>选择案件</Label>
            <Select value={selectedCaseId?.toString()} onValueChange={(value) => setSelectedCaseId(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="请选择案件" />
              </SelectTrigger>
              <SelectContent>
                {casesData?.data?.map((case_: any) => (
                  <SelectItem key={case_.id} value={case_.id.toString()}>
                    {case_.title} (#{case_.case_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标签输入 */}
          <div className="space-y-2">
            <Label>标签（可选）</Label>
            <Input
              placeholder="输入标签，用逗号分隔"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* AI分类开关 */}
          <div className="flex items-center space-x-2">
            <Switch
              id="classification"
              checked={enableClassification}
              onCheckedChange={setEnableClassification}
            />
            <Label htmlFor="classification" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              启用AI智能分类
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* 文件上传 */}
      <FileUpload
        onFilesSelected={setSelectedFiles}
        disabled={isUploading}
        maxFiles={20}
      />

      {/* 上传按钮和进度 */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Button
                onClick={handleUpload}
                disabled={isUploading || !selectedCaseId}
                className="w-full"
                size="lg"
              >
                {isUploading ? "上传中..." : `上传 ${selectedFiles.length} 个文件`}
                {enableClassification && !isUploading && (
                  <Brain className="ml-2 h-4 w-4" />
                )}
              </Button>

              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    {enableClassification ? "正在上传并分析文件..." : "正在上传文件..."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 上传结果 */}
      {uploadResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              上传完成
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadResults.map((evidence) => (
                <div key={evidence.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{evidence.file_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {evidence.is_classified && evidence.evidence_type && (
                        <>
                          <Badge variant={getConfidenceColor(evidence.classification_confidence)}>
                            {getEvidenceTypeLabel(evidence.evidence_type)}
                          </Badge>
                          {evidence.classification_confidence && (
                            <span className="text-xs text-muted-foreground">
                              置信度: {(evidence.classification_confidence * 100).toFixed(1)}%
                            </span>
                          )}
                        </>
                      )}
                      {!evidence.is_classified && enableClassification && (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          分类失败
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}