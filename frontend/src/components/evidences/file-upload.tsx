"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText } from "lucide-react";
import { formatFileSize, getFileIcon } from "@/lib/utils";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: string[];
  disabled?: boolean;
}

interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedFileTypes = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif"],
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((file) => {
        const fileWithPreview = Object.assign(file, {
          preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          id: Math.random().toString(36).substr(2, 9),
        }) as FileWithPreview;
        return fileWithPreview;
      });

      const updatedFiles = [...files, ...newFiles].slice(0, maxFiles);
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    },
    [files, maxFiles, onFilesSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes.reduce((acc, type) => {
      acc[type] = [];
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    disabled,
  });

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter((file) => file.id !== fileId);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  return (
    <div className="space-y-4">
      {/* 拖拽上传区域 */}
      <Card>
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                {isDragActive ? "放下文件以上传" : "拖拽文件到此处或点击选择"}
              </p>
              <p className="text-sm text-muted-foreground">
                支持 {acceptedFileTypes.join(", ")} 格式，最大 {formatFileSize(maxSize)}
              </p>
              <p className="text-sm text-muted-foreground">
                最多可上传 {maxFiles} 个文件
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 文件列表 */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>已选择的文件 ({files.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((file) => {
                const fileIcon = getFileIcon(file.name.split(".").pop() || "");
                const progress = uploadProgress[file.id] || 0;

                return (
                  <div
                    key={file.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <div className="text-2xl">{fileIcon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                      {progress > 0 && progress < 100 && (
                        <Progress value={progress} className="mt-1" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      disabled={disabled}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}