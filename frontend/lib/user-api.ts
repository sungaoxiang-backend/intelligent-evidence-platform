import { API_CONFIG } from "./config"
import type { ApiResponse } from "./config"
import type { User } from "./types"

// 分页参数类型
interface UserListParams {
  page?: number
  pageSize?: number
  search?: string
  sort_by?: string
  sort_order?: string
  user_id?: number
}

export const userApi = {
  async getUsers(params: UserListParams = {}): Promise<{ data: User[]; pagination?: any }> {
    const { page = 1, pageSize = 20, search, sort_by, sort_order, user_id } = params
    const skip = (page - 1) * pageSize
    let url = `${API_CONFIG.BASE_URL}/users?skip=${skip}&limit=${pageSize}`
    
    // 只有当search参数存在且不为空时才添加
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search)}`
    }
    
    // Add sorting parameters if provided
    if (sort_by) {
      url += `&sort_by=${encodeURIComponent(sort_by)}`
    }
    if (sort_order) {
      url += `&sort_order=${encodeURIComponent(sort_order)}`
    }
    if (user_id) {
      url += `&user_id=${user_id}`
    }
    
    // 添加调试日志
    console.log("🔍 User API Request:", {
      url,
      sort_by,
      sort_order,
      user_id,
      params,
      finalUrl: url
    });
    
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

  async getUserById(id: number): Promise<{ data: User }> {
    const url = `${API_CONFIG.BASE_URL}/users/${id}`
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

  async createUser(data: Partial<User>): Promise<{ data: User }> {
    const url = `${API_CONFIG.BASE_URL}/users`
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

  async updateUser(id: number, data: Partial<User>): Promise<{ data: User }> {
    const url = `${API_CONFIG.BASE_URL}/users/${id}`
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

  async deleteUser(id: number): Promise<void> {
    const url = `${API_CONFIG.BASE_URL}/users/${id}`
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