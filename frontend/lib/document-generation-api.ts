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

// ========== 类型定义 ==========

export interface PlaceholderInfo {
  placeholder_name: string
  label?: string
  type: string
  hint?: string
  default_value?: string
  options?: Array<{ label: string; value: string }>
}

export interface TemplateInfo {
  id: number
  name: string
  description?: string
  category?: string
  status: string
  prosemirror_json: any
  placeholders: PlaceholderInfo[]
}

export interface CaseInfo {
  id: number
  description?: string
}

export interface DocumentGeneration {
  id: number
  case_id: number
  template_id: number
  form_data: Record<string, any>
  created_by_id?: number
  updated_by_id?: number
  created_at: string
  updated_at: string
}

export interface TemplateListResponse {
  code: number
  message: string
  data: TemplateInfo[]
  total: number
}

export interface TemplateListResult {
  templates: TemplateInfo[]
  total: number
}

export interface GenerationDetailResponse {
  code: number
  message: string
  data: DocumentGeneration
  case?: CaseInfo
  template?: TemplateInfo
}

export interface GenerationResponse {
  code: number
  message: string
  data: DocumentGeneration
}

export interface ExportResponse {
  code: number
  message: string
  data: {
    file_url: string
    filename: string
    warnings: string[]
  }
}

export interface CreateGenerationRequest {
  case_id: number
  template_id: number
  form_data?: Record<string, any>
}

export interface UpdateGenerationRequest {
  form_data: Record<string, any>
  prosemirror_json?: any // 可选的模板内容（用于保存更新后的exportEnabled状态）
}

export interface ExportDocumentRequest {
  filename?: string
  prosemirror_json?: any // 可选的模板内容（用于传递更新后的exportEnabled状态）
}

// ========== API 方法 ==========

export const documentGenerationApi = {
  /**
   * 获取已发布的模板列表
   */
  async getPublishedTemplates(params?: {
    skip?: number
    limit?: number
    category?: string
    search?: string
  }): Promise<TemplateListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.skip !== undefined) queryParams.append("skip", String(params.skip))
    if (params?.limit !== undefined) queryParams.append("limit", String(params.limit))
    if (params?.category) queryParams.append("category", params.category)
    if (params?.search) queryParams.append("search", params.search)

    const url = buildApiUrl(
      `/document-generation/templates${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    )
    const response = await fetch(url, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取模板列表失败")
    }

    return await response.json()
  },

  /**
   * 获取文书生成记录详情
   */
  async getGenerationDetail(generationId: number): Promise<GenerationDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/document-generation/${generationId}`),
      {
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取文书生成记录详情失败")
    }

    return await response.json()
  },

  /**
   * 创建或获取文书生成记录（同一案件同一模板唯一）
   */
  async createOrGetGeneration(
    request: CreateGenerationRequest
  ): Promise<DocumentGeneration> {
    const response = await fetch(
      buildApiUrl("/document-generation"),
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
      throw new Error(error.detail || error.message || "创建文书生成记录失败")
    }

    const result = await response.json()
    // FastAPI response_model 直接返回数据对象，不是包装格式
    return result
  },

  /**
   * 更新文书生成的表单数据（草稿保存）
   */
  async updateGenerationData(
    generationId: number,
    request: UpdateGenerationRequest
  ): Promise<DocumentGeneration> {
    const response = await fetch(
      buildApiUrl(`/document-generation/${generationId}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(request),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || error.message || "更新文书生成记录失败")
    }

    const result = await response.json()
    // FastAPI response_model 直接返回数据对象，不是包装格式
    return result
  },

  /**
   * 导出文书到 COS
   */
  async exportGenerationDocument(
    generationId: number,
    request?: ExportDocumentRequest
  ): Promise<ExportResponse> {
    const response = await fetch(
      buildApiUrl(`/document-generation/${generationId}/export`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(request || {}),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "导出文书失败")
    }

    return await response.json()
  },
}

