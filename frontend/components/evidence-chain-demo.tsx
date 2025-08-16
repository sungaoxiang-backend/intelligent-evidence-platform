"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { evidenceChainAPI } from "@/lib/evidence-chain-api"

export function EvidenceChainDemo() {
  const [caseId, setCaseId] = useState("1")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await evidenceChainAPI.getCaseEvidenceChainDashboard(parseInt(caseId))
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  const testTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await evidenceChainAPI.getEvidenceChainTemplates()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-6 bg-white rounded-lg border">
      <h2 className="text-lg font-semibold">证据链API测试</h2>
      
      <div className="flex gap-2 items-center">
        <Input
          type="number"
          placeholder="案件ID"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="w-32"
        />
        <Button onClick={testDashboard} disabled={loading}>
          测试看板API
        </Button>
        <Button onClick={testTemplates} disabled={loading} variant="outline">
          测试模板API
        </Button>
      </div>

      {loading && (
        <div className="text-blue-600">请求中...</div>
      )}

      {error && (
        <div className="text-red-600 bg-red-50 p-3 rounded">
          错误: {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-50 p-4 rounded">
          <h3 className="font-medium mb-2">API响应:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}