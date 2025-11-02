/**
 * 文档模板 API
 */

import { API_CONFIG } from "./config"

interface TemplateInfo {
  template_id: string
  name: string
  type: string
  category: string
  description: string
}

interface FieldOption {
  value: string
  label: string
  sub_options?: FieldOption[]
}

interface FieldDefinition {
  field_id: string
  label: string
  type: "text" | "textarea" | "select" | "radio" | "checkbox" | "date" | "datetime" | "number" | "file"
  required: boolean
  placeholder?: string
  default?: string
  options?: FieldOption[]
  rows?: number
  format?: string
  validation?: {
    pattern?: string
    min_length?: number
    max_length?: number
  }
}

interface RowDefinition {
  row_id: string
  subtitle: string
  subtitle_width: number
  fields: FieldDefinition[]
}

interface BlockDefinition {
  block_id: string
  title: string
  description?: string
  rows: RowDefinition[]
}

interface TemplateSchema {
  template_id: string
  name: string
  type: string
  category: string
  description: string
  instructions: {
    title: string
    content: string
    items: string[]
  }
  special_notice: {
    title: string
    content: string
  }
  blocks: BlockDefinition[]
}

class DocumentTemplateAPI {
  getBaseUrl(): string {
    return API_CONFIG.BASE_URL
  }

  private createHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }
    
    const token = localStorage.getItem(API_CONFIG.TOKEN_KEY)
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }
    
    return headers
  }

  /**
   * 获取模板列表
   */
  async getTemplateList(): Promise<TemplateInfo[]> {
    const url = `${API_CONFIG.BASE_URL}/document-templates/templates`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })
    
    const result = await response.json()
    if (result.code === 200) {
      return result.data
    } else {
      throw new Error(result.message || "获取模板列表失败")
    }
  }

  /**
   * 获取模板详情（包含表单结构）
   */
  async getTemplateDetail(template_id: string): Promise<TemplateSchema> {
    const url = `${API_CONFIG.BASE_URL}/document-templates/templates/${template_id}`
    const response = await fetch(url, {
      method: "GET",
      headers: this.createHeaders(),
    })
    
    const result = await response.json()
    if (result.code === 200) {
      return result.data
    } else {
      throw new Error(result.message || "获取模板详情失败")
    }
  }

  /**
   * 验证表单数据
   */
  async validateFormData(template_id: string, form_data: Record<string, any>): Promise<{ valid: boolean; errors: string[] }> {
    const url = `${API_CONFIG.BASE_URL}/document-templates/templates/${template_id}/validate`
    const response = await fetch(url, {
      method: "POST",
      headers: this.createHeaders(),
      body: JSON.stringify({ form_data }),
    })
    
    const result = await response.json()
    if (result.code === 200) {
      return { valid: true, errors: [] }
    } else {
      return {
        valid: false,
        errors: result.data?.errors || [result.message || "验证失败"],
      }
    }
  }

  /**
   * 生成文书
   */
  async generateDocument(template_id: string, form_data: Record<string, any>): Promise<any> {
    const url = `${API_CONFIG.BASE_URL}/document-templates/templates/${template_id}/generate`
    const response = await fetch(url, {
      method: "POST",
      headers: this.createHeaders(),
      body: JSON.stringify({ form_data }),
    })
    
    const result = await response.json()
    if (result.code === 200) {
      return result.data
    } else {
      throw new Error(result.message || "生成文书失败")
    }
  }
}

export const documentTemplateApi = new DocumentTemplateAPI()
export type { TemplateInfo, TemplateSchema, BlockDefinition, RowDefinition, FieldDefinition }

