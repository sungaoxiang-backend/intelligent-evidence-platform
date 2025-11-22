"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loader2, Scale, Search } from "lucide-react"
import { caseApi } from "@/lib/api"
import { cn } from "@/lib/utils"

interface Case {
  id: number
  creditor_name?: string
  debtor_name?: string
  case_type?: string
  description?: string
}

interface CaseSelectorProps {
  selectedCaseId?: number
  onSelectCase: (caseId: number) => void
  className?: string
}

export function CaseSelector({
  selectedCaseId,
  onSelectCase,
  className,
}: CaseSelectorProps) {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadCases()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCases()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const loadCases = async () => {
    setLoading(true)
    try {
      const response = await caseApi.getCases({
        page: 1,
        pageSize: 100,
        search: searchQuery || undefined,
      })
      setCases(response.data || [])
    } catch (error) {
      console.error("Failed to load cases:", error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  const getCaseDisplayName = (caseItem: Case) => {
    if (caseItem.creditor_name && caseItem.debtor_name) {
      return `${caseItem.creditor_name} vs ${caseItem.debtor_name}`
    }
    if (caseItem.description) {
      return caseItem.description
    }
    return `案件 #${caseItem.id}`
  }

  const filteredCases = cases.filter((caseItem) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const displayName = getCaseDisplayName(caseItem).toLowerCase()
    return (
      displayName.includes(query) ||
      caseItem.case_type?.toLowerCase().includes(query) ||
      caseItem.description?.toLowerCase().includes(query)
    )
  })

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          选择案件
        </CardTitle>
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索案件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? "没有找到匹配的案件" : "暂无案件"}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredCases.map((caseItem) => (
              <button
                key={caseItem.id}
                onClick={() => onSelectCase(caseItem.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  selectedCaseId === caseItem.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                )}
              >
                <div className="font-medium">{getCaseDisplayName(caseItem)}</div>
                {caseItem.case_type && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {caseItem.case_type}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

