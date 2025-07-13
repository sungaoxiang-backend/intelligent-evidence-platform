"use client";

import { Evidence } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { getFileIcon, isImageFile } from "@/lib/utils";

interface FilePreviewProps {
  evidence: Evidence;
  onDownload?: () => void;
}

export function FilePreview({ evidence, onDownload }: FilePreviewProps) {
  const isImage = isImageFile(evidence.file_extension);
  const fileIcon = getFileIcon(evidence.file_extension);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <span className="text-2xl">{fileIcon}</span>
            <span>{evidence.file_name}</span>
          </CardTitle>
          <div className="flex space-x-2">
            {onDownload && (
              <Button onClick={onDownload} size="sm">
                <Download className="h-4 w-4 mr-2" />
                下载
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(evidence.file_url, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              在新窗口打开
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 文件预览区域 */}
          <div className="border rounded-lg p-4 min-h-[400px] flex items-center justify-center bg-muted/50">
            {isImage ? (
              <img
                src={evidence.file_url}
                alt={evidence.file_name}
                className="max-w-full max-h-[400px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  target.nextElementSibling?.classList.remove("hidden");
                }}
              />
            ) : (
              <div className="text-center space-y-4">
                <div className="text-6xl">{fileIcon}</div>
                <div className="space-y-2">
                  <p className="text-lg font-medium">{evidence.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {evidence.file_extension.toUpperCase()} 文件
                  </p>
                  <p className="text-sm text-muted-foreground">
                    点击上方按钮下载或在新窗口中查看
                  </p>
                </div>
              </div>
            )}
            {/* 图片加载失败时的备用显示 */}
            {isImage && (
              <div className="hidden text-center space-y-4">
                <div className="text-6xl">{fileIcon}</div>
                <div className="space-y-2">
                  <p className="text-lg font-medium">{evidence.file_name}</p>
                  <p className="text-sm text-muted-foreground">
                    图片预览失败，点击上方按钮查看原文件
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}