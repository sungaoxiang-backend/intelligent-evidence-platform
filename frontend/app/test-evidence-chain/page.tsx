"use client"

import { EvidenceChainDashboard } from "@/components/evidence-chain-dashboard"
import { EvidenceChainDemo } from "@/components/evidence-chain-demo"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function TestEvidenceChainPage() {
  const router = useRouter()
  const [showDemo, setShowDemo] = useState(false)

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">证据链功能测试</h1>
        <div className="flex gap-2">
          <Button
            variant={showDemo ? "outline" : "default"}
            onClick={() => setShowDemo(false)}
          >
            看板视图
          </Button>
          <Button
            variant={showDemo ? "default" : "outline"}
            onClick={() => setShowDemo(true)}
          >
            API测试
          </Button>
        </div>
      </div>

      {showDemo ? (
        <EvidenceChainDemo />
      ) : (
        <EvidenceChainDashboard
          caseId={1} // 测试用案件ID
          onBack={() => router.push("/cases")}
        />
      )}
    </div>
  )
}