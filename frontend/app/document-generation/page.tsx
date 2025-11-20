"use client"

import { DocumentGenerationPage } from "@/components/document-generation"
import { useSearchParams } from "next/navigation"

/**
 * 文书生成页面路由
 * 路径: /document-generation
 * 
 * 支持 URL 参数:
 * - caseId: 初始选中的案件ID
 * - templateId: 初始选中的模板ID
 */
export default function DocumentGenerationRoute() {
  const searchParams = useSearchParams()
  
  // 从 URL 参数获取初始值
  const initialCaseId = searchParams.get("caseId") 
    ? Number(searchParams.get("caseId")) 
    : undefined
  
  const initialTemplateId = searchParams.get("templateId")
    ? Number(searchParams.get("templateId"))
    : undefined

  return (
    <DocumentGenerationPage
      initialCaseId={initialCaseId}
      initialTemplateId={initialTemplateId}
    />
  )
}

