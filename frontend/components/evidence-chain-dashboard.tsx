"use client"

import { useState, useEffect } from "react"
import { CheckCircle, AlertCircle, XCircle, ExternalLink, Star, Zap, ChevronDown, ChevronRight, X, Eye, Settings, ArrowRight, ChevronsRight } from "lucide-react"
import { evidenceChainAPI, type EvidenceChainDashboardData, type EvidenceChain, type EvidenceTypeRequirement } from "@/lib/evidence-chain-api"

// 新增类型定义
interface RoleBasedRequirement {
  evidence_type: string
  role: string
  status: "missing" | "partial" | "satisfied"
  slots: any[]
  core_slots_count: number
  core_slots_satisfied: number
  supplementary_slots_count: number
  supplementary_slots_satisfied: number
  core_completion_percentage: number
  supplementary_completion_percentage: number
}

interface RoleGroupRequirement {
  evidence_type: string
  type: "role_group"
  roles: string[]
  status: "missing" | "partial" | "satisfied"
  sub_requirements: RoleBasedRequirement[]
  core_slots_count: number
  core_slots_satisfied: number
  supplementary_slots_count: number
  supplementary_slots_satisfied: number
  core_completion_percentage: number
  supplementary_completion_percentage: number
}

interface OrGroupRequirement {
  evidence_type: string
  type: "or_group"
  sub_groups: (RoleGroupRequirement | EvidenceTypeRequirement)[]
  status: "missing" | "partial" | "satisfied"
  core_slots_count: number
  core_slots_satisfied: number
  supplementary_slots_count: number
  supplementary_slots_satisfied: number
  core_completion_percentage: number
  supplementary_completion_percentage: number
}

// 子分类类型
type SubCategory = {
  name: string
  slots: any[]
  core_slots_count: number
  core_slots_satisfied: number
  supplementary_slots_count: number
  supplementary_slots_satisfied: number
  status: "missing" | "partial" | "satisfied"
  role?: string
  type?: string
  roles?: string[]
  sub_requirements?: RoleBasedRequirement[]
}

// 联合类型
type EvidenceRequirement = EvidenceTypeRequirement | RoleGroupRequirement | OrGroupRequirement

// 添加滚动条样式
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f3f4f6;
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 4px;
    transition: background 0.2s ease;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
  
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #d1d5db #f3f4f6;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
  
  .custom-scrollbar::-webkit-scrollbar-corner {
    background: #f3f4f6;
  }
`

interface EvidenceChainDashboardProps {
  caseId: number
  onRefresh?: () => void
}

export function EvidenceChainDashboard({ caseId, onRefresh }: EvidenceChainDashboardProps) {
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

  const handleSlotClick = (slot: unknown, requirement: EvidenceTypeRequirement) => {
    const slotData = slot as { is_satisfied?: boolean; source_id?: number | string; source_type?: string }
    if (!slotData.is_satisfied || !slotData.source_id) return

    if (slotData.source_type === "evidence") {
      window.open(evidenceChainAPI.getEvidenceUrl(caseId, slotData.source_id as number), "_blank")
    } else if (slotData.source_type === "association_group") {
      window.open(evidenceChainAPI.getAssociationGroupUrl(caseId, slotData.source_id as string), "_blank")
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
      {/* 添加滚动条样式 */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      
      {/* 推荐证据链展示 */}
      {(() => {
        const activatedChains = dashboardData.chains.filter(chain => chain.is_activated)
        
        if (activatedChains.length === 0) {
          return null
        }
        
        const bestActivatedChain = activatedChains.reduce((best, current) => {
          return current.completion_percentage > best.completion_percentage ? current : best
        })
        
        return (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-900">
                    🎯 推荐证据链
                  </h2>
                  <p className="text-green-700">{bestActivatedChain.chain_name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600">
                  {bestActivatedChain.completion_percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-green-600">完成度</div>
              </div>
            </div>
            
            <div className="mt-4 w-full bg-green-100 rounded-full h-2">
              <div 
                className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${bestActivatedChain.completion_percentage}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-green-700">
              <span>🌟 核心特征: {bestActivatedChain.core_requirements_satisfied}/{bestActivatedChain.core_requirements_count}</span>
              <span className="bg-green-200 px-3 py-1 rounded-full text-green-800 font-medium">已激活</span>
            </div>
          </div>
        )
      })()}

      {/* 证据链列表 */}
      <div className="space-y-4">
        {dashboardData.chains
          .sort((a, b) => {
            if (a.is_feasible && !b.is_feasible) return -1
            if (!a.is_feasible && b.is_feasible) return 1
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

// 证据链卡片组件 - 使用侧边抽屉替代向下展开
interface EvidenceChainCardProps {
  chain: EvidenceChain
  caseId: number
  onSlotClick: (slot: unknown, requirement: EvidenceTypeRequirement) => void
}

function EvidenceChainCard({ chain, caseId, onSlotClick }: EvidenceChainCardProps) {
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false)
  const [drawerType, setDrawerType] = useState<'core' | 'auxiliary' | null>(null)
  const [expandedRequirements, setExpandedRequirements] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExpandedRequirements(new Set())
    setDrawerType(null)
  }, [chain.chain_id])

  // 当侧边抽屉打开时，禁用主页面的滚动
  useEffect(() => {
    if (isSideDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // 清理函数：组件卸载时恢复滚动
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isSideDrawerOpen])

  const toggleRequirement = (evidenceType: string) => {
    const newExpanded = new Set(expandedRequirements)
    if (newExpanded.has(evidenceType)) {
      newExpanded.delete(evidenceType)
    } else {
      newExpanded.add(evidenceType)
    }
    setExpandedRequirements(newExpanded)
  }

  const openSideDrawer = (type: 'core' | 'auxiliary') => {
    setDrawerType(type)
    setIsSideDrawerOpen(true)
    
    // 根据类型筛选并展开对应的证据类别
    let targetRequirements: string[] = []
    
    if (type === 'core') {
      // 核心证据：包含核心特征的分类
      targetRequirements = chain.requirements
        .filter(req => req.core_slots_count > 0)
        .map(req => req.evidence_type)
    } else {
      // 辅助证据：不包含核心特征的分类
      targetRequirements = chain.requirements
        .filter(req => req.core_slots_count === 0)
        .map(req => req.evidence_type)
    }
    
    setExpandedRequirements(new Set(targetRequirements))
  }

  const closeSideDrawer = () => {
    setIsSideDrawerOpen(false)
    setDrawerType(null)
    setExpandedRequirements(new Set())
  }

  const totalCategories = chain.core_requirements_count
  const activatedCategories = chain.core_requirements_satisfied
  const activationProgress = totalCategories > 0 ? (activatedCategories / totalCategories) * 100 : 0

  const getChainStatus = () => {
    if (chain.completion_percentage === 100) {
      return { status: 'completed', label: '已完成', color: 'green', icon: '🎯' }
    } else if (activationProgress === 100) {
      return { status: 'collecting', label: '收集中', color: 'blue', icon: '🔄' }
    } else {
      return { status: 'inactive', label: '未激活', color: 'gray', icon: '⏳' }
    }
  }

  const chainStatus = getChainStatus()

  // 获取已完成的分类
  const completedCategories = chain.requirements
    .filter(req => req.core_slots_count > 0 && (req.core_completion_percentage === 100 || req.status === "satisfied"))

  // 统计核心和辅助证据类型的数量
  const coreEvidenceCount = chain.requirements.filter(req => req.core_slots_count > 0).length
  const auxiliaryEvidenceCount = chain.requirements.filter(req => req.core_slots_count === 0).length

  return (
    <>
      <div className={`bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md ${
        chainStatus.status === 'completed' ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50' :
        chainStatus.status === 'collecting' ? 'border-blue-300 bg-blue-50' :
        'border-gray-200 bg-white'
      }`}>
        {/* 卡片头部 - 垂直居中布局 */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-lg font-bold text-gray-900">{chain.chain_name}</h3>
              </div>
              
              {/* 进度信息行 */}
              <div className="flex items-center gap-6">
                {/* 步骤指示器 */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalCategories }, (_, index) => (
                    <div
                      key={index}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                        index < activatedCategories
                          ? 'bg-green-500 border-green-600 text-white shadow-sm' 
                          : 'bg-gray-100 border-gray-300 text-gray-500'
                      }`}
                    >
                      {index < activatedCategories ? '✓' : index + 1}
                    </div>
                  ))}
                </div>
                
                {/* 完成统计 */}
                <div className="text-sm text-gray-600">
                  已完成 {activatedCategories}/{totalCategories} 个核心证据
                </div>
              </div>
            </div>
            
            {/* 右侧展开按钮 */}
            <div className="flex items-center gap-4">
              {/* 右侧展开按钮 - 垂直排列 */}
              <div className="flex flex-col gap-2">
                {/* 查看核心证据按钮 */}
                <button
                  onClick={() => openSideDrawer('core')}
                  disabled={coreEvidenceCount === 0}
                  className={`group flex items-center gap-2 text-sm py-2 px-3 rounded-lg transition-all duration-300 border-2 relative overflow-hidden whitespace-nowrap ${
                    coreEvidenceCount > 0
                      ? 'text-blue-700 hover:text-blue-900 hover:bg-blue-50 border-blue-300 hover:border-blue-400 hover:shadow-md hover:shadow-blue-100 transform hover:-translate-x-1'
                      : 'text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {/* 背景渐变效果 */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-blue-50 to-blue-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                    coreEvidenceCount === 0 ? 'hidden' : ''
                  }`}></div>
                  
                  {/* 按钮内容 */}
                  <div className="relative z-10 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">核心证据 ({coreEvidenceCount})</span>
                  </div>
                  
                  {/* 向右展开的箭头组 */}
                  <div className={`relative z-10 flex items-center gap-1 ${
                    coreEvidenceCount === 0 ? 'hidden' : ''
                  }`}>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300 delay-75" />
                  </div>
                  
                  {/* 右侧高亮边框 */}
                  <div className={`absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                    coreEvidenceCount === 0 ? 'hidden' : ''
                  }`}></div>
                </button>
                
                {/* 查看辅助证据按钮 */}
                <button
                  onClick={() => openSideDrawer('auxiliary')}
                  disabled={auxiliaryEvidenceCount === 0}
                  className={`group flex items-center gap-2 text-sm py-2 px-3 rounded-lg transition-all duration-300 border-2 relative overflow-hidden whitespace-nowrap ${
                    auxiliaryEvidenceCount > 0
                      ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50 border-gray-300 hover:border-gray-400 hover:shadow-md hover:shadow-gray-100 transform hover:-translate-x-1'
                      : 'text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {/* 背景渐变效果 */}
                  <div className={`absolute inset-0 bg-gradient-to-r from-gray-50 to-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                    auxiliaryEvidenceCount === 0 ? 'hidden' : ''
                  }`}></div>
                  
                  {/* 按钮内容 */}
                  <div className="relative z-10 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span className="font-medium">辅助证据 ({auxiliaryEvidenceCount})</span>
                  </div>
                  
                  {/* 向右展开的箭头组 */}
                  <div className={`relative z-10 flex items-center gap-1 ${
                    auxiliaryEvidenceCount === 0 ? 'hidden' : ''
                  }`}>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300 delay-75" />
                  </div>
                  
                  {/* 右侧高亮边框 */}
                  <div className={`absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-400 to-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                    auxiliaryEvidenceCount === 0 ? 'hidden' : ''
                  }`}></div>
                </button>
              </div>
            </div>
          </div>
          

          

        </div>
        
        {/* 移除底部操作按钮区域 */}
      </div>

      {/* 侧边抽屉 - 根据类型显示不同内容 */}
      <SideDrawer
        isOpen={isSideDrawerOpen}
        onClose={closeSideDrawer}
        chain={chain}
        drawerType={drawerType}
        expandedRequirements={expandedRequirements}
        onToggleRequirement={toggleRequirement}
        onSlotClick={onSlotClick}
      />
    </>
  )
}

// 侧边抽屉组件
interface SideDrawerProps {
  isOpen: boolean
  onClose: () => void
  chain: EvidenceChain
  drawerType: 'core' | 'auxiliary' | null
  expandedRequirements: Set<string>
  onToggleRequirement: (evidenceType: string) => void
  onSlotClick: (slot: unknown, requirement: EvidenceTypeRequirement) => void
}

function SideDrawer({ isOpen, onClose, chain, drawerType, expandedRequirements, onToggleRequirement, onSlotClick }: SideDrawerProps) {
  // 根据类型筛选证据分类
  const filteredRequirements = chain.requirements.filter(req => {
    if (drawerType === 'core') {
      return req.core_slots_count > 0 // 核心证据：包含核心特征
    } else if (drawerType === 'auxiliary') {
      return req.core_slots_count === 0 // 辅助证据：不包含核心特征
    }
    return false
  })

  // 获取类型标题和描述
  const getTypeInfo = () => {
    if (drawerType === 'core') {
      return {
        title: '核心证据类型',
        description: '包含核心特征的证据分类',
        icon: '🎯',
        color: 'blue'
      }
    } else if (drawerType === 'auxiliary') {
      return {
        title: '辅助证据类型',
        description: '不包含核心特征的证据分类',
        icon: '📋',
        color: 'gray'
      }
    }
    return { title: '', description: '', icon: '', color: 'gray' }
  }

  const typeInfo = getTypeInfo()

  return (
    <>
      {/* 遮罩层 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      {/* 侧边抽屉 */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          // 确保侧边抽屉的滚动条样式
          scrollbarWidth: 'thin',
          scrollbarColor: '#d1d5db #f3f4f6'
        }}
      >
        {/* 抽屉头部 */}
        <div className={`flex items-center justify-between p-6 border-b border-gray-200 ${
          drawerType === 'core' ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{typeInfo.icon}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{typeInfo.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{typeInfo.description}</p>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              证据链：{chain.chain_name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        {/* 抽屉内容 - 修复滚动问题 */}
        <div 
          className="overflow-y-auto custom-scrollbar" 
          style={{ 
            height: 'calc(100vh - 120px)',
            maxHeight: 'calc(100vh - 120px)'
          }}
        >
          <div className="p-8 pb-12">
            {filteredRequirements.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📭</div>
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {drawerType === 'core' ? '暂无核心证据类型' : '暂无辅助证据类型'}
                </h3>
                <p className="text-sm text-gray-500">
                  {drawerType === 'core' 
                    ? '该证据链中还没有包含核心特征的证据分类' 
                    : '该证据链中还没有不包含核心特征的证据分类'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredRequirements
                  .sort((a, b) => {
                    const aHasCore = a.core_slots_count > 0
                    const bHasCore = b.core_slots_count > 0
                    if (aHasCore && !bHasCore) return -1
                    if (!aHasCore && bHasCore) return 1
                    return (b.core_completion_percentage || 0) - (a.core_completion_percentage || 0)
                  })
                  .map((requirement) => (
                    <EvidenceRequirementCard
                      key={requirement.evidence_type}
                      requirement={requirement}
                      onSlotClick={onSlotClick}
                      isExpanded={expandedRequirements.has(requirement.evidence_type)}
                      onToggle={() => onToggleRequirement(requirement.evidence_type)}
                    />
                  ))}
                
                {/* 底部额外空间，确保最后一个元素完全显示 */}
                <div className="h-8"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// 证据要求卡片组件 - 简化设计
interface EvidenceRequirementCardProps {
  requirement: EvidenceRequirement
  onSlotClick: (slot: unknown, requirement: EvidenceTypeRequirement) => void
  isExpanded: boolean
  onToggle: () => void
}

function EvidenceRequirementCard({ requirement, onSlotClick, isExpanded, onToggle }: EvidenceRequirementCardProps) {
  // 类型守卫函数
  const isRoleGroupType = (req: EvidenceRequirement): req is RoleGroupRequirement => {
    return 'type' in req && req.type === 'role_group'
  }
  
  const isOrGroupType = (req: EvidenceRequirement): req is OrGroupRequirement => {
    return 'type' in req && req.type === 'or_group'
  }
  
  const isEvidenceTypeRequirement = (req: EvidenceRequirement): req is EvidenceTypeRequirement => {
    return !('type' in req) || (req.type !== 'role_group' && req.type !== 'or_group')
  }

  // 根据类型获取相应的数据
  const getRequirementData = () => {
    if (isRoleGroupType(requirement)) {
      return {
        evidence_type: requirement.evidence_type,
        status: requirement.status,
        core_slots_count: requirement.core_slots_count,
        core_slots_satisfied: requirement.core_slots_satisfied,
        supplementary_slots_count: requirement.supplementary_slots_count,
        supplementary_slots_satisfied: requirement.supplementary_slots_satisfied,
        core_completion_percentage: requirement.core_completion_percentage,
        supplementary_completion_percentage: requirement.supplementary_completion_percentage,
        slots: requirement.sub_requirements.flatMap(req => req.slots)
      }
    } else if (isOrGroupType(requirement)) {
      return {
        evidence_type: requirement.evidence_type,
        status: requirement.status,
        core_slots_count: requirement.core_slots_count,
        core_slots_satisfied: requirement.core_slots_satisfied,
        supplementary_slots_count: requirement.supplementary_slots_count,
        supplementary_slots_satisfied: requirement.supplementary_slots_satisfied,
        core_completion_percentage: requirement.core_completion_percentage,
        supplementary_completion_percentage: requirement.supplementary_completion_percentage,
        slots: requirement.sub_groups.flatMap(group => 
          isRoleGroupType(group) 
            ? group.sub_requirements.flatMap(req => req.slots)
            : group.slots
        )
      }
    } else {
      // EvidenceTypeRequirement
      return {
        evidence_type: requirement.evidence_type,
        status: requirement.status,
        core_slots_count: requirement.core_slots_count,
        core_slots_satisfied: requirement.core_slots_satisfied,
        supplementary_slots_count: requirement.supplementary_slots_count,
        supplementary_slots_satisfied: requirement.supplementary_slots_satisfied,
        core_completion_percentage: requirement.core_completion_percentage,
        supplementary_completion_percentage: requirement.supplementary_completion_percentage,
        slots: requirement.slots
      }
    }
  }

  const requirementData = getRequirementData()
  
  // 检查是否是"或"关系类型
  const isOrRelationshipType = requirementData.evidence_type.includes(' 或 ')
  
  // 检查是否是角色组类型
  const isRoleGroupTypeCheck = isRoleGroupType(requirement)
  
  const getSubCategories = (): SubCategory[] => {
    if (!isOrRelationshipType && !isRoleGroupTypeCheck) return []
    
    if (isRoleGroupType(requirement)) {
      // 角色组：直接返回sub_requirements
      return requirement.sub_requirements.map(req => ({
        name: req.evidence_type,
        slots: req.slots,
        core_slots_count: req.core_slots_count,
        core_slots_satisfied: req.core_slots_satisfied,
        supplementary_slots_count: req.supplementary_slots_count,
        supplementary_slots_satisfied: req.supplementary_slots_satisfied,
        status: req.status,
        role: req.role
      }))
    } else if (isOrGroupType(requirement)) {
      // 或组：处理sub_groups，保持evidence_type分组层
      return requirement.sub_groups.map(group => {
        if (isRoleGroupType(group)) {
          // 如果sub_group是role_group，保持分组结构
          return {
            name: group.evidence_type,
            type: 'role_group',
            roles: group.roles,
            status: group.status,
            sub_requirements: group.sub_requirements,
            core_slots_count: group.core_slots_count,
            core_slots_satisfied: group.core_slots_satisfied,
            supplementary_slots_count: group.supplementary_slots_count,
            supplementary_slots_satisfied: group.supplementary_slots_satisfied,
            slots: group.sub_requirements.flatMap(req => req.slots)
          }
        } else {
          // 普通EvidenceTypeRequirement
          return {
            name: group.evidence_type,
            type: 'evidence',
            slots: group.slots,
            core_slots_count: group.core_slots_count,
            core_slots_satisfied: group.core_slots_satisfied,
            supplementary_slots_count: group.supplementary_slots_count,
            supplementary_slots_satisfied: group.supplementary_slots_satisfied,
            status: group.status
          }
        }
      })
    }
    
    return []
  }

  const subCategories = getSubCategories()

  const getGroupCompletion = () => {
    if (isOrGroupType(requirement)) {
      // or_group逻辑：组内其一完整，则组完整
      const hasCompletedCategory = requirement.sub_groups.some(group => {
        if (isRoleGroupType(group)) {
          return group.core_slots_count > 0 && group.core_slots_satisfied === group.core_slots_count
        } else {
          return group.core_slots_count > 0 && group.core_slots_satisfied === group.core_slots_count
        }
      })
      
      if (hasCompletedCategory) return 100
      return requirement.core_completion_percentage
    } else if (isRoleGroupType(requirement)) {
      // role_group逻辑：组内全部完整，则组完整
      const allCategoriesCompleted = requirement.sub_requirements.every(req => 
        req.core_slots_count > 0 && req.core_slots_satisfied === req.core_slots_count
      )
      
      if (allCategoriesCompleted) return 100
      return requirement.core_completion_percentage
    }
    
    return requirementData.core_completion_percentage
  }

  const getGroupStatus = () => {
    if (isOrGroupType(requirement)) {
      // or_group逻辑：直接使用后端返回的状态，因为后端已经正确计算了or_group的逻辑
      return requirement.status
    } else if (isRoleGroupType(requirement)) {
      // role_group逻辑：直接使用后端返回的状态
      return requirement.status
    }
    
    return requirementData.status
  }

  const groupCompletion = getGroupCompletion()
  const groupStatus = getGroupStatus()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "satisfied":
        return (
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center border border-green-200">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        )
      case "partial":
        return (
          <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center border border-yellow-200">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
        )
      case "missing":
        return (
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center border border-red-200">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
            <XCircle className="w-5 h-5 text-gray-500" />
          </div>
        )
    }
  }

  // 格式化证据类型名称
  const formatEvidenceTypeName = (name: string) => {
    return name
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg transition-all duration-300 ${
      isExpanded ? 'border-blue-300 shadow-sm' : 'border-gray-200'
    }`}>
      {/* 卡片头部 */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-medium text-gray-900">{formatEvidenceTypeName(requirementData.evidence_type)}</h4>
            </div>
          </div>
          
          {/* 右侧状态区域 */}
          <div className="flex items-center gap-3">
            {/* 快捷跳转按钮 - 统一放在右上角，增大尺寸 */}
            {!isOrRelationshipType && !isRoleGroupTypeCheck && requirementData.slots.some(slot => 
              slot.is_satisfied && slot.source_id && slot.source_type !== "none"
            ) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const jumpableSlot = requirementData.slots.find(slot => 
                    slot.is_satisfied && slot.source_id && slot.source_type !== "none"
                  )
                  if (jumpableSlot) {
                    // 创建一个临时的EvidenceTypeRequirement用于onSlotClick
                    const tempRequirement: EvidenceTypeRequirement = {
                      evidence_type: requirementData.evidence_type,
                      status: requirementData.status,
                      slots: requirementData.slots,
                      core_slots_count: requirementData.core_slots_count,
                      core_slots_satisfied: requirementData.core_slots_satisfied,
                      supplementary_slots_count: requirementData.supplementary_slots_count,
                      supplementary_slots_satisfied: requirementData.supplementary_slots_satisfied,
                      core_completion_percentage: requirementData.core_completion_percentage,
                      supplementary_completion_percentage: requirementData.supplementary_completion_percentage
                    }
                    onSlotClick(jumpableSlot, tempRequirement)
                  }
                }}
                className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 hover:border-blue-300"
                title="查看关联证据"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}
            
            {/* 状态图标 - 调大尺寸 */}
            <div className="flex-shrink-0">
              {getStatusIcon(isOrRelationshipType || isRoleGroupTypeCheck ? groupStatus : requirementData.status)}
            </div>
            
            {/* 展开/收起图标 */}
            <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* 展开的详细内容 */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-6 bg-gray-50">
          {isOrRelationshipType || isRoleGroupTypeCheck ? (
            // 或关系类型或角色组类型：展示子分类 - 优化间距和层次
            <div className="space-y-6">
              {subCategories.map((subCategory, index) => {
                // 检查是否是role_group类型
                const isSubCategoryRoleGroup = subCategory.type === 'role_group'
                
                return (
                  <div key={index} className="border rounded-lg p-5 bg-white border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <h5 className="font-medium text-gray-700">
                          {/* 简化名称，移除重复的角色说明 */}
                          {subCategory.name.replace(/\([^)]+\)/, '').trim()}
                        </h5>
                        {/* 如果是role_group，显示角色信息 - 优化显示 */}
                        {isSubCategoryRoleGroup && subCategory.roles && (
                          <div className="flex items-center gap-2">
                            {/* 移除冗余的角色描述，卡片内已经足够清晰 */}
                          </div>
                        )}
                      </div>
                      
                      {/* 右侧操作区域 - 状态图标和快捷跳转按钮 */}
                      <div className="flex items-center gap-3">
                        {/* 状态图标 - 统一放在右上角，带背景 */}
                        <div className="flex-shrink-0">
                          {getStatusIcon(subCategory.status)}
                        </div>
                        
                        {/* 快捷跳转按钮 - 统一放在右上角，增大尺寸 */}
                        {!isSubCategoryRoleGroup && subCategory.slots.some((slot: any) => 
                          slot.is_satisfied && slot.source_id && slot.source_type !== "none"
                        ) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const jumpableSlot = subCategory.slots.find((slot: any) => 
                                slot.is_satisfied && slot.source_id && slot.source_type !== "none"
                              )
                              if (jumpableSlot) {
                                // 创建一个临时的EvidenceTypeRequirement用于onSlotClick
                                const tempRequirement: EvidenceTypeRequirement = {
                                  evidence_type: subCategory.name,
                                  status: subCategory.status,
                                  slots: subCategory.slots,
                                  core_slots_count: subCategory.core_slots_count || 0,
                                  core_slots_satisfied: subCategory.core_slots_satisfied || 0,
                                  supplementary_slots_count: subCategory.supplementary_slots_count || 0,
                                  supplementary_slots_satisfied: subCategory.supplementary_slots_satisfied || 0,
                                  core_completion_percentage: 0,
                                  supplementary_completion_percentage: 0
                                }
                                onSlotClick(jumpableSlot, tempRequirement)
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 hover:border-blue-300"
                            title="查看关联证据"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {isSubCategoryRoleGroup && subCategory.sub_requirements ? (
                      // 如果是role_group，显示角色要求 - 优化样式和标签
                      <div className="space-y-6">
                        {subCategory.sub_requirements.map((roleReq, roleIndex) => (
                          <div key={roleIndex} className="border border-blue-100 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-800">
                                  {/* 简化名称，移除重复的角色说明 */}
                                  {roleReq.evidence_type.replace(/\([^)]+\)/, '').trim()}
                                </span>
                                {/* 角色标识 - 使用中文，更简洁，移除重复 */}
                                <span className={`text-xs px-3 py-1.5 rounded-full font-medium shadow-sm ${
                                  roleReq.role === 'creditor'
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                    : 'bg-green-100 text-green-700 border border-green-200'
                                }`}>
                                  {roleReq.role === 'creditor' ? '债权人' : '债务人'}
                                </span>
                              </div>
                              
                              {/* 右侧操作区域 - 状态图标和快捷跳转按钮 */}
                              <div className="flex items-center gap-3">
                                {/* 状态图标 - 统一放在右上角，带背景 */}
                                <div className="flex-shrink-0">
                                  {getStatusIcon(roleReq.status)}
                                </div>
                                
                                {/* 快捷跳转按钮 - 统一放在右上角，增大尺寸 */}
                                {roleReq.slots.some((slot: any) => 
                                  slot.is_satisfied && slot.source_id && slot.source_type !== "none"
                                ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const jumpableSlot = roleReq.slots.find((slot: any) => 
                                        slot.is_satisfied && slot.source_id && slot.source_type !== "none"
                                      )
                                      if (jumpableSlot) {
                                        // 创建一个临时的EvidenceTypeRequirement用于onSlotClick
                                        const tempRequirement: EvidenceTypeRequirement = {
                                          evidence_type: roleReq.evidence_type,
                                          status: roleReq.status,
                                          slots: roleReq.slots,
                                          core_slots_count: roleReq.core_slots_count,
                                          core_slots_satisfied: roleReq.core_slots_satisfied,
                                          supplementary_slots_count: roleReq.supplementary_slots_count,
                                          supplementary_slots_satisfied: roleReq.supplementary_slots_satisfied,
                                          core_completion_percentage: roleReq.core_completion_percentage,
                                          supplementary_completion_percentage: roleReq.supplementary_completion_percentage
                                        }
                                        onSlotClick(jumpableSlot, tempRequirement)
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 hover:border-blue-300"
                                    title="查看关联证据"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              {/* 核心特征 */}
                              {roleReq.core_slots_count > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-blue-600 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span>核心特征 ({roleReq.core_slots_satisfied}/{roleReq.core_slots_count})</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    {roleReq.slots.filter((slot: any) => slot.is_core).map((slot: any, slotIndex: number) => (
                                      <SlotItem
                                        key={slotIndex}
                                        slot={slot}
                                        requirement={{
                                          evidence_type: roleReq.evidence_type,
                                          status: roleReq.status,
                                          slots: roleReq.slots,
                                          core_slots_count: roleReq.core_slots_count,
                                          core_slots_satisfied: roleReq.core_slots_satisfied,
                                          supplementary_slots_count: roleReq.supplementary_slots_count,
                                          supplementary_slots_satisfied: roleReq.supplementary_slots_satisfied,
                                          core_completion_percentage: roleReq.core_completion_percentage,
                                          supplementary_completion_percentage: roleReq.supplementary_completion_percentage
                                        }}
                                        onSlotClick={onSlotClick}
                                        isCore={true}
                                        showSourceButton={false}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* 补充特征 */}
                              {roleReq.supplementary_slots_count > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-gray-600 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span>补充特征 ({roleReq.supplementary_slots_satisfied}/{roleReq.supplementary_slots_count})</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    {roleReq.slots.filter((slot: any) => !slot.is_core).map((slot: any, slotIndex: number) => (
                                      <SlotItem
                                        key={slotIndex}
                                        slot={slot}
                                        requirement={{
                                          evidence_type: roleReq.evidence_type,
                                          status: roleReq.status,
                                          slots: roleReq.slots,
                                          core_slots_count: roleReq.core_slots_count,
                                          core_slots_satisfied: roleReq.core_slots_satisfied,
                                          supplementary_slots_count: roleReq.supplementary_slots_count,
                                          supplementary_slots_satisfied: roleReq.supplementary_slots_satisfied,
                                          core_completion_percentage: roleReq.core_completion_percentage,
                                          supplementary_completion_percentage: roleReq.supplementary_completion_percentage
                                        }}
                                        onSlotClick={onSlotClick}
                                        isCore={false}
                                        showSourceButton={false}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // 普通evidence_type，直接显示槽位
                      <div className="space-y-2">
                        {/* 核心特征 */}
                        {subCategory.core_slots_count > 0 && (
                          <div>
                            <div className="text-xs font-medium text-blue-600 mb-2">
                              <span>核心特征 ({subCategory.core_slots_satisfied}/{subCategory.core_slots_count})</span>
                            </div>
                            <div className="space-y-1">
                              {subCategory.slots.filter((slot: any) => slot.is_core).map((slot: any, slotIndex: number) => (
                                <SlotItem
                                  key={slotIndex}
                                  slot={slot}
                                  requirement={{
                                    evidence_type: subCategory.name,
                                    status: subCategory.status,
                                    slots: subCategory.slots,
                                    core_slots_count: subCategory.core_slots_count || 0,
                                    core_slots_satisfied: subCategory.core_slots_satisfied || 0,
                                    supplementary_slots_count: subCategory.supplementary_slots_count || 0,
                                    supplementary_slots_satisfied: subCategory.supplementary_slots_satisfied || 0,
                                    core_completion_percentage: 0,
                                    supplementary_completion_percentage: 0
                                  }}
                                  onSlotClick={onSlotClick}
                                  isCore={true}
                                  showSourceButton={false}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 补充特征 */}
                        {subCategory.supplementary_slots_count > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-2">
                              <span>补充特征 ({subCategory.supplementary_slots_satisfied}/{subCategory.supplementary_slots_count})</span>
                            </div>
                            <div className="space-y-1">
                              {subCategory.slots.filter((slot: any) => !slot.is_core).map((slot: any, slotIndex: number) => (
                                <SlotItem
                                  key={slotIndex}
                                  slot={slot}
                                  requirement={{
                                    evidence_type: subCategory.name,
                                    status: subCategory.status,
                                    slots: subCategory.slots,
                                    core_slots_count: subCategory.core_slots_count || 0,
                                    core_slots_satisfied: subCategory.core_slots_satisfied || 0,
                                    supplementary_slots_count: subCategory.supplementary_slots_count || 0,
                                    supplementary_slots_satisfied: subCategory.supplementary_slots_satisfied || 0,
                                    core_completion_percentage: 0,
                                    supplementary_completion_percentage: 0
                                  }}
                                  onSlotClick={onSlotClick}
                                  isCore={false}
                                  showSourceButton={false}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // 非"或"关系类型
            <>
              {/* 核心特征 */}
              {requirementData.core_slots_count > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-blue-600 mb-2">
                    <span>核心特征 ({requirementData.core_slots_satisfied}/{requirementData.core_slots_count})</span>
                  </div>
                  <div className="space-y-2">
                    {requirementData.slots.filter(slot => slot.is_core).map((slot, slotIndex) => (
                      <SlotItem
                        key={slotIndex}
                        slot={slot}
                        requirement={{
                          evidence_type: requirementData.evidence_type,
                          status: requirementData.status,
                          slots: requirementData.slots,
                          core_slots_count: requirementData.core_slots_count,
                          core_slots_satisfied: requirementData.core_slots_satisfied,
                          supplementary_slots_count: requirementData.supplementary_slots_count,
                          supplementary_slots_satisfied: requirementData.supplementary_slots_satisfied,
                          core_completion_percentage: requirementData.core_completion_percentage,
                          supplementary_completion_percentage: requirementData.supplementary_completion_percentage
                        }}
                        onSlotClick={onSlotClick}
                        isCore={true}
                        showSourceButton={false}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 补充特征 */}
              {requirementData.supplementary_slots_count > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    <span>补充特征 ({requirementData.supplementary_slots_satisfied}/{requirementData.supplementary_slots_count})</span>
                  </div>
                  <div className="space-y-2">
                    {requirementData.slots.filter(slot => !slot.is_core).map((slot, slotIndex) => (
                      <SlotItem
                        key={slotIndex}
                        slot={slot}
                        requirement={{
                          evidence_type: requirementData.evidence_type,
                          status: requirementData.status,
                          slots: requirementData.slots,
                          core_slots_count: requirementData.core_slots_count,
                          core_slots_satisfied: requirementData.core_slots_satisfied,
                          supplementary_slots_count: requirementData.supplementary_slots_count,
                          supplementary_slots_satisfied: requirementData.supplementary_slots_satisfied,
                          core_completion_percentage: requirementData.core_completion_percentage,
                          supplementary_completion_percentage: requirementData.supplementary_completion_percentage
                        }}
                        onSlotClick={onSlotClick}
                        isCore={false}
                        showSourceButton={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// 槽位项组件 - 保持简洁
interface SlotItemProps {
  slot: unknown
  requirement: EvidenceTypeRequirement
  onSlotClick: (slot: unknown, requirement: EvidenceTypeRequirement) => void
  isCore: boolean
  showSourceButton?: boolean
}

function SlotItem({ slot, requirement, onSlotClick, isCore, showSourceButton = true }: SlotItemProps) {
  const slotData = slot as {
    slot_name: string;
    is_satisfied: boolean;
    source_id?: string;
    source_type?: string;
    slot_proofread_at?: string;
    slot_is_consistent?: boolean;
    slot_expected_value?: string;
    slot_proofread_reasoning?: string;
  };
  
  // 清理特征名称，去除重复的分类信息前缀 - 优化清理逻辑
  const cleanSlotName = (slotName: string, evidenceType: string): string => {
    if (!slotName || !evidenceType) return slotName;
    
    // 处理"或"关系的证据类型
    if (evidenceType.includes(' 或 ')) {
      const types = evidenceType.split(' 或 ').map(t => t.trim());
      for (const type of types) {
        const prefix = type + ': ';
        if (slotName.startsWith(prefix)) {
          return slotName.substring(prefix.length);
        }
      }
    }
    
    // 处理角色组的证据类型（如"微信个人主页 (creditor) 和 微信个人主页 (debtor)"）
    if (evidenceType.includes(' 和 ')) {
      const types = evidenceType.split(' 和 ').map(t => t.trim());
      for (const type of types) {
        const prefix = type + ': ';
        if (slotName.startsWith(prefix)) {
          return slotName.substring(prefix.length);
        }
      }
    }
    
    // 处理单一证据类型
    const prefix = evidenceType + ': ';
    if (slotName.startsWith(prefix)) {
      return slotName.substring(prefix.length);
    }
    
    return slotName;
  };
  
  const cleanedSlotName = cleanSlotName(slotData.slot_name, requirement.evidence_type);
  
  return (
    <div className={`flex items-center justify-between p-2 rounded-md transition-colors ${
      isCore 
        ? 'bg-blue-50 border border-blue-100' 
        : 'bg-gray-50 border border-gray-100'
    } ${slotData.is_satisfied ? 'hover:bg-opacity-80' : 'hover:bg-opacity-60'}`}>
      <div className="flex items-center gap-3 text-sm min-w-0 flex-1">
        {slotData.is_satisfied ? (
          <CheckCircle className={`w-4 h-4 flex-shrink-0 ${
            isCore ? 'text-green-600' : 'text-green-500'
          }`} />
        ) : (
          <XCircle className={`w-4 h-4 flex-shrink-0 ${
            isCore ? 'text-red-600' : 'text-red-400'
          }`} />
        )}
        <span className={`truncate ${
          slotData.is_satisfied 
            ? (isCore ? 'text-green-800 font-medium' : 'text-green-700') 
            : (isCore ? 'text-red-800 font-medium' : 'text-red-600')
        }`}>
           {cleanedSlotName}
         </span>
         {showSourceButton && slotData.is_satisfied && slotData.source_id && (
           <button
             onClick={() => onSlotClick(slot, requirement)}
             className="ml-2 text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 flex-shrink-0"
             title={`查看来源: ${slotData.source_type === 'evidence' ? '证据' : '关联组'} ${slotData.source_id}`}
           >
             <ExternalLink className="w-3 h-3" />
           </button>
         )}
      </div>
      
      {/* 校对信息提示 - 优化显示 */}
      {slotData.slot_proofread_at && !slotData.slot_is_consistent && slotData.slot_expected_value && (
        <div className="flex items-center gap-2 min-w-0 flex-1 ml-4">
          <span className="text-xs text-gray-500 break-words min-w-0 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
            校对失败: {slotData.slot_proofread_reasoning || '无校对推理信息'}
          </span>
        </div>
      )}
    </div>
  )
}