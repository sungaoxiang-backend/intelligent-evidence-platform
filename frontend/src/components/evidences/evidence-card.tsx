"use client";

import { Evidence } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download, Edit, Trash2, FileText } from "lucide-react";
import { formatFileSize, getFileIcon } from "@/lib/utils";

interface EvidenceCardProps {
  evidence: Evidence;
  onView?: (evidence: Evidence) => void;
  onEdit?: (evidence: Evidence) => void;
  onDelete?: (evidence: Evidence) => void;
  onDownload?: (evidence: Evidence) => void;
}

export function EvidenceCard({
  evidence,
  onView,
  onEdit,
  onDelete,
  onDownload,
}: EvidenceCardProps) {
  const fileIcon = getFileIcon(evidence.file_extension);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{fileIcon}</span>
            <CardTitle className="text-sm font-medium truncate">
              {evidence.file_name}
            </CardTitle>
          </div>
          <div className="flex space-x-1">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(evidence)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(evidence)}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(evidence)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(evidence)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>大小</span>
            <span>{formatFileSize(evidence.file_size)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>类型</span>
            <span>{evidence.file_extension.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>上传时间</span>
            <span>{new Date(evidence.created_at).toLocaleDateString()}</span>
          </div>
          {evidence.tags && evidence.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {evidence.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}