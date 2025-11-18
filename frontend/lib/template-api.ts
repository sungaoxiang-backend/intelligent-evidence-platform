import { API_CONFIG } from "./config"

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

// 模板相关类型定义
export interface DocumentTemplate {
  id: number
  name: string
  description?: string
  category?: string
  status: "draft" | "published"
  prosemirror_json: any
  docx_url?: string
  created_by_id?: number
  updated_by_id?: number
  created_at: string
  updated_at: string
}

export interface TemplateListResponse {
  code: number
  message: string
  data: DocumentTemplate[]
  total: number
}

export interface TemplateDetailResponse {
  code: number
  message: string
  data: DocumentTemplate
}

export interface CreateTemplateRequest {
  name: string
  description?: string
  category?: string
  status?: "draft" | "published"
  prosemirror_json: any
  docx_url?: string
}

export interface UpdateTemplateRequest {
  name?: string
  description?: string
  category?: string
  status?: "draft" | "published"
  prosemirror_json?: any
  docx_url?: string
}

export interface ParseAndSaveRequest {
  name: string
  description?: string
  category?: string
  status?: "draft" | "published"
  save_to_cos?: boolean
}

// 模板管理 API
export const templateApi = {
  // 解析 DOCX（不保存）
  async parseDocx(file: File): Promise<{ data: any }> {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(
      buildApiUrl("/template-editor/parse"),
      {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "解析失败")
    }

    const result = await response.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "解析失败")
    }
  },

  // 解析并保存模板
  async parseAndSave(
    file: File,
    params: ParseAndSaveRequest
  ): Promise<TemplateDetailResponse> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("name", params.name)
    if (params.description) formData.append("description", params.description)
    if (params.category) formData.append("category", params.category)
    if (params.status) formData.append("status", params.status)
    formData.append("save_to_cos", String(params.save_to_cos ?? true))

    const response = await fetch(
      buildApiUrl("/template-editor/parse-and-save"),
      {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "解析并保存失败")
    }

    const result = await response.json()
    return result
  },

  // 获取模板列表
  async getTemplates(params?: {
    status?: string
    category?: string
    skip?: number
    limit?: number
  }): Promise<TemplateListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.status) queryParams.append("status", params.status)
    if (params?.category) queryParams.append("category", params.category)
    if (params?.skip !== undefined) queryParams.append("skip", String(params.skip))
    if (params?.limit !== undefined) queryParams.append("limit", String(params.limit))

    const url = buildApiUrl(`/template-editor/templates${queryParams.toString() ? `?${queryParams.toString()}` : ""}`)
    const response = await fetch(url, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取模板列表失败")
    }

    const result = await response.json()
    return result
  },

  // 获取模板详情
  async getTemplate(templateId: number): Promise<TemplateDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/template-editor/templates/${templateId}`),
      {
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取模板详情失败")
    }

    const result = await response.json()
    return result
  },

  // 创建模板
  async createTemplate(request: CreateTemplateRequest): Promise<TemplateDetailResponse> {
    const response = await fetch(
      buildApiUrl("/template-editor/templates"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "创建模板失败")
    }

    const result = await response.json()
    return result
  },

  // 更新模板
  async updateTemplate(
    templateId: number,
    request: UpdateTemplateRequest
  ): Promise<TemplateDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/template-editor/templates/${templateId}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "更新模板失败")
    }

    const result = await response.json()
    return result
  },

  // 删除模板
  async deleteTemplate(templateId: number): Promise<void> {
    const response = await fetch(
      buildApiUrl(`/template-editor/templates/${templateId}`),
      {
        method: "DELETE",
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "删除模板失败")
    }
  },

  // 导出 DOCX
  async exportDocx(prosemirrorJson: any, filename?: string): Promise<Blob> {
    const response = await fetch(
      buildApiUrl("/template-editor/export"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          prosemirror_json: prosemirrorJson,
          filename: filename || "document.docx",
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "导出失败")
    }

    return await response.blob()
  },

  // 获取占位符列表（支持按 template_id 筛选）
  async getPlaceholders(params?: {
    template_id?: number
    skip?: number
    limit?: number
  }): Promise<{ code: number; message: string; data: any[]; total: number }> {
    const queryParams = new URLSearchParams()
    if (params?.template_id !== undefined) queryParams.append("template_id", String(params.template_id))
    if (params?.skip !== undefined) queryParams.append("skip", String(params.skip))
    if (params?.limit !== undefined) queryParams.append("limit", String(params.limit))

    const url = buildApiUrl(`/template-editor/placeholders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`)
    const response = await fetch(url, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取占位符列表失败")
    }

    const result = await response.json()
    return result
  },
}

