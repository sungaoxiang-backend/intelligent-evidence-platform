"use client";

import { useRouter } from "next/navigation";
import { CaseForm } from "@/components/cases/case-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewCasePage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push("/cases");
  };

  const handleCancel = () => {
    router.push("/cases");
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/cases")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回案件列表
        </Button>
      </div>
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight">创建新案件</h1>
        <p className="text-muted-foreground">填写案件的详细信息</p>
      </div>

      {/* 案件表单 */}
      <div className="max-w-4xl">
        <CaseForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}