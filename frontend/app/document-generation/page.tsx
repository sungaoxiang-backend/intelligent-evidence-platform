"use client"

import { Suspense } from "react"
import { DocumentGenerationPage } from "@/components/document-generation/document-generation-page"

export default function Page() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6">加载中...</div>}>
      <DocumentGenerationPage />
    </Suspense>
  )
}

