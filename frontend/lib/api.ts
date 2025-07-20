import type { Case, User, ApiResponse, PaginationParams } from "./types"
import { API_CONFIG } from "./config"

export const caseApi = {
  async getCases(params: PaginationParams): Promise<{ data: Case[]; pagination?: any }> {
    const { page = 1, pageSize = 20, search = "" } = params
    const skip = (page - 1) * pageSize
    const url = `${API_CONFIG.BASE_URL}/cases?skip=${skip}&limit=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data, pagination: result.pagination }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getCaseById(id: number): Promise<{ data: Case }> {
    const url = `${API_CONFIG.BASE_URL}/cases/${id}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async createCase(data: Partial<Case>): Promise<{ data: Case }> {
    const url = `${API_CONFIG.BASE_URL}/cases`
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
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
    const url = `${API_CONFIG.BASE_URL}/cases/${id}`
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
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
    const url = `${API_CONFIG.BASE_URL}/cases/${id}`
    const resp = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
      },
    })
    const result = await resp.json()
    if (result.code === 200) {
      return
    } else {
      throw new Error(result.message || "请求失败")
    }
  },
}

export const userApi = {
  async getUsers(params: PaginationParams): Promise<ApiResponse<User[]>> {
    const { page = 1, pageSize = 20, search = "" } = params
    const skip = (page - 1) * pageSize
    const url = `${API_CONFIG.BASE_URL}/users?skip=${skip}&limit=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
    })
    const result = await resp.json()
    if (result.code === 200) {
      return {
        success: true,
        data: result.data,
        total: result.total,
      }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getUserById(id: string): Promise<ApiResponse<User>> {
    const url = `${API_CONFIG.BASE_URL}/users/${id}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
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
    const url = `${API_CONFIG.BASE_URL}/users/${id}`
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
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
  async getEvidences(params: { page?: number; pageSize?: number; search?: string; case_id?: number; withCase?: boolean }): Promise<{ data: Evidence[] | EvidenceWithCase[]; pagination?: any }> {
    const { page = 1, pageSize = 20, search = "", case_id, withCase } = params
    const skip = (page - 1) * pageSize
    let url = `${API_CONFIG.BASE_URL}/evidences${withCase ? '/with-cases' : ''}?skip=${skip}&limit=${pageSize}`
    if (search) url += `&search=${encodeURIComponent(search)}`
    if (case_id) url += `&case_id=${case_id}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
    })
    const result = await resp.json()
    if (result.code === 200) {
      return { data: result.data, pagination: result.pagination }
    } else {
      throw new Error(result.message || "请求失败")
    }
  },

  async getEvidenceById(id: number, withCase = false): Promise<{ data: Evidence | EvidenceWithCase }> {
    const url = `${API_CONFIG.BASE_URL}/evidences/${id}${withCase ? '/with-case' : ''}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
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
    const url = `${API_CONFIG.BASE_URL}/evidences${params.withClassification ? '/batch-with-classification' : '/batch'}`
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
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
    const url = `${API_CONFIG.BASE_URL}/evidences/${id}`
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
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
    const url = `${API_CONFIG.BASE_URL}/evidences/${id}`
    const resp = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}` },
    })
    if (resp.status === 204) {
      return
    } else {
      const result = await resp.json()
      throw new Error(result.message || "删除失败")
    }
  },

  async batchDeleteEvidences(ids: number[]): Promise<void> {
    const url = `${API_CONFIG.BASE_URL}/evidences/batch-delete`
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`,
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
    const url = `${API_CONFIG.BASE_URL}/agentic/classification-by-urls`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY) || ""}`
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
}
