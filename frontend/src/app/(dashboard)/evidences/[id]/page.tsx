"use client";

import { apiClient } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EvidenceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const evidenceId = parseInt(params.id as string);

  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['evidence', evidenceId],
    queryFn: () => apiClient.getEvidence(evidenceId),
    enabled: !!evidenceId, // 只有当 evidenceId 存在时才执行查询
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">加载中...</div>;
  }

  if (!evidenceData?.data) {
    return <div className="flex justify-center items-center h-64">证据不存在或加载失败</div>;
  }

  const evidence = evidenceData.data;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push('/evidences')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回证据列表
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Paperclip className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle className="text-2xl">{evidence.file_name}</CardTitle>
              <CardDescription>上传于 {new Date(evidence.created_at).toLocaleString()}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">所属案件</p>
              <p>{evidence.case_title || '未关联'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">文件大小</p>
              <p>{formatFileSize(evidence.file_size)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">文件类型</p>
              <p>{evidence.file_type}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">证据分类</p>
              <p><Badge variant="outline">{evidence.evidence_type || '未分类'}</Badge></p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">智能识别标签</p>
              <p>{evidence.classification ? <Badge>{evidence.classification}</Badge> : '无'}</p>
            </div>
            {evidence.confidence && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">置信度</p>
                <p>{(evidence.confidence * 100).toFixed(2)}%</p>
              </div>
            )}
          </div>

          {evidence.file_url && (
            <div className="pt-6">
              <h3 className="text-lg font-semibold mb-4">文件预览</h3>
              <div className="rounded-md border bg-muted p-4 flex justify-center items-center min-h-[400px]">
                {evidence.file_type && evidence.file_type.startsWith('image/') ? (
                  <img src={evidence.file_url} alt={evidence.file_name} className="max-w-full max-h-[600px] rounded-md" />
                ) : (
                  <p className="text-muted-foreground">此文件类型不支持预览。请下载文件查看。</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6">
            <a href={evidence.file_url} download target="_blank" rel="noopener noreferrer">
              <Button>
                <Download className="mr-2 h-4 w-4" />
                下载文件
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}