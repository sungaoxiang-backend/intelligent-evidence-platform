// API配置
export const API_CONFIG = {
  BASE_URL: "http://127.0.0.1:8008/api/v1",
  ENDPOINTS: {
    // 认证相关 - 根据您的API档修正
    LOGIN: "/login/access-token", // 修正后的登录端点

    // 员工相关 - 根据您的API文档修正
    STAFFS: "/staffs",
    STAFF_ME: "/staffs/me",
    STAFF_BY_ID: (id: number) => `/staffs/${id}`,
  },

  // Token存储key
  TOKEN_KEY: "legal_platform_token",
  USER_KEY: "legal_platform_user",
}

// API响应类型
export interface ApiResponse<T = any> {
  code: number
  message: string
  timestamp: string
  data: T
  pagination?: {
    total: number
    page: number
    size: number
    pages: number
  }
}

// 员工数据类型
export interface Staff {
  id: number
  username: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  updated_at: string
}

// 登录响应数据 - 根据标准OAuth2格式
export interface LoginResponse {
  access_token: string
  token_type: string
}

// 登录请求数据
export interface LoginRequest {
  username: string
  password: string
}

// 创建员工请求数据
export interface CreateStaffRequest {
  username: string
  password: string
}

// 更新密码请求数据
export interface UpdatePasswordRequest {
  password: string
}
