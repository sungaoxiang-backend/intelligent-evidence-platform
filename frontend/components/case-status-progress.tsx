"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Circle, Clock, AlertCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { CaseStatus } from "@/lib/types"

// 主流程状态配置（线性）
const mainStatusFlow = [
  {
    key: "draft" as CaseStatus,
    label: "案件已录入",
    description: "案件基本信息录入了系统",
    guide: "有新案件录入了系统",
    color: "blue"
  },
  {
    key: "accepted" as CaseStatus,
    label: "业务已拉群", 
    description: "业务基本了解清晰，用户支付了业务订单",
    guide: "您的案件也建立专案群，请您尽快下载案件相关文书并签署回传至群内",
    color: "blue"
  },
  {
    key: "documents_complete" as CaseStatus,
    label: "文书已完备",
    description: "生成了相关文书，用户已下载签署拍照回传",
    guide: "您的文书签署已完备，请尽快上传至法院申请立案",
    color: "green"
  },
  {
    key: "filing_submitted" as CaseStatus,
    label: "立案已提交",
    description: "用户将相关文书提交到了法院",
    guide: "您的立案申请已提交成功，请密切关注立案申请结果",
    color: "blue"
  },
  {
    key: "filing_approved" as CaseStatus, // 使用立案通过作为主节点
    label: "立案结果",
    description: "法院审核立案申请的结果",
    guide: "立案申请已审核完成",
    color: "blue",
    subStatuses: [
      {
        key: "filing_approved" as CaseStatus,
        label: "立案已通过",
        description: "法院审核通过了立案申请，案件正式立案",
        guide: "恭喜！案件已成功立案，请密切关注法院缴费公告",
        color: "green"
      },
      {
        key: "filing_rejected" as CaseStatus,
        label: "立案已驳回",
        description: "法院审核驳回了立案申请，案件无法立案",
        guide: "您的立案申请已驳回，请根据驳回原因进行修改后重新提交",
        color: "red"
      }
    ]
  },
  {
    key: "payment_notified" as CaseStatus,
    label: "案件待缴费",
    description: "案件已经由法院公告缴费通知",
    guide: "法院已发布缴费公告，请及时缴纳诉讼费用，逾期可能影响案件进展",
    color: "yellow"
  },
  {
    key: "payment_completed" as CaseStatus,
    label: "案件已缴费",
    description: "用户已经缴费，等待法院调解或开庭",
    guide: "诉讼费用已缴纳完成，请保持通讯畅通，等待法院安排调解或开庭",
    color: "green"
  },
  {
    key: "mediation_completed" as CaseStatus,
    label: "已调解结束",
    description: "法院已经在必要开庭前调解完成，案件结束",
    guide: "调解程序已在开庭前直接完成，双方达成一致意见，案件已结案",
    color: "green"
  },
  {
    key: "summons_delivered" as CaseStatus,
    label: "传票已送达",
    description: "法院已经送达传票",
    guide: "法院传票已送达，请按照传票要求的时间和地点准时参加庭审",
    color: "blue"
  },
  {
    key: "mediation_completed_after_trial" as CaseStatus,
    label: "已调解结束",
    description: "法院已经在开庭后调解完成，案件结束",
    guide: "调解程序已在开庭后完成，双方达成一致意见，案件已结案",
    color: "green"
  },
  {
    key: "judgment_rendered" as CaseStatus,
    label: "已判决结束",
    description: "法院已经判决，案件结束",
    guide: "法院已作出判决，案件审理程序结束，请关注判决书内容",
    color: "green"
  }
]

// 强制执行分支状态配置
const enforcementStatusFlow = [
  {
    key: "enforcement_applied" as CaseStatus,
    label: "已申请强执",
    description: "用户在系统中表明想要申请强制执行",
    guide: "强制执行申请已提交，请准备相关证据材料，等待法院审查",
    color: "orange"
  },
  {
    key: "enforcement_document_signed" as CaseStatus,
    label: "强执书完备",
    description: "用户已经签署和上传了强制执行申请书",
    guide: "强制执行申请书已签署完成，请确保所有材料齐全并按时提交",
    color: "blue"
  },
  {
    key: "enforcement_document_submitted" as CaseStatus,
    label: "强执已提交",
    description: "用户已经上传了强制执行申请书到法院",
    guide: "强制执行申请已提交至法院，请耐心等待法院审查结果",
    color: "blue"
  },
  {
    key: "enforcement_approved" as CaseStatus,
    label: "强执申请通过",
    description: "法院通过了用户提交的强制执行申请",
    guide: "强制执行申请已获法院批准，法院将开始执行程序",
    color: "green"
  },
  {
    key: "enforcement_terminated" as CaseStatus,
    label: "已终结裁定",
    description: "用户上传了法院的终结裁定书",
    guide: "强制执行程序已终结，案件流程结束",
    color: "green"
  }
]

interface CaseStatusProgressProps {
  currentStatus: CaseStatus
  onStatusChange: (status: CaseStatus) => void
  editing: boolean
  className?: string
}

export function CaseStatusProgress({ 
  currentStatus, 
  onStatusChange, 
  editing, 
  className = "" 
}: CaseStatusProgressProps) {
  const [showEnforcementBranch, setShowEnforcementBranch] = useState(false)

  // 检查当前状态是否在强制执行分支中
  const isInEnforcementBranch = () => {
    return enforcementStatusFlow.some(status => status.key === currentStatus)
  }

  // 检查是否应该显示强制执行分支 - 默认收起
  const shouldShowEnforcementBranch = () => {
    return showEnforcementBranch
  }

  const getCurrentStatusIndex = () => {
    // 如果在强制执行分支中，需要找到强制执行流程开始前的最后一个主流程状态
    if (isInEnforcementBranch()) {
      // 强制执行流程通常从"已判决结束"状态开始
      // 所以主流程应该显示到"已判决结束"状态
      const judgmentIndex = mainStatusFlow.findIndex(status => status.key === "judgment_rendered")
      return judgmentIndex >= 0 ? judgmentIndex : mainStatusFlow.length - 1
    }
    
    // 检查是否在立案结果子状态中
    const filingResultIndex = mainStatusFlow.findIndex(status => status.key === "filing_approved" && status.subStatuses)
    if (filingResultIndex !== -1) {
      const filingResult = mainStatusFlow[filingResultIndex]
      if (filingResult.subStatuses) {
        const subStatusIndex = filingResult.subStatuses.findIndex(sub => sub.key === currentStatus)
        if (subStatusIndex !== -1) {
          return filingResultIndex
        }
      }
    }
    
    return mainStatusFlow.findIndex(status => status.key === currentStatus)
  }

  const getProgressPercentage = () => {
    const currentIndex = getCurrentStatusIndex()
    // 计算进度条应该延伸到的位置
    // 已录入系统（索引0）只点亮当前圆点，不延伸到下一个
    // 其他状态延伸到当前圆点位置
    if (currentIndex === 0) return 0 // 已录入系统不延伸
    return Math.round((currentIndex / (mainStatusFlow.length - 1)) * 100)
  }

  const getCurrentStatusConfig = () => {
    // 如果在强制执行分支中
    if (isInEnforcementBranch()) {
      return enforcementStatusFlow.find(s => s.key === currentStatus)
    }
    
    // 检查是否在立案结果子状态中
    const filingResult = mainStatusFlow.find(s => s.key === "filing_approved" && s.subStatuses)
    if (filingResult?.subStatuses) {
      const subStatus = filingResult.subStatuses.find(sub => sub.key === currentStatus)
      if (subStatus) {
        return subStatus
      }
    }
    
    return mainStatusFlow.find(s => s.key === currentStatus)
  }

  const getStatusIcon = (status: any, isCurrent: boolean, isCompleted: boolean, isEnforcement = false) => {
    if (isCurrent) {
      const colorClass = isEnforcement ? "text-orange-600" : "text-blue-600"
      return (
        <div className="relative">
          <Circle className={`w-4 h-4 ${colorClass} fill-current`} />
          <div className={`absolute inset-0 w-4 h-4 rounded-full ${isEnforcement ? 'bg-orange-600' : 'bg-blue-600'} animate-ping opacity-20`}></div>
        </div>
      )
    }
    if (isCompleted) {
      const colorClass = isEnforcement ? "text-orange-600" : "text-blue-600"
      return <Circle className={`w-4 h-4 ${colorClass} fill-current`} />
    }
    return <Circle className="w-4 h-4 text-gray-300" />
  }

  const getStatusColor = (status: any, isCurrent: boolean, isCompleted: boolean, isEnforcement = false) => {
    if (isCurrent) {
      if (isEnforcement) return "text-orange-700 font-semibold"
      if (status.color === "red") return "text-red-700 font-semibold"
      if (status.color === "green") return "text-green-700 font-semibold"
      return "text-blue-700 font-semibold"
    }
    if (isCompleted) {
      if (isEnforcement) return "text-orange-700"
      if (status.color === "red") return "text-red-700"
      if (status.color === "green") return "text-green-700"
      return "text-blue-700"
    }
    return "text-gray-500"
  }

  const currentIndex = getCurrentStatusIndex()
  const progressPercentage = getProgressPercentage()
  const displayStatuses = mainStatusFlow
  const currentConfig = getCurrentStatusConfig()

  if (editing) {
    // 创建所有状态的扁平列表用于编辑
    const allStatuses = [
      ...mainStatusFlow.flatMap(status => {
        if (status.subStatuses) {
          return status.subStatuses
        }
        return [status]
      }),
      ...enforcementStatusFlow
    ]

    return (
      <Card className={`shadow-sm border-0 bg-gradient-to-br from-white to-purple-50/30 ${className}`}>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">案件状态</h3>
              <Select value={currentStatus} onValueChange={onStatusChange}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 mb-2">主流程</div>
                    {mainStatusFlow.map((status) => (
                      <div key={status.key}>
                        {status.subStatuses ? (
                          status.subStatuses.map((subStatus) => (
                            <SelectItem key={subStatus.key} value={subStatus.key}>
                              <div className="flex flex-col">
                                <span className="font-medium">{subStatus.label}</span>
                                <span className="text-xs text-gray-500">{subStatus.description}</span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem key={status.key} value={status.key}>
                            <div className="flex flex-col">
                              <span className="font-medium">{status.label}</span>
                              <span className="text-xs text-gray-500">{status.description}</span>
                            </div>
                          </SelectItem>
                        )}
                      </div>
                    ))}
                    <div className="text-xs font-semibold text-gray-500 mb-2 mt-4">强制执行流程</div>
                    {enforcementStatusFlow.map((status) => (
                      <SelectItem key={status.key} value={status.key}>
                        <div className="flex flex-col">
                          <span className="font-medium">{status.label}</span>
                          <span className="text-xs text-gray-500">{status.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`shadow-sm border-0 bg-gradient-to-br from-white to-blue-50/30 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
          <div className="relative mr-4">
            <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-green-600 rounded-full shadow-lg"></div>
            <div className="absolute inset-0 w-3 h-3 bg-gradient-to-br from-green-400 to-green-500 rounded-full animate-pulse opacity-60"></div>
          </div>
          <span className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent font-medium tracking-wide">
            案件状态
          </span>
          <div className="ml-auto h-px bg-gradient-to-r from-green-200 to-transparent flex-1 max-w-16"></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {/* 案件状态进度条 */}
        <div>
          <div className="relative">
            {/* 进度条背景 */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* 主流程状态节点 */}
            <div className="absolute top-0 left-0 w-full h-2">
              {mainStatusFlow.map((status, index) => {
                const isCurrent = status.key === currentStatus || 
                  (status.subStatuses && status.subStatuses.some(sub => sub.key === currentStatus))
                const isCompleted = index <= currentIndex
                
                // 计算节点位置 - 均匀分布
                const positionPercent = (index / (mainStatusFlow.length - 1)) * 100
                
                // 处理立案结果节点
                if (status.key === "filing_approved" && status.subStatuses) {
                  const currentSubStatus = status.subStatuses.find(sub => sub.key === currentStatus)
                  const displayLabel = currentSubStatus ? currentSubStatus.label : status.label
                  const displayDescription = currentSubStatus ? currentSubStatus.description : status.description
                  const displayGuide = currentSubStatus ? currentSubStatus.guide : status.guide
                  const isSubCurrent = currentSubStatus?.key === currentStatus
                  
                  return (
                    <TooltipProvider key={status.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute flex flex-col items-center transform -translate-x-1/2 cursor-pointer"
                            style={{ 
                              left: `${positionPercent}%`,
                              top: '-10px'
                            }}
                          >
                            {/* 带数字的状态节点 */}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 ${
                              isCompleted ? 
                                (currentSubStatus?.color === "red" ? 'bg-red-500 border-red-500 text-white' : 'bg-green-500 border-green-500 text-white') :
                                'bg-gray-100 border-gray-300 text-gray-500'
                            }`}>
                              {index + 1}
                            </div>
                            
                            {/* 状态标签 */}
                            <div className="mt-3 text-center max-w-24">
                              <div className={`text-xs leading-tight whitespace-nowrap ${
                                isSubCurrent ? 
                                  (currentSubStatus?.color === "red" ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold') :
                                  isCompleted ? 
                                    (currentSubStatus?.color === "red" ? 'text-red-700' : 'text-green-700') :
                                    'text-gray-500'
                              }`}>
                                {displayLabel}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <div className="space-y-2">
                            <div className="font-medium">{displayLabel}</div>
                            <div className="text-xs text-gray-600">{displayDescription}</div>
                            <div className="text-xs text-blue-600 font-medium">通知提醒：</div>
                            <div className="text-xs text-gray-700 leading-relaxed">{displayGuide}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }
                
                return (
                  <TooltipProvider key={status.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="absolute flex flex-col items-center transform -translate-x-1/2 cursor-pointer"
                          style={{ 
                            left: `${positionPercent}%`,
                            top: '-10px'
                          }}
                        >
                          {/* 带数字的状态节点 */}
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 ${
                            isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                            'bg-gray-100 border-gray-300 text-gray-500'
                          }`}>
                            {index + 1}
                          </div>
                          
                          {/* 状态标签 */}
                          <div className="mt-3 text-center max-w-24">
                            <div className={`text-xs leading-tight whitespace-nowrap ${
                              isCurrent ? 'text-green-700 font-semibold' : 
                              isCompleted ? 'text-green-700' : 
                              'text-gray-500'
                            }`}>
                              {status.label}
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <div className="space-y-2">
                          <div className="font-medium">{status.label}</div>
                          <div className="text-xs text-gray-600">{status.description}</div>
                          <div className="text-xs text-blue-600 font-medium">通知提醒：</div>
                          <div className="text-xs text-gray-700 leading-relaxed">{status.guide}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </div>
        </div>

        {/* 强制执行流程 - 可折叠 */}
        <div className="pt-4">
          <div 
            className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
            onClick={() => setShowEnforcementBranch(!showEnforcementBranch)}
          >
            <h3 className="text-base font-semibold text-gray-800">强制执行流程</h3>
            <div className="flex items-center text-sm text-gray-500">
              {showEnforcementBranch ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          </div>

          {showEnforcementBranch && (
            <div className="relative pb-8">
              {/* 进度条背景 */}
              <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 transition-all duration-500 ease-out"
                  style={{ 
                    width: isInEnforcementBranch() ? 
                      `${((enforcementStatusFlow.findIndex(s => s.key === currentStatus) + 1) / enforcementStatusFlow.length) * 100}%` : 
                      '0%' 
                  }}
                />
              </div>

              {/* 强制执行状态节点 */}
              <div className="absolute top-0 left-0 w-full h-2">
                {enforcementStatusFlow.map((status, index) => {
                  const isCurrent = status.key === currentStatus
                  const isCompleted = isInEnforcementBranch() && index <= enforcementStatusFlow.findIndex(s => s.key === currentStatus)
                  
                  // 计算节点位置 - 均匀分布
                  const positionPercent = (index / (enforcementStatusFlow.length - 1)) * 100
                  
                  return (
                    <TooltipProvider key={status.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className="absolute flex flex-col items-center transform -translate-x-1/2 cursor-pointer"
                            style={{ 
                              left: `${positionPercent}%`,
                              top: '-10px'
                            }}
                          >
                            {/* 带数字的状态节点 */}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-200 hover:scale-110 ${
                              isCompleted ? 'bg-orange-500 border-orange-500 text-white' : 
                              'bg-gray-100 border-gray-300 text-gray-500'
                            }`}>
                              {index + 1}
                            </div>
                            
                            {/* 状态标签 */}
                            <div className="mt-3 text-center max-w-20">
                              <div className={`text-xs leading-tight whitespace-nowrap ${
                                isCurrent ? 'text-orange-700 font-semibold' : 
                                isCompleted ? 'text-orange-700' : 
                                'text-gray-500'
                              }`}>
                                {status.label}
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-sm">
                          <div className="space-y-2">
                            <div className="font-medium">{status.label}</div>
                            <div className="text-xs text-gray-600">{status.description}</div>
                            <div className="text-xs text-orange-600 font-medium">通知提醒：</div>
                            <div className="text-xs text-gray-700 leading-relaxed">{status.guide}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}