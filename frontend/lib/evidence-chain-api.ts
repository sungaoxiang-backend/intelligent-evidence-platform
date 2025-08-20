"use client"

import { API_CONFIG } from "./config"
import { authService } from "./auth"

// 证据链相关类型定义
export interface EvidenceSlotDetail {
  slot_name: string
  is_satisfied: boolean
  is_core: boolean
  source_type: string
  source_id?: number | string | null
  confidence?: number | null
  
  // 校对相关字段
  slot_proofread_at?: string | null
  slot_is_consistent?: boolean | null
  slot_expected_value?: string | null
  slot_proofread_reasoning?: string | null
}

export interface EvidenceTypeRequirement {
  evidence_type: string
  status: 'missing' | 'partial' | 'satisfied'
  slots: EvidenceSlotDetail[]
  
  // 新增字段：核心特征和补充特征的完成情况
  core_slots_count: number
  core_slots_satisfied: number
  supplementary_slots_count: number
  supplementary_slots_satisfied: number
  core_completion_percentage: number
  supplementary_completion_percentage: number
}

export interface EvidenceChain {
  chain_id: string
  chain_name: string
  status: 'not_started' | 'in_progress' | 'completed'
  completion_percentage: number
  
  // 新增字段：可行性相关
  feasibility_status: 'incomplete' | 'feasible' | 'activated'
  feasibility_completion: number  // 可行性完成度（基于核心特征）
  supplementary_completion: number  // 补充特征完成度
  is_feasible: boolean  // 是否可行
  is_activated: boolean  // 是否已激活
  
  // 核心特征统计
  core_requirements_count: number  // 有核心特征要求的证据类型数量
  core_requirements_satisfied: number  // 核心特征完备的证据类型数量
  
  requirements: EvidenceTypeRequirement[]
}

export interface EvidenceChainDashboardData {
  case_id: number
  chains: EvidenceChain[]
  overall_completion: number
  
  // 可行性统计
  overall_feasibility_completion: number  // 整体可行性完成度
  feasible_chains_count: number  // 可行的证据链数量
  activated_chains_count: number  // 已激活的证据链数量
  
  total_requirements: number
  satisfied_requirements: number
  missing_requirements: number
}

export interface EvidenceChainTemplate {
  chain_id: string
  required_evidence_count: number
  evidence_types: {
    evidence_type: string
    required_slots: string[]
  }[]
}

export interface EvidenceChainTemplatesResponse {
  total_templates: number
  templates: EvidenceChainTemplate[]
}

class EvidenceChainAPI {
  private createHeaders(): HeadersInit {
    const token = authService.getToken()
    return {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  // 获取案件证据链看板
  async getCaseEvidenceChainDashboard(caseId: number): Promise<EvidenceChainDashboardData> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/chain/${caseId}/dashboard`, {
      method: "GET",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      throw new Error(`获取证据链看板失败: ${response.status}`)
    }

    return response.json()
  }

  // 获取证据链模板
  async getEvidenceChainTemplates(): Promise<EvidenceChainTemplatesResponse> {
    const response = await fetch(`${API_CONFIG.BASE_URL}/chain/templates`, {
      method: "GET",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      throw new Error(`获取证据链模板失败: ${response.status}`)
    }

    return response.json()
  }

  // 跳转到证据分析页面并选中指定证据
  getEvidenceUrl(caseId: number, evidenceId: number): string {
    return `/cases/${caseId}?tab=evidence&evidence=${evidenceId}`
  }

  // 跳转到关联证据分析页面并选中指定分组
  getAssociationGroupUrl(caseId: number, groupName: string): string {
    return `/cases/${caseId}?tab=reasoning&group=${encodeURIComponent(groupName)}`
  }

  // 跳转到独立的证据链分析页面
  getEvidenceChainUrl(caseId: number): string {
    return `/cases/${caseId}/evidence-chain`
  }
}

export const evidenceChainAPI = new EvidenceChainAPI()