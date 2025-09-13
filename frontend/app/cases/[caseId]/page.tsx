import { CaseDetailClient } from "@/components/case-detail-client"
import { ErrorBoundaryWrapper } from "@/components/error-boundary"

interface CaseDetailPageProps {
  params: {
    caseId: string
  }
}

export default function CaseDetailPage({ params }: CaseDetailPageProps) {
  const { caseId } = params

  // 验证caseId是否为有效数字
  const numericCaseId = parseInt(caseId, 10)
  if (isNaN(numericCaseId)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            无效的案件ID
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            请检查URL中的案件ID是否正确
          </p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundaryWrapper>
      <CaseDetailClient caseId={caseId} />
    </ErrorBoundaryWrapper>
  )
}
