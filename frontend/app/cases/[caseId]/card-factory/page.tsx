"use client"

import { useRouter, useParams } from "next/navigation"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardFactory } from "@/components/card-factory"
import { caseApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import useSWR from "swr"

// 案件数据获取函数
const caseFetcher = async ([key, caseId]: [string, string]) => {
  const result = await caseApi.getCaseById(parseInt(caseId))
  return result.data
}

export default function CardFactoryPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const caseId = params.caseId as string
  const numericCaseId = parseInt(caseId, 10)

  // 获取案件数据
  const { data: caseData, error: caseError } = useSWR(
    ['case', caseId],
    caseFetcher
  )

  if (isNaN(numericCaseId)) {
    router.push("/cases")
    return null
  }

  if (caseError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 mb-2">加载案件数据失败</div>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </div>
        </div>
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <div className="text-muted-foreground">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-3 space-y-4">
      {/* 页面头部 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">卡片工厂</h1>
        </div>
        <div className="flex gap-3 items-center">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-lg" 
            onClick={() => {
              // 调用 CardFactory 组件的上传对话框
              if ((window as any).__cardFactoryOpenUpload) {
                (window as any).__cardFactoryOpenUpload()
              }
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            上传证据
          </Button>
          <Button variant="outline" onClick={() => router.push("/cases")}>
            返回案件列表
          </Button>
        </div>
      </div>

      {/* 卡片工厂组件 */}
      <CardFactory
        caseId={numericCaseId}
        onBack={() => router.push("/cases")}
        onGoToCaseDetail={() => router.push(`/cases/${caseId}/detail`)}
        caseData={caseData}
      />
    </div>
  )
}
