"use client";

import { useRouter } from "next/navigation";
import { BatchUploadWithClassification } from "@/components/evidences/batch-upload-with-classification";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Evidence } from "@/types";

export default function BatchUploadPage() {
  const router = useRouter();

  const handleUploadComplete = (evidences: Evidence[]) => {
    // 上传完成后跳转到证据列表
    setTimeout(() => {
      router.push("/evidences");
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">上传证据</h1>
          <p className="text-muted-foreground">批量上传证据文件并进行AI智能分类</p>
        </div>
      </div>

      <BatchUploadWithClassification onUploadComplete={handleUploadComplete} />
    </div>
  );
}