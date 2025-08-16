"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, XCircle, ExternalLink, Star, Zap, Target } from "lucide-react"
import { evidenceChainAPI, type EvidenceChainDashboardData, type EvidenceChain, type EvidenceTypeRequirement } from "@/lib/evidence-chain-api"

interface EvidenceChainDashboardProps {
  caseId: number
  onRefresh?: () => void
}

export function EvidenceChainDashboard({ caseId }: EvidenceChainDashboardProps) {
  const [dashboardData, setDashboardData] = useState<EvidenceChainDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      const data = await evidenceChainAPI.getCaseEvidenceChainDashboard(caseId)
      setDashboardData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取证据链数据失败")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [caseId])

  const handleSlotClick = (slot: any, requirement: EvidenceTypeRequirement) => {
    if (!slot.is_satisfied || !slot.source_id) return

    if (slot.source_type === "evidence") {
      // 跳转到证据分析页面并选中指定证据
      window.open(evidenceChainAPI.getEvidenceUrl(caseId, slot.source_id as number), "_blank")
    } else if (slot.source_type === "association_group") {
      // 跳转到关联证据分析页面并选中指定分组
      window.open(evidenceChainAPI.getAssociationGroupUrl(caseId, slot.source_id as string), "_blank")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
        <button
          onClick={() => fetchDashboardData()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          重试
        </button>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* 已激活证据链展示 - 只显示已激活且进度最高的证据链 */}
      {(() => {
        // 找到已激活的证据链
        const activatedChains = dashboardData.chains.filter(chain => chain.is_activated)
        
        if (activatedChains.length === 0) {
          return null // 没有已激活的证据链，不显示
        }
        
        // 找到进度最高的已激活证据链
        const bestActivatedChain = activatedChains.reduce((best, current) => {
          return current.completion_percentage > best.completion_percentage ? current : best
        })
        
        return (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-green-900">
                  🎯 推荐证据链: {bestActivatedChain.chain_name}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {bestActivatedChain.completion_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-green-600">
                  完成度
                </div>
              </div>
            </div>
            
            {/* 进度条 */}
            <div className="w-full bg-green-100 rounded-full h-3 border border-green-200">
              <div 
                className="h-3 rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-emerald-600"
                style={{ width: `${bestActivatedChain.completion_percentage}%` }}
              ></div>
            </div>
            
            {/* 统计信息 */}
            <div className="flex items-center justify-between mt-3 text-sm text-green-700">
              <span>
                🌟 核心特征: {bestActivatedChain.core_requirements_satisfied}/{bestActivatedChain.core_requirements_count}
              </span>
              <span>
                ✅ 状态: 已激活
              </span>
              <span>
                🎯 推荐使用
              </span>
            </div>
          </div>
        )
      })()}

      {/* 证据链列表 - 按可行性状态排序 */}
      <div className="space-y-4">
        {dashboardData.chains
          .sort((a, b) => {
            // 优先显示可行的证据链
            if (a.is_feasible && !b.is_feasible) return -1
            if (!a.is_feasible && b.is_feasible) return 1
            // 其次按可行性完成度排序
            return b.feasibility_completion - a.feasibility_completion
          })
          .map((chain) => (
            <EvidenceChainCard
              key={chain.chain_id}
              chain={chain}
              caseId={caseId}
              onSlotClick={handleSlotClick}
            />
          ))}
      </div>
    </div>
  )
}

// 证据链卡片组件
interface EvidenceChainCardProps {
  chain: EvidenceChain
  caseId: number
  onSlotClick: (slot: any, requirement: EvidenceTypeRequirement) => void
}

function EvidenceChainCard({ chain, caseId, onSlotClick }: EvidenceChainCardProps) {
  const [expandedRequirements, setExpandedRequirements] = useState<Set<string>>(new Set())

  const toggleRequirement = (evidenceType: string) => {
    const newExpanded = new Set(expandedRequirements)
    if (newExpanded.has(evidenceType)) {
      newExpanded.delete(evidenceType)
    } else {
      newExpanded.add(evidenceType)
    }
    setExpandedRequirements(newExpanded)
  }

  // 使用后端计算好的进度数据
  const totalCategories = chain.core_requirements_count
  const activatedCategories = chain.core_requirements_satisfied
  const activationProgress = totalCategories > 0 ? (activatedCategories / totalCategories) * 100 : 0

  return (
    <div className={`border rounded-lg p-4 ${
      chain.is_feasible 
        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md' 
        : 'bg-white border-gray-200'
    }`}>
      {/* 证据链头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{chain.chain_name}</h3>
            
            {/* 状态标签 */}
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
              chain.is_feasible 
                ? 'text-blue-600 bg-blue-50 border-blue-200' 
                : 'text-red-600 bg-red-50 border-red-200'
            }`}>
              {chain.is_feasible ? (
                <>
                  <Target className="w-3 h-3" />
                  可行
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3" />
                  不可行
                </>
              )}
            </div>
            
            {chain.is_activated && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-50 border border-green-200">
                <Zap className="w-3 h-3" />
                已激活
              </div>
            )}
          </div>
          
          {/* 链的激活进度条 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                <Star className="w-3 h-3 inline mr-1 text-yellow-500" />
                链激活进度
              </span>
              <span className="text-sm text-gray-600">
                {activatedCategories}/{totalCategories}
              </span>
            </div>
            <div className="relative group">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activationProgress === 100 
                      ? 'bg-green-500' 
                      : activationProgress > 50 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${activationProgress}%` }}
                ></div>
              </div>
              
              {/* Hover Tooltip - 显示缺失的核心特征分类 */}
              {activationProgress < 100 && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                  <div className="flex items-center gap-1 mb-1">
                    <Star className="w-3 h-3 text-yellow-400" />
                    <span className="font-medium">缺失的核心特征分类:</span>
                  </div>
                  {chain.requirements
                    .filter(req => req.core_slots_count > 0 && req.core_completion_percentage < 100)
                    .map(req => (
                      <div key={req.evidence_type} className="text-yellow-200">
                        • {req.evidence_type}: {req.core_slots_satisfied}/{req.core_slots_count}
                      </div>
                    ))}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {activationProgress === 100 
                ? '✅ 所有分类核心特征完备，证据链已激活！' 
                : `${totalCategories - activatedCategories} 个分类的核心特征待完善!`
              }
            </div>
          </div>

          {/* 总进度条 - 图鉴式展示 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                <Target className="w-3 h-3 inline mr-1 text-blue-500" />
                特征收集总览
              </span>
              <span className="text-sm text-gray-600">
                {chain.requirements.filter(r => r.core_slots_count > 0 || r.supplementary_slots_count > 0).length} 个分类
              </span>
            </div>
            <div className="relative group">
              <div className="w-full bg-gray-100 rounded-full h-2 border border-gray-200">
                <div 
                  className="h-2 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-400 to-purple-500"
                  style={{ width: `${chain.completion_percentage}%` }}
                ></div>
              </div>
              
              {/* Hover Tooltip - 显示缺失的特征详情 */}
              {chain.completion_percentage < 100 && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 max-w-xs">
                  <div className="flex items-center gap-1 mb-2">
                    <Target className="w-3 h-3 text-blue-400" />
                    <span className="font-medium">缺失的特征详情:</span>
                  </div>
                  
                  {/* 核心特征缺失 */}
                  {chain.requirements
                    .filter(req => req.core_slots_count > 0 && req.core_completion_percentage < 100)
                    .map(req => (
                      <div key={`core-${req.evidence_type}`} className="mb-1">
                        <div className="text-yellow-200 font-medium">🔴 {req.evidence_type}</div>
                        <div className="text-gray-300 ml-2">
                          核心特征: {req.core_slots_satisfied}/{req.core_slots_count}
                        </div>
                      </div>
                    ))}
                  
                  {/* 补充特征缺失 */}
                  {chain.requirements
                    .filter(req => req.supplementary_slots_count > 0 && req.supplementary_completion_percentage < 100)
                    .map(req => (
                      <div key={`supp-${req.evidence_type}`} className="mb-1">
                        <div className="text-blue-200 font-medium">🟡 {req.evidence_type}</div>
                        <div className="text-gray-300 ml-2">
                          补充特征: {req.supplementary_slots_satisfied}/{req.supplementary_slots_count}
                        </div>
                      </div>
                    ))}
                  
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {chain.completion_percentage === 100 
                ? '🎯 所有特征收集完成，证据链完整！' 
                : `特征收集进度 ${chain.completion_percentage.toFixed(1)}%`
              }
            </div>
          </div>
        </div>
      </div>

      {/* 证据要求列表 - 有核心特征的分类优先显示 */}
      <div className="space-y-3">
        {chain.requirements
          .sort((a, b) => {
            // 有核心特征的分类排在前面
            const aHasCore = a.core_slots_count > 0
            const bHasCore = b.core_slots_count > 0
            if (aHasCore && !bHasCore) return -1
            if (!aHasCore && bHasCore) return 1
            // 如果都有或都没有核心特征，按完成度排序
            return (b.core_completion_percentage || 0) - (a.core_completion_percentage || 0)
          })
          .map((requirement) => (
            <EvidenceRequirementCard
              key={requirement.evidence_type}
              requirement={requirement}
              onSlotClick={onSlotClick}
              isExpanded={expandedRequirements.has(requirement.evidence_type)}
              onToggle={() => toggleRequirement(requirement.evidence_type)}
            />
          ))}
      </div>
    </div>
  )
}

// 证据要求卡片组件
interface EvidenceRequirementCardProps {
  requirement: EvidenceTypeRequirement
  onSlotClick: (slot: any, requirement: EvidenceTypeRequirement) => void
  isExpanded: boolean
  onToggle: () => void
}

function EvidenceRequirementCard({ requirement, onSlotClick, isExpanded, onToggle }: EvidenceRequirementCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "satisfied":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "partial":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      case "missing":
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />
    }
  }

  // 计算总体特征完成度
  const totalSlots = requirement.core_slots_count + requirement.supplementary_slots_count
  const totalSatisfied = requirement.core_slots_satisfied + requirement.supplementary_slots_satisfied
  const overallProgress = totalSlots > 0 ? (totalSatisfied / totalSlots) * 100 : 100

  // 检查是否有可跳转的证据或联合特征组
  const hasJumpableSource = requirement.slots.some(slot => 
    slot.is_satisfied && slot.source_id && slot.source_type !== "none"
  )

  // 获取第一个可跳转的源（用于快捷跳转）
  const getFirstJumpableSource = () => {
    const jumpableSlot = requirement.slots.find(slot => 
      slot.is_satisfied && slot.source_id && slot.source_type !== "none"
    )
    if (jumpableSlot) {
      onSlotClick(jumpableSlot, requirement)
    }
  }

  // 圆形进度条组件
  const CircularProgress = ({ progress, size = 40 }: { progress: number; size?: number }) => {
    const radius = (size - 4) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (progress / 100) * circumference
    
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="text-gray-200"
            strokeWidth="3"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={`transition-all duration-300 ${
              progress === 100 ? 'text-green-500' : 
              progress > 50 ? 'text-yellow-500' : 'text-red-500'
            }`}
            strokeWidth="3"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute text-xs font-medium">
          {Math.round(progress)}%
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      {/* 证据要求头部 - 可点击展开 */}
      <div 
        className="flex items-start gap-3 cursor-pointer"
        onClick={onToggle}
      >
        {getStatusIcon(requirement.status)}
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">{requirement.evidence_type}</h4>
              
              {/* 核心特征标识 */}
              {requirement.core_slots_count > 0 ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs text-blue-600 font-medium">核心</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs text-gray-500">辅助</span>
                </div>
              )}
              
              {/* 快捷跳转按钮 - 在分类标题旁边 */}
              {hasJumpableSource && (
                <button
                  onClick={(e) => {
                    e.stopPropagation() // 防止触发展开/收起
                    getFirstJumpableSource()
                  }}
                  className="text-blue-600 hover:text-blue-800"
                  title="查看关联证据或联合特征组"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* 展开/收起图标 */}
            <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* 圆形进度条和统计信息 */}
          <div className="flex items-center gap-4 mt-2">
            <CircularProgress progress={overallProgress} />
            <div className="text-xs text-gray-600 space-y-1">
              {/* 只显示有核心特征的分类的核心特征信息 */}
              {requirement.core_slots_count > 0 && (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-blue-600">核心特征:</span>
                  <span className="text-blue-700">{requirement.core_slots_satisfied}/{requirement.core_slots_count}</span>
                </div>
              )}
              {/* 补充特征信息 */}
              {requirement.supplementary_slots_count > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">补充特征:</span>
                  <span>{requirement.supplementary_slots_satisfied}/{requirement.supplementary_slots_count}</span>
                </div>
              )}
              {/* 对于没有核心特征的分类，显示特殊标识 */}
              {requirement.core_slots_count === 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 italic">无核心特征要求</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 展开的详细内容 */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          {/* 核心槽位 - 只显示有核心特征的分类 */}
          {requirement.core_slots_count > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>核心特征 ({requirement.core_slots_satisfied}/{requirement.core_slots_count})</span>
              </div>
              <div className="space-y-1">
                {requirement.slots.filter(slot => slot.is_core).map((slot, slotIndex) => (
                  <SlotItem
                    key={slotIndex}
                    slot={slot}
                    requirement={requirement}
                    onSlotClick={onSlotClick}
                    isCore={true}
                    showSourceButton={false}  // 不在特征级别显示按钮
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* 补充特征 - 只显示有补充特征的分类 */}
          {requirement.supplementary_slots_count > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>补充特征 ({requirement.supplementary_slots_satisfied}/{requirement.supplementary_slots_count})</span>
              </div>
              <div className="space-y-1">
                {requirement.slots.filter(slot => !slot.is_core).map((slot, slotIndex) => (
                  <SlotItem
                    key={slotIndex}
                    slot={slot}
                    requirement={requirement}
                    onSlotClick={onSlotClick}
                    isCore={false}
                    showSourceButton={false}  // 不在特征级别显示按钮
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* 对于没有核心特征的分类，显示说明 */}
          {requirement.core_slots_count === 0 && (
            <div className="text-xs text-gray-500 italic">
              此分类无需核心特征，仅作为辅助信息收集
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 槽位项组件
interface SlotItemProps {
  slot: any
  requirement: EvidenceTypeRequirement
  onSlotClick: (slot: any, requirement: EvidenceTypeRequirement) => void
  isCore: boolean
  showSourceButton?: boolean
}

function SlotItem({ slot, requirement, onSlotClick, isCore, showSourceButton = true }: SlotItemProps) {
  return (
    <div className={`flex items-center gap-2 text-xs ${
      isCore ? 'text-gray-900' : 'text-gray-600'
    }`}>
      {slot.is_satisfied ? (
        <CheckCircle className={`w-3 h-3 ${
          isCore ? 'text-green-600' : 'text-green-500'
        }`} />
      ) : (
        <XCircle className={`w-3 h-3 ${
          isCore ? 'text-red-600' : 'text-red-400'
        }`} />
      )}
      <span className={`${
        slot.is_satisfied 
          ? (isCore ? 'text-green-800 font-medium' : 'text-green-700') 
          : (isCore ? 'text-red-800 font-medium' : 'text-red-600')
      }`}>
        {slot.slot_name}
        {isCore && <span className="ml-1 text-orange-600">★</span>}
      </span>
      {showSourceButton && slot.is_satisfied && slot.source_id && (
        <button
          onClick={() => onSlotClick(slot, requirement)}
          className="ml-1 text-blue-600 hover:text-blue-800"
          title={`查看来源: ${slot.source_type === 'evidence' ? '证据' : '关联组'} ${slot.source_id}`}
        >
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}