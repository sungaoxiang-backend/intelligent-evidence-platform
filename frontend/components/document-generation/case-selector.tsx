"use client"

import React, { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { caseApi } from "@/lib/api"
import type { Case } from "@/lib/types"

export interface CaseSelectorProps {
  selectedCaseId?: number
  onSelect: (caseItem: Case | null) => void
  className?: string
}

/**
 * 案件选择器组件
 * 支持搜索、下拉选择和显示选中案件的详细信息
 */
export function CaseSelector({
  selectedCaseId,
  onSelect,
  className = "",
}: CaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)

  // 加载案件列表
  const loadCases = async (search = "") => {
    try {
      setLoading(true)
      const result = await caseApi.getCases({
        page: 1,
        pageSize: 50,
        search,
      })
      setCases(result.data || [])
    } catch (error) {
      console.error("加载案件列表失败:", error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    loadCases()
  }, [])

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadCases(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // 加载选中的案件详情
  useEffect(() => {
    if (selectedCaseId) {
      const found = cases.find((c) => c.id === selectedCaseId)
      if (found) {
        setSelectedCase(found)
      } else {
        // 如果当前列表中找不到，尝试单独加载
        caseApi.getCaseById(selectedCaseId).then((result) => {
          if (result?.data) {
            setSelectedCase(result.data)
          }
        }).catch((error) => {
          console.error("加载案件详情失败:", error)
        })
      }
    } else {
      setSelectedCase(null)
    }
  }, [selectedCaseId, cases])

  const handleSelect = (caseItem: Case) => {
    setSelectedCase(caseItem)
    onSelect(caseItem)
    setOpen(false)
  }

  const handleClear = () => {
    setSelectedCase(null)
    onSelect(null)
  }

  return (
    <div className={className}>
      {/* 案件选择器 */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedCase ? (
              <span className="truncate">
                {selectedCase.description || `案件 #${selectedCase.id}`}
              </span>
            ) : (
              "选择案件..."
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索案件..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
              ) : (
                <>
                  <CommandEmpty>未找到案件。</CommandEmpty>
                  <CommandGroup>
                    {cases.map((caseItem) => (
                      <CommandItem
                        key={caseItem.id}
                        value={String(caseItem.id)}
                        onSelect={() => handleSelect(caseItem)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCase?.id === caseItem.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col flex-1">
                          <span className="font-medium">
                            {caseItem.description || `案件 #${caseItem.id}`}
                          </span>
                          {caseItem.loan_amount && (
                            <span className="text-xs text-muted-foreground">
                              借款金额: ¥{caseItem.loan_amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 选中案件的详细信息卡片 */}
      {selectedCase && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {selectedCase.description || `案件 #${selectedCase.id}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    {selectedCase.case_type && (
                      <Badge variant="secondary">
                        {selectedCase.case_type}
                      </Badge>
                    )}
                    {selectedCase.case_status && (
                      <Badge variant="outline">
                        {selectedCase.case_status}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                >
                  清除
                </Button>
              </div>

              {/* 案件详细信息 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedCase.loan_amount && (
                  <div>
                    <span className="text-muted-foreground">借款金额：</span>
                    <span className="font-medium">
                      ¥{selectedCase.loan_amount.toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedCase.loan_date && (
                  <div>
                    <span className="text-muted-foreground">借款日期：</span>
                    <span className="font-medium">
                      {new Date(selectedCase.loan_date).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                )}
                {selectedCase.court_name && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">法院：</span>
                    <span className="font-medium">{selectedCase.court_name}</span>
                  </div>
                )}
              </div>

              {/* 当事人信息 */}
              {selectedCase.case_parties && selectedCase.case_parties.length > 0 && (
                <div className="pt-2 border-t">
                  <h4 className="text-sm font-medium mb-2">当事人</h4>
                  <div className="space-y-2">
                    {selectedCase.case_parties.slice(0, 3).map((party) => (
                      <div key={party.id} className="text-sm flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {party.party_role}
                        </Badge>
                        <span className="truncate">{party.party_name}</span>
                      </div>
                    ))}
                    {selectedCase.case_parties.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        还有 {selectedCase.case_parties.length - 3} 个当事人...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

