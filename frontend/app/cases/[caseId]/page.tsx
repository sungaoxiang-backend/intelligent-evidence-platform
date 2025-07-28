"use client"

import { EvidenceGallery } from "@/components/evidence-gallery"
import { EvidenceReasoning } from "@/components/evidence-reasoning"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"

export default function CaseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const caseId = params.caseId as string
  
  // 从 URL 参数或 localStorage 获取当前标签页
  const getInitialTab = (): 'evidence' | 'reasoning' => {
    // 优先从 URL 参数获取
    const tabFromUrl = searchParams.get('tab') as 'evidence' | 'reasoning'
    if (tabFromUrl && ['evidence', 'reasoning'].includes(tabFromUrl)) {
      return tabFromUrl
    }
    
    // 从 localStorage 获取
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem(`case-${caseId}-tab`) as 'evidence' | 'reasoning'
      if (savedTab && ['evidence', 'reasoning'].includes(savedTab)) {
        return savedTab
      }
    }
    
    return 'evidence'
  }
  
  const [activeTab, setActiveTab] = useState<'evidence' | 'reasoning'>(getInitialTab)

  // 监听 URL 参数变化
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as 'evidence' | 'reasoning'
    if (tabFromUrl && ['evidence', 'reasoning'].includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
      localStorage.setItem(`case-${caseId}-tab`, tabFromUrl)
    }
  }, [searchParams, activeTab, caseId])

  const numericCaseId = parseInt(caseId, 10)
  if (isNaN(numericCaseId)) {
    if (typeof window !== "undefined") {
      router.push("/cases") // 如果ID无效，返回案件列表
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* 标签页导航 */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        <button
          onClick={() => {
            setActiveTab('evidence')
            // 保存到 localStorage
            localStorage.setItem(`case-${caseId}-tab`, 'evidence')
            // 更新 URL 参数
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.set('tab', 'evidence')
            router.replace(newUrl.pathname + newUrl.search)
          }}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'evidence'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          证据管理
        </button>
        <button
          onClick={() => {
            setActiveTab('reasoning')
            // 保存到 localStorage
            localStorage.setItem(`case-${caseId}-tab`, 'reasoning')
            // 更新 URL 参数
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.set('tab', 'reasoning')
            router.replace(newUrl.pathname + newUrl.search)
          }}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'reasoning'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          证据推理
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'evidence' ? (
        <EvidenceGallery
          caseId={numericCaseId}
          onBack={() => router.push("/cases")}
        />
      ) : (
        <EvidenceReasoning
          caseId={numericCaseId}
          onBack={() => router.push("/cases")}
        />
      )}
    </div>
  )
}
