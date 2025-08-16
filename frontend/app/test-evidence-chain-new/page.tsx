"use client"

import { useState } from "react"
import { EvidenceChainDashboard } from "@/components/evidence-chain-dashboard"

export default function TestEvidenceChainNewPage() {
  const [showDashboard, setShowDashboard] = useState(false)
  const [caseId, setCaseId] = useState(1)

  if (showDashboard) {
    return (
      <EvidenceChainDashboard
        caseId={caseId}
        onBack={() => setShowDashboard(false)}
      />
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">测试新版证据链组件</h1>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="caseId" className="block text-sm font-medium text-gray-700 mb-2">
              案件ID
            </label>
            <input
              type="number"
              id="caseId"
              value={caseId}
              onChange={(e) => setCaseId(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>
          
          <button
            onClick={() => setShowDashboard(true)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            查看证据链看板
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-md">
          <h2 className="text-sm font-medium text-gray-900 mb-2">新功能特性:</h2>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 上下排列的紧凑布局</li>
            <li>• 核心证据 vs 非核心证据区分</li>
            <li>• 可展开/收起的详细信息</li>
            <li>• 核心证据用★标识</li>
            <li>• 非核心证据可选择显示/隐藏</li>
            <li>• 基于核心证据的进度计算</li>
          </ul>
        </div>
      </div>
    </div>
  )
}