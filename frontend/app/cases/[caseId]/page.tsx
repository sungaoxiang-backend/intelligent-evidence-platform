"use client"

import { EvidenceGallery } from "@/components/evidence-gallery"
import { EvidenceReasoning } from "@/components/evidence-reasoning"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { FileText, Network } from "lucide-react"
import { mutate } from "swr"

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
      <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg border border-border/50">
        <button
          onClick={() => {
            setActiveTab('evidence')
            // 保存到 localStorage
            localStorage.setItem(`case-${caseId}-tab`, 'evidence')
            // 更新 URL 参数
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.set('tab', 'evidence')
            router.push(newUrl.pathname + newUrl.search)
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'evidence'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className={`w-4 h-4 ${activeTab === 'evidence' ? 'text-blue-600' : 'text-muted-foreground'}`} />
            独立证据分析
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('reasoning')
            // 保存到 localStorage
            localStorage.setItem(`case-${caseId}-tab`, 'reasoning')
            // 更新 URL 参数
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.set('tab', 'reasoning')
            router.push(newUrl.pathname + newUrl.search)
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
            activeTab === 'reasoning'
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Network className={`w-4 h-4 ${activeTab === 'reasoning' ? 'text-purple-600' : 'text-muted-foreground'}`} />
            联合证据分析
          </div>
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'evidence' ? (
        <EvidenceGallery
          caseId={numericCaseId}
          onBack={async () => {
            try {
              // 强制刷新案件列表数据，等待完成
              await mutate("/cases", undefined, { revalidate: true });
              // 数据刷新完成后跳转到案件列表页面
              router.push("/cases");
            } catch (error) {
              console.error("刷新案件列表失败:", error);
              // 即使刷新失败也要跳转
              router.push("/cases");
            }
          }}
          onGoToCaseDetail={() => router.push(`/cases/${caseId}/detail`)}
          initialSelectedEvidenceId={searchParams.get('evidence') ? parseInt(searchParams.get('evidence')!) : undefined}
        />
      ) : (
        <EvidenceReasoning
          caseId={numericCaseId}
          onBack={async () => {
            try {
              // 强制刷新案件列表数据，等待完成
              await mutate("/cases", undefined, { revalidate: true });
              // 数据刷新完成后跳转到案件列表页面
              router.push("/cases");
            } catch (error) {
              console.error("刷新案件列表失败:", error);
              // 即使刷新失败也要跳转
              router.push("/cases");
            }
          }}
          onGoToCaseDetail={() => router.push(`/cases/${caseId}/detail`)}
          initialSelectedGroup={searchParams.get('group') || undefined}
        />
      )}
    </div>
  )
}
