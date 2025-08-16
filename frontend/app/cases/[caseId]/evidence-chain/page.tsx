"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EvidenceChainDashboard } from "@/components/evidence-chain-dashboard"
import { caseApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import useSWR from "swr"

// 案件数据获取函数
const caseFetcher = async ([key, caseId]: [string, string]) => {
    const result = await caseApi.getCaseById(parseInt(caseId))
    return result.data
}

export default function EvidenceChainPage() {
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
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* 页面头部 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => router.push("/cases")}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">证据链分析</h1>
                        <p className="text-muted-foreground mt-1">
                            案件 #{caseData.id} - {caseData.creditor_name || '未设置债权人'}
                        </p>
                    </div>
                </div>
            </div>

            {/* 证据链分析组件 */}
            <EvidenceChainDashboard
                caseId={numericCaseId}
            />
        </div>
    )
}