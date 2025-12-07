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

// 文书相关类型定义
export interface Document {
  id: number
  name: string
  description?: string
  category?: string
  status: "draft" | "published"  // 状态：草稿/发布
  content_json: any  // ProseMirror JSON 格式
  placeholder_metadata?: Record<string, {
    name: string
    type: "text" | "radio" | "checkbox" | ""
    options: string[]
  }>  // 占位符元数据
  created_by_id?: number
  updated_by_id?: number
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  code: number
  message: string
  data: Document[]
  total: number
}

export interface DocumentDetailResponse {
  code: number
  message: string
  data: Document
}

export interface CreateDocumentRequest {
  name: string
  description?: string
  category?: string
  content_json: any
}

export interface UpdateDocumentRequest {
  name?: string
  description?: string
  category?: string
  content_json?: any
}

export interface ExportDocumentRequest {
  html_content: string
  filename?: string
}

export interface UpdateDocumentStatusRequest {
  status: "draft" | "published"
}

export interface UpdatePlaceholderMetadataRequest {
  placeholder_metadata: Record<string, {
    name: string
    type: "text" | "radio" | "checkbox" | ""
    options: string[]
  }>
}

export interface GenerateDocumentRequest {
  form_data: Record<string, any>  // 表单数据，键为占位符名称，值为填充的值
}

export interface GenerateDocumentResponse {
  code: number
  message: string
  data: {
    content_json: any
    template_name: string
  }
}

// 文书管理 API
export const documentsApi = {
  // 创建文书
  async createDocument(request: CreateDocumentRequest): Promise<DocumentDetailResponse> {
    const response = await fetch(
      buildApiUrl("/documents"),
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
      throw new Error(error.detail || "创建文书失败")
    }

    return await response.json()
  },

  // 获取文书列表
  async getDocuments(params?: {
    skip?: number
    limit?: number
    search?: string
    category?: string
    status?: "draft" | "published" | "all"
  }): Promise<DocumentListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.skip !== undefined) queryParams.append("skip", String(params.skip))
    if (params?.limit !== undefined) queryParams.append("limit", String(params.limit))
    if (params?.search) queryParams.append("search", params.search)
    if (params?.category) queryParams.append("category", params.category)
    if (params?.status) queryParams.append("status", params.status)

    const url = buildApiUrl(`/documents${queryParams.toString() ? `?${queryParams.toString()}` : ""}`)
    const response = await fetch(url, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取文书列表失败")
    }

    return await response.json()
  },

  // 获取文书详情
  async getDocument(documentId: number): Promise<DocumentDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}`),
      {
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取文书详情失败")
    }

    return await response.json()
  },

  // 更新文书
  async updateDocument(
    documentId: number,
    request: UpdateDocumentRequest
  ): Promise<DocumentDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}`),
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
      throw new Error(error.detail || "更新文书失败")
    }

    return await response.json()
  },

  // 删除文书
  async deleteDocument(documentId: number): Promise<void> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}`),
      {
        method: "DELETE",
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "删除文书失败")
    }
  },

  // 导出文书为 PDF
  async exportDocumentToPdf(
    documentId: number,
    request: ExportDocumentRequest
  ): Promise<Blob> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}/export`),
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
      throw new Error(error.detail || "导出 PDF 失败")
    }

    return await response.blob()
  },

  // 更新文书状态
  async updateDocumentStatus(
    documentId: number,
    request: UpdateDocumentStatusRequest
  ): Promise<DocumentDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}/status`),
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
      throw new Error(error.detail || "更新文书状态失败")
    }

    return await response.json()
  },

  // 更新占位符元数据
  async updatePlaceholderMetadata(
    documentId: number,
    request: UpdatePlaceholderMetadataRequest
  ): Promise<DocumentDetailResponse> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}/placeholders`),
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
      throw new Error(error.detail || "更新占位符元数据失败")
    }

    return await response.json()
  },

  // 生成文档（基于模板和表单数据）
  async generateDocument(
    documentId: number,
    request: GenerateDocumentRequest
  ): Promise<GenerateDocumentResponse> {
    const response = await fetch(
      buildApiUrl(`/documents/${documentId}/generate`),
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
      throw new Error(error.detail || "生成文档失败")
    }

    return await response.json()
  },

  // 获取已发布模板列表（用于文书制作页面）
  async getPublishedDocuments(params?: {
    skip?: number
    limit?: number
    search?: string
    category?: string
  }): Promise<DocumentListResponse> {
    const queryParams = new URLSearchParams()
    if (params?.skip !== undefined) queryParams.append("skip", String(params.skip))
    if (params?.limit !== undefined) queryParams.append("limit", String(params.limit))
    if (params?.search) queryParams.append("search", params.search)
    if (params?.category) queryParams.append("category", params.category)

    const url = buildApiUrl(`/documents/published${queryParams.toString() ? `?${queryParams.toString()}` : ""}`)
    const response = await fetch(url, {
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取已发布模板列表失败")
    }

    return await response.json()
  },
}

// 草稿相关类型定义
export interface DocumentDraft {
  id: number
  case_id: number
  document_id: number
  form_data: Record<string, any>
  created_by_id?: number
  updated_by_id?: number
  created_at: string
  updated_at: string
}

export interface DocumentDraftDetailResponse {
  code: number
  message: string
  data: DocumentDraft | null
}

export interface DocumentDraftListResponse {
  code: number
  message: string
  data: DocumentDraft[]
}

export interface CreateOrUpdateDraftRequest {
  case_id: number
  document_id: number
  form_data: Record<string, any>
}

// 文书制作相关类型定义
export interface DocumentCreationGenerateRequest {
  case_id: number
  document_id: number
  form_data: Record<string, any>
}

export interface DocumentCreationGenerateResponse {
  code: number
  message: string
  data: any  // ProseMirror JSON 格式
}

// 草稿管理 API
export const documentDraftsApi = {
  // 获取草稿
  async getDraft(caseId: number, documentId: number): Promise<DocumentDraftDetailResponse> {
    const queryParams = new URLSearchParams()
    queryParams.append("case_id", String(caseId))
    queryParams.append("document_id", String(documentId))

    const response = await fetch(
      buildApiUrl(`/document-drafts?${queryParams.toString()}`),
      {
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取草稿失败")
    }

    return await response.json()
  },

  // 创建或更新草稿
  async createOrUpdateDraft(request: CreateOrUpdateDraftRequest): Promise<DocumentDraftDetailResponse> {
    const response = await fetch(
      buildApiUrl("/document-drafts"),
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
      throw new Error(error.detail || "保存草稿失败")
    }

    return await response.json()
  },

  // 删除草稿
  async deleteDraft(draftId: number): Promise<void> {
    const response = await fetch(
      buildApiUrl(`/document-drafts/${draftId}`),
      {
        method: "DELETE",
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "删除草稿失败")
    }
  },

  // 获取某个案件的所有草稿
  async getDraftsByCase(caseId: number): Promise<DocumentDraftListResponse> {
    const response = await fetch(
      buildApiUrl(`/document-drafts/case/${caseId}`),
      {
        headers: getAuthHeader(),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || "获取草稿列表失败")
    }

    return await response.json()
  },
}

// 文书制作 API
export const documentCreationApi = {
  // 生成填充后的文档
  async generateDocument(request: DocumentCreationGenerateRequest): Promise<DocumentCreationGenerateResponse> {
    const response = await fetch(
      buildApiUrl("/document-creation/generate"),
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
      throw new Error(error.detail || "生成文档失败")
    }

    return await response.json()
  },

  // 导出填充后的文档为 PDF
  async exportDocumentToPdf(request: ExportDocumentRequest): Promise<Blob> {
    const response = await fetch(
      buildApiUrl("/document-creation/export"),
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
      throw new Error(error.detail || "导出 PDF 失败")
    }

    return await response.blob()
  },
}

