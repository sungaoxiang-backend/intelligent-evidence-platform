/**
 * Lex-DocX API 客户端
 * 文档模板管理和文书生成相关 API
 */

import { API_CONFIG } from "../config"

// ==================== 类型定义 ====================

export interface PlaceholderMetadata {
  type: "text" | "number" | "date" | "textarea" | "checkbox" | "multiselect"
  label: string
  required: boolean
  default_value?: any
  options?: string[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

export interface DocumentTemplate {
  id: number
  name: string
  description?: string
  category?: string
  status: "draft" | "published"
  content_path?: string
  content_html?: string
  placeholder_metadata?: Record<string, PlaceholderMetadata>
  created_by?: number
  updated_by?: number
  created_at: string
  updated_at: string
}

export interface DocumentGeneration {
  id: number
  template_id: number
  generated_by: number
  form_data: Record<string, any>
  document_url: string
  document_filename: string
  generated_at: string
  created_at: string
  updated_at: string
}

export interface TemplateListParams {
  search?: string
  category?: string
  status?: "draft" | "published"
  skip?: number
  limit?: number
}

export interface GenerationListParams {
  template_id?: number
  generated_by?: number
  start_date?: string
  end_date?: string
  skip?: number
  limit?: number
}

export interface TemplateCreateData {
  name: string
  description?: string
  category?: string
  content_html?: string
  placeholder_metadata?: Record<string, PlaceholderMetadata>
  status?: "draft" | "published"
}

export interface TemplateUpdateData {
  name?: string
  description?: string
  category?: string
  content_html?: string
  placeholder_metadata?: Record<string, PlaceholderMetadata>
  status?: "draft" | "published"
}

export interface GenerationCreateData {
  template_id: number
  form_data: Record<string, any>
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  pagination?: {
    total: number
    page: number
    size: number
    pages: number
  }
}

// ==================== API 客户端类 ====================

class LexDocxAPI {
  private getBaseUrl(): string {
    return API_CONFIG.BASE_URL
  }

  private createHeaders(contentType: string = "application/json"): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": contentType,
    }

    const token = localStorage.getItem(API_CONFIG.TOKEN_KEY)
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    return headers
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.detail || error.message || "请求失败")
    }

    const result: ApiResponse<T> = await response.json()
    // 后端返回格式：{ code: 200, message: "success", data: T, pagination?: {...} }
    if (result.code === 200 || response.status === 200 || response.status === 201) {
      return result.data
    } else {
      throw new Error(result.message || "请求失败")
    }
  }

  // ==================== 模板管理 API ====================

  /**
   * 获取模板列表（支持搜索、筛选、分页）
   */
  async getTemplates(params?: TemplateListParams): Promise<{
    data: DocumentTemplate[]
    pagination?: {
      total: number
      page: number
      size: number
      pages: number
    }
  }> {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append("search", params.search)
    if (params?.category) queryParams.append("category", params.category)
    if (params?.status) queryParams.append("status", params.status)
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())

    const url = `${this.getBaseUrl()}/lex-docx${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    const result: ApiResponse<DocumentTemplate[]> = await response.json()
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || "请求失败")
    }

    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  /**
   * 获取已发布模板列表（用于生成页面）
   */
  async getPublishedTemplates(params?: { skip?: number; limit?: number }): Promise<{
    data: DocumentTemplate[]
    pagination?: {
      total: number
      page: number
      size: number
      pages: number
    }
  }> {
    const queryParams = new URLSearchParams()
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())

    const url = `${this.getBaseUrl()}/lex-docx/published${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    const result: ApiResponse<DocumentTemplate[]> = await response.json()
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || "请求失败")
    }

    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  /**
   * 获取模板详情
   * @param id 模板ID
   * @param forEditing 是否用于编辑（如果是，则从DOCX重新生成HTML以确保格式）
   */
  async getTemplate(id: number, forEditing: boolean = false): Promise<DocumentTemplate> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}${forEditing ? '?for_editing=true' : ''}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    return this.handleResponse<DocumentTemplate>(response)
  }

  /**
   * 创建模板
   */
  async createTemplate(data: TemplateCreateData): Promise<DocumentTemplate> {
    const url = `${this.getBaseUrl()}/lex-docx`
    const response = await fetch(url, {
      method: "POST",
      headers: this.createHeaders(),
      body: JSON.stringify(data),
    })

    return this.handleResponse<DocumentTemplate>(response)
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: number, data: TemplateUpdateData): Promise<DocumentTemplate> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}`
    const response = await fetch(url, {
      method: "PUT",
      headers: this.createHeaders(),
      body: JSON.stringify(data),
    })

    return this.handleResponse<DocumentTemplate>(response)
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: number): Promise<void> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}`
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.detail || error.message || "删除失败")
    }
  }

  /**
   * 更新模板状态
   */
  async updateTemplateStatus(id: number, status: "draft" | "published"): Promise<DocumentTemplate> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}/status`
    const response = await fetch(url, {
      method: "PUT",
      headers: this.createHeaders(),
      body: JSON.stringify({ status }),
    })

    return this.handleResponse<DocumentTemplate>(response)
  }

  /**
   * 获取模板预览 HTML
   */
  async getTemplatePreview(id: number): Promise<string> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}/preview`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.detail || error.message || "获取预览失败")
    }

    return response.text()
  }

  /**
   * 导入模板（文件上传）
   */
  async importTemplate(
    file: File,
    options?: {
      name?: string
      description?: string
      category?: string
    }
  ): Promise<DocumentTemplate> {
    const formData = new FormData()
    formData.append("file", file)
    if (options?.name) formData.append("name", options.name)
    if (options?.description) formData.append("description", options.description)
    if (options?.category) formData.append("category", options.category)

    const url = `${this.getBaseUrl()}/lex-docx/import`
    
    // 对于 FormData，不设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
    const headers: HeadersInit = {}
    const token = localStorage.getItem(API_CONFIG.TOKEN_KEY)
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    })

    return this.handleResponse<DocumentTemplate>(response)
  }

  /**
   * 导出模板（文件下载）
   */
  async exportTemplate(id: number): Promise<Blob> {
    const url = `${this.getBaseUrl()}/lex-docx/${id}/export`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.detail || error.message || "导出失败")
    }

    return response.blob()
  }

  // ==================== 文书生成 API ====================

  /**
   * 生成文书
   */
  async generateDocument(data: GenerationCreateData): Promise<DocumentGeneration> {
    const url = `${this.getBaseUrl()}/lex-docx/generations`
    const response = await fetch(url, {
      method: "POST",
      headers: this.createHeaders(),
      body: JSON.stringify(data),
    })

    return this.handleResponse<DocumentGeneration>(response)
  }

  /**
   * 获取生成记录列表（支持筛选、分页）
   */
  async getGenerations(params?: GenerationListParams): Promise<{
    data: DocumentGeneration[]
    pagination?: {
      total: number
      page: number
      size: number
      pages: number
    }
  }> {
    const queryParams = new URLSearchParams()
    if (params?.template_id) queryParams.append("template_id", params.template_id.toString())
    if (params?.generated_by) queryParams.append("generated_by", params.generated_by.toString())
    if (params?.start_date) queryParams.append("start_date", params.start_date)
    if (params?.end_date) queryParams.append("end_date", params.end_date)
    if (params?.skip !== undefined) queryParams.append("skip", params.skip.toString())
    if (params?.limit !== undefined) queryParams.append("limit", params.limit.toString())

    const url = `${this.getBaseUrl()}/lex-docx/generations${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    const result: ApiResponse<DocumentGeneration[]> = await response.json()
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || "请求失败")
    }

    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  /**
   * 获取生成记录详情
   */
  async getGeneration(id: number): Promise<DocumentGeneration> {
    const url = `${this.getBaseUrl()}/lex-docx/generations/${id}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    return this.handleResponse<DocumentGeneration>(response)
  }

  /**
   * 下载生成的文档
   */
  async downloadDocument(id: number): Promise<Blob> {
    const url = `${this.getBaseUrl()}/lex-docx/generations/${id}/download`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }))
      throw new Error(error.detail || error.message || "下载失败")
    }

    return response.blob()
  }
}

// ==================== 导出单例 ====================

export const lexDocxApi = new LexDocxAPI()

