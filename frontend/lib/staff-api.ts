"use client"

import { API_CONFIG } from "./config"
import { authService } from "./auth"

interface Staff {
  id: number
  name: string
  email: string
  role: "admin" | "manager" | "staff"
  department: string
  status: "active" | "inactive"
  created_at: string
}

interface CreateStaffRequest {
  name: string
  email: string
  role: "admin" | "manager" | "staff"
  department: string
  status: "active" | "inactive"
}

interface PaginationParams {
  page?: number
  pageSize?: number
  search?: string
}

class StaffApiService {
  private async getAuthHeaders() {
    const token = authService.getToken()
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    }
  }

  // 获取员工列表
  async getStaff(params: PaginationParams = {}): Promise<{ data: Staff[]; pagination?: any }> {
    const { page = 1, pageSize = 20, search = "" } = params
    const headers = await this.getAuthHeaders()
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFFS}?page=${page}&size=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`
    const response = await fetch(url, {
      method: "GET",
      headers,
    })
    const result = await response.json()
    if (result.code === 200) {
      return { data: result.data, pagination: result.pagination }
    } else {
      throw new Error(result.message || "请求失败")
    }
  }

  // 创建员工
  async createStaff(staffData: CreateStaffRequest): Promise<{ data: Staff }> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFFS}`, {
      method: "POST",
      headers,
      body: JSON.stringify(staffData),
    })
    const result = await response.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  }

  // 更新员工
  async updateStaff(id: number, staffData: Partial<CreateStaffRequest>): Promise<{ data: Staff }> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFFS}/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(staffData),
    })
    const result = await response.json()
    if (result.code === 200) {
      return { data: result.data }
    } else {
      throw new Error(result.message || "请求失败")
    }
  }

  // 删除员工
  async deleteStaff(id: number): Promise<void> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFFS}/${id}`, {
      method: "DELETE",
      headers,
    })
    const result = await response.json()
    if (result.code !== 200) {
      throw new Error(result.message || "删除失败")
    }
  }
}

export const staffApi = new StaffApiService()
