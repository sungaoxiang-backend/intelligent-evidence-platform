import type { Case, User, ApiResponse, PaginationParams } from "./types"
import { API_CONFIG } from "./config"

console.log("API_CONFIG.BASE_URL =", API_CONFIG.BASE_URL)

function getAuthHeader(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(API_CONFIG.TOKEN_KEY) || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  return {}
}

function buildApiUrl(path: string): string {
  return API_CONFIG.BASE_URL + path
}

export const caseApi = {
  async getCases(params: PaginationParams & { user_id?: number }): Promise<{ data: Case[]; pagination?: any }> {
    const { page = 1, pageSize = 20, search = "", user_id } = params
    const skip = (page - 1) * pageSize
    let url = buildApiUrl(`/cases?skip=${skip}&limit=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`)
    
    // Add user_id parameter if provided
    if (user_id) {
      url += `&user_id=${user_id}`
    }
    
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data, pagination: result.pagination }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getCaseById(id: number): Promise<{ data: Case }> {
    const url = buildApiUrl(`/cases/${id}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async createCase(data: Partial<Case>): Promise<{ data: Case }> {
    const url = buildApiUrl(`/cases`)
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async updateCase(id: number, data: Partial<Case>): Promise<{ data: Case }> {
    const url = buildApiUrl(`/cases/${id}`)
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async deleteCase(id: number): Promise<void> {
    const url = buildApiUrl(`/cases/${id}`)
    const resp = await fetch(url, {
      method: "DELETE",
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async autoProcess(data: { case_id: number; evidence_ids: number[] }): Promise<any> {
    const url = buildApiUrl(`/cases/auto-process`)
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async updateAssociationEvidenceFeature(featureId: number, data: any): Promise<any> {
    const url = buildApiUrl(`/cases/association-features/${featureId}`)
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getAssociationEvidenceFeature(featureId: number): Promise<any> {
    const url = buildApiUrl(`/cases/association-features/${featureId}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },
}

export const userApi = {
  async getUsers(params: PaginationParams): Promise<ApiResponse<User[]>> {
    const { page = 1, pageSize = 20, search = "" } = params
    const skip = (page - 1) * pageSize
    const url = buildApiUrl(`/users?skip=${skip}&limit=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getUserById(id: string): Promise<ApiResponse<User>> {
    const url = buildApiUrl(`/users/${id}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return {
        success: true,
        data: result.data,
      }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async updateUser(id: string, updates: Partial<User>): Promise<ApiResponse<User>> {
    const url = buildApiUrl(`/users/${id}`)
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(updates),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return {
        success: true,
        data: result.data,
      }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },
}

// 证据类型定义
export interface Evidence {
  id: number
  case_id: number
  file_url: string
  file_name: string
  file_size: number
  file_extension: string
  evidence_type?: string
  classification_confidence?: number
  classification_reasoning?: string
  is_classified: boolean
  individual_features?: {
    evidence_type?: string
    confidence?: number
    reasoning?: string
    feature_extraction?: {
      evidence_type?: string
      extracted_slots?: Array<{
        slot_name: string
        slot_value: string
        confidence: number
        reasoning: string
        from_urls?: string[]
      }>
      consider_correlations?: boolean
    }
  }
  feature_extraction?: any
  created_at: string
  updated_at: string
}

export interface EvidenceWithCase extends Evidence {
  case?: any // 可进一步细化为 Case 类型
}

export interface EvidenceUploadParams {
  case_id: number
  files: File[]
  withClassification?: boolean
}

export interface EvidenceUpdateParams {
  evidence_type?: string
  classification_confidence?: number
  classification_reasoning?: string
  is_classified?: boolean
}

export const evidenceApi = {
  async getEvidences(params: { page?: number; pageSize?: number; search?: string; case_id?: number }) {
    const { page = 1, pageSize = 20, search = "", case_id } = params
    const skip = (page - 1) * pageSize
    const limit = pageSize
    let url = buildApiUrl(`/evidences?skip=${skip}&limit=${limit}`)
    if (search) url += `&search=${encodeURIComponent(search)}`
    if (case_id !== undefined && case_id !== null) url += `&case_id=${case_id}`
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return result
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getEvidencesByIds(evidenceIds: number[]) {
    if (evidenceIds.length === 0) return { data: [] }
    
    const params = new URLSearchParams()
    evidenceIds.forEach(id => params.append('evidence_ids', id.toString()))
    
    const url = buildApiUrl(`/evidences?${params.toString()}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return result
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getEvidenceById(id: number, withCase = false): Promise<{ data: Evidence | EvidenceWithCase }> {
    const url = buildApiUrl(`/evidences/${id}${withCase ? '/with-case' : ''}`)
    const resp = await fetch(url, {
      headers: getAuthHeader(),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async uploadEvidences(params: EvidenceUploadParams): Promise<{ data: Evidence[]; pagination?: any }> {
    const formData = new FormData()
    formData.append("case_id", String(params.case_id))
    params.files.forEach(file => formData.append("files", file))
    const url = buildApiUrl(`/evidences${params.withClassification ? '/batch-with-classification' : '/batch'}`)
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    })
    const result = await resp.json()
    if (result.code === 200 || resp.status === 201) {
      return { data: result.data, pagination: result.pagination }
    } else {
      throw new Error(result.message || "上传失败")
    }
  },

  async updateEvidence(id: number, data: EvidenceUpdateParams): Promise<{ data: Evidence }> {
    const url = buildApiUrl(`/evidences/${id}`)
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "更新失败")
    }
  },

  async deleteEvidence(id: number): Promise<void> {
    const url = buildApiUrl(`/evidences/${id}`)
    const resp = await fetch(url, {
      method: "DELETE",
      headers: getAuthHeader(),
    })
    if (resp.status === 204) {
      return
    } else {
      const result = await resp.json()
      throw new Error(result.message || "删除失败")
    }
  },

  async batchDeleteEvidences(ids: number[]): Promise<void> {
    const url = buildApiUrl(`/evidences/batch-delete`)
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ evidence_ids: ids }),
    })
    const result = await resp.json()
    if (result.code === 200) {
      return
    } else {
      throw new Error(result.message || "批量删除失败")
    }
  },

  async classifyEvidencesByUrls(urls: string[]): Promise<any> {
    const url = buildApiUrl(`/agentic/classification-by-urls`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ urls }),
    });
    const result = await resp.json();
    if (result.code === 200) {
      return result.data;
    } else {
      throw new Error(result.message || '智能分类失败');
    }
  },

  async extractFeaturesByUrls(urls: string[], evidence_type: string = "微信聊天记录", consider_correlations: boolean = false): Promise<any> {
    const url = buildApiUrl(`/agentic/extract-features-by-urls`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ 
        urls, 
        evidence_type, 
        consider_correlations 
      }),
    });
    const result = await resp.json();
    if (result.code === 200) {
      return result.data;
    } else {
      throw new Error(result.message || '特征提取失败');
    }
  },

  async autoProcess(formData: FormData): Promise<{ data: Evidence[]; pagination?: any }> {
    const url = buildApiUrl(`/evidences/auto-process`);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        ...getAuthHeader(),
      },
      body: formData,
    });
    const result = await resp.json();
    if (result.code === 200 || resp.status === 201) {
      return { data: result.data, pagination: result.pagination };
    } else {
      throw new Error(result.message || "操作失败");
    }
  },

  async batchCheckEvidence(data: { evidence_ids: number[] }): Promise<{ data: Evidence[] }> {
    const url = buildApiUrl(`/evidences/batch-check`);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    const result = await resp.json();
    if (result.code === 200) {
      return { data: result.data };
    } else {
      throw new Error(result.message || "批量审核失败");
    }
  },
}
