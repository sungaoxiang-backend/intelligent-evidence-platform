// 数据类型定义
export interface Case {
  id: number
  user_id: number
  title: string
  description?: string
  case_type: string
  creditor_name: string
  creditor_type?: string
  debtor_name: string
  debtor_type?: string
  created_at: string
  updated_at: string
}

export interface Evidence {
  id: string
  name: string
  caseId: string
  caseTitle: string
  type: string
  format: string
  size: string
  uploadDate: string
  uploader: string
  status: "已标注" | "待标注" | "标注中" | "已拒绝"
  description: string
  isKey: boolean
  thumbnail?: string
  fullImage?: string
  aiAnnotations?: {
    extractedText: string
    entities: string[]
    confidence: number
    category: string
    tags: string[]
  }
  metadata: {
    resolution?: string
    fileSize: string
    createTime: string
    device: string
    location: string
    duration?: string
  }
}

export interface User {
  id: string
  name: string
  id_card?: string
  phone?: string
  type?: string
  email?: string
  address?: string
  status?: "活跃" | "待联系" | "已结案"
  caseCount?: number
  totalAmount?: string
  registerDate?: string
  lastContact?: string
  notes?: string
  created_at?: string
}

export interface Staff {
  id: string
  name: string
  email: string
  role: string
  department: string
  status: "在线" | "离线" | "忙碌"
  joinDate: string
  caseCount: number
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  total?: number
}

// 分页参数
export interface PaginationParams {
  page: number
  pageSize: number
  search?: string
  filters?: Record<string, any>
}
