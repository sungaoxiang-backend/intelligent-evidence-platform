"use client";

import { EvidenceGallery } from "@/components/evidences/evidence-gallery";

export default function EvidenceClassifyPage() {
  const handleFilesClassified = (results: any[]) => {
    console.log('分类结果:', results);
    // 这里可以处理分类结果，比如保存到数据库
  };

  return (
    <div className="h-screen">
      <EvidenceGallery onFilesClassified={handleFilesClassified} />
    </div>
  );
}