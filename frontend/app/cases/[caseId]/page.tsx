"use client"

import { EvidenceGallery } from "@/components/evidence-gallery"
import { useRouter, useParams } from "next/navigation"

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const caseId = params.caseId as string

  const numericCaseId = parseInt(caseId, 10)
  if (isNaN(numericCaseId)) {
    if (typeof window !== "undefined") {
      router.push("/cases") // 如果ID无效，返回案件列表
    }
    return null
  }

  return (
    <EvidenceGallery
      caseId={numericCaseId}
      onBack={() => router.push("/cases")} // 返回按钮导航到案件列表
    />
  )
}
