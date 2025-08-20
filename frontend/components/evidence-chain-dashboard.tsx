"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, XCircle, ExternalLink, Star, Zap, Target } from "lucide-react"
import { evidenceChainAPI, type EvidenceChainDashboardData, type EvidenceChain, type EvidenceTypeRequirement } from "@/lib/evidence-chain-api"

// 添加流动动画的CSS样式
const flowAnimationStyles = `
  @keyframes waveFlow {
    0% { transform: translateX(-100%) scaleY(1); }
    25% { transform: translateX(-50%) scaleY(1.2); }
    50% { transform: translateX(0%) scaleY(0.8); }
    75% { transform: translateX(50%) scaleY(1.1); }
    100% { transform: translateX(100%) scaleY(1); }
  }
  
  @keyframes rippleEffect {
    0% { transform: scale(1) rotate(0deg); opacity: 0.8; }
    50% { transform: scale(1.1) rotate(180deg); opacity: 0.6; }
    100% { transform: scale(1) rotate(360deg); opacity: 0.8; }
  }
  
  @keyframes floatingBubbles {
    0% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
    33% { transform: translateY(-10px) rotate(120deg); opacity: 0.9; }
    66% { transform: translateY(-5px) rotate(240deg); opacity: 0.5; }
    100% { transform: translateY(0px) rotate(360deg); opacity: 0.7; }
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`

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
      {/* 添加流动动画样式 */}
      <style dangerouslySetInnerHTML={{ __html: flowAnimationStyles }} />
      
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
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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
            
            {/* 进度条 - 简化样式 */}
            <div className="w-full bg-green-100 rounded-full h-3 border border-green-200">
              <div 
                className="h-3 rounded-full transition-all duration-500 bg-green-500"
                style={{ width: `${bestActivatedChain.completion_percentage}%` }}
              ></div>
            </div>
            
            {/* 统计信息 - 简化显示 */}
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
  const [isChainContentExpanded, setIsChainContentExpanded] = useState(false)

  // 确保默认状态是收起的
  useEffect(() => {
    console.log(`证据链 ${chain.chain_name} 初始化，默认收起状态`)
    setExpandedRequirements(new Set())
    setIsChainContentExpanded(false)
  }, [chain.chain_id])

  // 监听展开状态变化
  useEffect(() => {
    console.log(`证据链 ${chain.chain_name} 状态变化:`, {
      isChainContentExpanded,
      expandedRequirements: Array.from(expandedRequirements),
      requirementsCount: chain.requirements.length
    })
  }, [isChainContentExpanded, expandedRequirements, chain.chain_name, chain.requirements.length])

  const toggleRequirement = (evidenceType: string) => {
    const newExpanded = new Set(expandedRequirements)
    if (newExpanded.has(evidenceType)) {
      newExpanded.delete(evidenceType)
    } else {
      newExpanded.add(evidenceType)
    }
    setExpandedRequirements(newExpanded)
    console.log(`切换证据类型 ${evidenceType} 展开状态:`, newExpanded.has(evidenceType))
  }

  // 统一的证据链内容展开/收起控制
  const toggleChainContent = () => {
    const newExpanded = !isChainContentExpanded
    console.log(`切换证据链内容展开状态: ${newExpanded}`)
    setIsChainContentExpanded(newExpanded)
    
    // 联动展开/收起所有证据类别
    if (newExpanded) {
      // 展开时，展开所有证据类别
      const allEvidenceTypes = chain.requirements.map(req => req.evidence_type)
      setExpandedRequirements(new Set(allEvidenceTypes))
      console.log('联动展开所有证据类别:', allEvidenceTypes)
    } else {
      // 收起时，收起所有证据类别
      setExpandedRequirements(new Set())
      console.log('联动收起所有证据类别')
    }
  }

  // 使用后端计算好的进度数据
  const totalCategories = chain.core_requirements_count
  const activatedCategories = chain.core_requirements_satisfied
  const activationProgress = totalCategories > 0 ? (activatedCategories / totalCategories) * 100 : 0

  // 计算证据链状态
  const getChainStatus = () => {
    if (chain.completion_percentage === 100) {
      return { status: 'completed', label: '已完成', color: 'green', icon: '🎯' }
    } else if (activationProgress === 100) {
      return { status: 'collecting', label: '收集中', color: 'blue', icon: '🔄' }
    } else {
      return { status: 'inactive', label: '未激活', color: 'orange', icon: '⏳' }
    }
  }

  const chainStatus = getChainStatus()

  return (
    <div className={`border rounded-lg p-4 transition-all duration-300 ${
      chainStatus.status === 'completed'
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-lg animate-pulse' // 轻微脉冲动画
        : chainStatus.status === 'collecting'
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-gray-200'
    }`}>
      {/* 证据链头部 - 添加统一的展开/收起控制和总体进度 */}
      <div className="relative mb-4">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-lg font-semibold text-gray-900">{chain.chain_name}</h3>
          
          {/* 统一的状态标签 - 移除重复的可行性标签，只保留统一状态 */}
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
            chainStatus.status === 'completed'
              ? 'text-green-600 bg-green-50 border-green-200'
              : chainStatus.status === 'collecting'
                ? 'text-green-600 bg-green-50 border-green-200'
                : 'text-gray-600 bg-gray-50 border-gray-200'
          }`}>
            <span className="text-sm">{chainStatus.icon}</span>
            {chainStatus.status === 'completed' || chainStatus.status === 'collecting' ? '已激活' : '未激活'}
          </div>
        </div>
        
        {/* 右上角：展开/收起按钮 - 移除重复的总体收集进度 */}
        <div className="absolute top-0 right-0">
          {/* 统一的展开/收起按钮 - 固定在右上角，位置不变 */}
          <button
            onClick={toggleChainContent}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex-shrink-0 z-10"
            title={isChainContentExpanded ? "收起详情" : "查看详情"}
          >
            <span>{isChainContentExpanded ? "收起" : "详情"}</span>
            <svg 
              className={`w-3 h-3 transform transition-transform duration-300 ${isChainContentExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* 证据链内容 - 直接在外层卡片中展示，无内部嵌套 */}
      <div className="flex items-start gap-6">
        {/* 左侧：步骤指示器 + 状态信息 */}
        <div className="flex-1">
          {/* 左上角：步骤指示器 */}
          <div className="flex items-center gap-2 mb-4">
            {Array.from({ length: totalCategories }, (_, index) => (
              <div
                key={index}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium transition-all duration-300 ${
                  index < activatedCategories
                    ? 'bg-green-500 border-green-600 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
              >
                {index < activatedCategories ? '✓' : index + 1}
              </div>
            ))}
          </div>
          
          {/* 左下角：用标签样式展示状态，无卡片嵌套 */}
          <div className="space-y-3">
            {/* 已完成分类 - 绿色标签 */}
            {chain.requirements
              .filter(req => req.core_slots_count > 0 && req.core_completion_percentage === 100)
              .length > 0 && (
              <div>
                <div className="text-sm font-medium text-green-700 mb-2">
                  已完成 ({chain.requirements
                    .filter(req => req.core_slots_count > 0 && req.core_completion_percentage === 100)
                    .length} 个)
                </div>
                <div className="flex flex-wrap gap-2">
                  {chain.requirements
                    .filter(req => req.core_slots_count > 0 && req.core_completion_percentage === 100)
                    .map(req => (
                      <span
                        key={req.evidence_type}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                      >
                        {req.evidence_type}
                      </span>
                    ))}
                </div>
              </div>
            )}
            
            {/* 待完成分类 - 改为友好的系统提示样式 */}
            {chain.requirements
              .filter(req => req.core_slots_count > 0 && req.core_completion_percentage < 100)
              .length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {/* 友好的提示图标 */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12L11 14L15 10M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* 友好的提示内容 */}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900 mb-2">
                      证据补充建议
                    </div>
                    <div className="text-sm text-blue-700 mb-3">
                      为了完善证据链，建议您优先补充以下 {chain.requirements
                        .filter(req => req.core_slots_count > 0 && req.core_completion_percentage < 100)
                        .length} 个证据类型：
                    </div>
                    
                    {/* 友好的证据列表 */}
                    <div className="space-y-2">
                      {chain.requirements
                        .filter(req => req.core_slots_count > 0 && req.core_completion_percentage < 100)
                        .map(req => (
                          <div key={req.evidence_type} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <span className="text-blue-800 font-medium">{req.evidence_type}</span>
                            <span className="text-blue-600">
                              (当前 {req.core_slots_satisfied}/{req.core_slots_count} 个)
                            </span>
                          </div>
                        ))}
                    </div>
                    
                    {/* 友好的操作建议 */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2L12.09 8.26L20 9L12.09 9.74L10 16L7.91 9.74L0 9L7.91 8.26L10 2Z"/>
                        </svg>
                        补充这些证据后，证据链将更加完整可靠
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 右侧：总体收集进度 - 红圈位置，避免重复，优化大小和位置 */}
        <div className="flex flex-col items-center justify-center min-w-[140px] -ml-4">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-3">总体收集进度</div>
            {/* 圆形进度条 - 水流波浪效果，进度始终确立 */}
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                {/* 背景圆环 */}
                <path
                  className="text-gray-200"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* 进度圆环 - 水流波浪效果，进度始终确立 */}
                <path
                  className="text-blue-500"
                  stroke="url(#waveGradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray={`${chain.completion_percentage * 1.131}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
                  }}
                />
                {/* 水流波浪渐变定义 */}
                <defs>
                  <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3B82F6">
                      <animate attributeName="stop-color" values="#3B82F6;#60A5FA;#3B82F6" dur="3s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="25%" stopColor="#60A5FA">
                      <animate attributeName="stop-color" values="#60A5FA;#93C5FD;#60A5FA" dur="3s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="50%" stopColor="#93C5FD">
                      <animate attributeName="stop-color" values="#93C5FD;#DBEAFE;#93C5FD" dur="3s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="75%" stopColor="#DBEAFE">
                      <animate attributeName="stop-color" values="#DBEAFE;#60A5FA;#DBEAFE" dur="3s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="#3B82F6">
                      <animate attributeName="stop-color" values="#3B82F6;#60A5FA;#3B82F6" dur="3s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>
                </defs>
              </svg>
              
              {/* 中心百分比文字 - 进度始终确立 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">
                  {Math.round(chain.completion_percentage)}%
                </span>
              </div>
              
              {/* 水流波浪效果层 */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                {/* 主要波浪效果 */}
                <div 
                  className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 opacity-20"
                  style={{
                    animation: 'waveFlow 4s ease-in-out infinite',
                    transform: `rotate(${chain.completion_percentage * 3.6}deg)`
                  }}
                />
                
                {/* 次要波浪效果 */}
                <div 
                  className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 opacity-15"
                  style={{
                    animation: 'waveFlow 3s ease-in-out infinite reverse',
                    transform: `rotate(${chain.completion_percentage * 3.6 + 45}deg)`
                  }}
                />
              </div>
              
              {/* 浮动气泡效果 */}
              <div className="absolute inset-0">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 bg-blue-300 rounded-full opacity-60"
                    style={{
                      left: `${20 + i * 30}%`,
                      top: `${30 + i * 20}%`,
                      animation: `floatingBubbles ${2 + i}s ease-in-out infinite`,
                      animationDelay: `${i * 0.5}s`
                    }}
                  />
                ))}
              </div>
              
              {/* 涟漪效果 */}
              <div className="absolute inset-0">
                <div 
                  className="absolute w-full h-full border-2 border-blue-300 rounded-full opacity-0"
                  style={{
                    animation: 'rippleEffect 2s ease-out infinite',
                    animationDelay: '1s'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 证据链信息和分类卡片之间的间隔 - 只在展开时显示 */}
      {isChainContentExpanded && (
        <div className="h-6 border-b border-gray-100 my-4"></div>
      )}

      {/* 证据分类列表 - 简化设计，突出重要信息 */}
      {isChainContentExpanded && (
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
      )}
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
  // 调试信息：显示当前展开状态
  console.log(`证据类型 ${requirement.evidence_type} 展开状态:`, isExpanded)

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

  return (
    <div className={`border rounded-lg p-3 transition-all duration-300 ${
      isExpanded ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
    }`}>
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
              
              {/* 核心特征标识 - 简化样式 */}
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
            
            {/* 展开/收起图标 - 添加状态指示 */}
            <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* 简化的进度展示 - 移除圆形进度条 */}
          <div className="mt-2">
            <div className="flex items-center gap-4">
              {/* 总体进度条 */}
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      overallProgress === 100 ? 'bg-green-500' : 
                      overallProgress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round(overallProgress)}% 完成
                </div>
              </div>
              
              {/* 统计信息 */}
              <div className="text-xs text-gray-600 space-y-1 min-w-0">
                {/* 只显示有核心特征的分类的核心特征信息 */}
                {requirement.core_slots_count > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-blue-600">核心:</span>
                    <span className="text-blue-700">{requirement.core_slots_satisfied}/{requirement.core_slots_count}</span>
                  </div>
                )}
                {/* 补充特征信息 */}
                {requirement.supplementary_slots_count > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">补充:</span>
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
      </div>
      
      {/* 展开的详细内容 - 添加展开状态指示 */}
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