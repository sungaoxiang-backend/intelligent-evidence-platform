"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Circle, Clock, AlertCircle, XCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { CaseStatus } from "@/lib/types"

// 案件状态配置 - 主流程状态（线性）
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
    color: "green"
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
    description: "法院已经调解完成，案件结束",
    guide: "调解程序已完成，双方达成一致意见，案件已结案",
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
    key: "judgment_rendered" as CaseStatus,
    label: "已判决结束",
    description: "法院已经判决，案件结束",
    guide: "法院已作出判决，案件审理程序结束，请关注判决书内容",
    color: "green"
  },
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

  const getCurrentStatusIndex = () => {
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
    return mainStatusFlow.find(s => s.key === currentStatus)
  }

  const getStatusIcon = (status: typeof mainStatusFlow[0], isCurrent: boolean, isCompleted: boolean) => {
    if (isCurrent) {
      return (
        <div className="relative">
          <Circle className="w-4 h-4 text-blue-600 fill-current" />
          <div className="absolute inset-0 w-4 h-4 rounded-full bg-blue-600 animate-ping opacity-20"></div>
        </div>
      )
    }
    if (isCompleted) {
      return <Circle className="w-4 h-4 text-blue-600 fill-current" />
    }
    return <Circle className="w-4 h-4 text-gray-300" />
  }

  const getStatusColor = (status: typeof mainStatusFlow[0], isCurrent: boolean, isCompleted: boolean) => {
    if (isCurrent) return "text-blue-700 font-semibold"
    if (isCompleted) return "text-blue-700"
    return "text-gray-500"
  }

  const currentIndex = getCurrentStatusIndex()
  const progressPercentage = getProgressPercentage()
  const displayStatuses = mainStatusFlow
  const currentConfig = getCurrentStatusConfig()

  if (editing) {
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
                  {mainStatusFlow.map((status) => (
                    <SelectItem key={status.key} value={status.key}>
                      <div className="flex flex-col">
                        <span className="font-medium">{status.label}</span>
                        <span className="text-xs text-gray-500">{status.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`shadow-sm border-0 bg-gradient-to-br from-white to-purple-50/30 ${className}`}>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">案件状态</h3>
          </div>

          {/* 带数字的进度条设计 */}
          <div className="relative">
            {/* 进度条背景 */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* 状态节点 - 带数字的圆形，分布在进度条上 */}
            <div className="absolute top-0 left-0 w-full h-2">
              {displayStatuses.map((status, index) => {
                const isCurrent = status.key === currentStatus
                const isCompleted = index <= currentIndex
                
                // 计算节点位置 - 均匀分布
                const positionPercent = (index / (displayStatuses.length - 1)) * 100
                
                return (
                  <TooltipProvider key={status.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="absolute flex flex-col items-center transform -translate-x-1/2 cursor-pointer"
                          style={{ 
                            left: `${positionPercent}%`,
                            top: '-10px' // 让节点在进度条上方一点
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
      </CardContent>
    </Card>
  )
}