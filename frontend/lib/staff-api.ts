"use client"

import { API_CONFIG } from "./config"
import { authService } from "./auth"
import type { Staff, CreateStaffRequest } from "./config"

class StaffApiService {
  private async getAuthHeaders() {
    const token = authService.getToken()
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true", // 绕过ngrok浏览器警告
    }
  }

  // 获取员工列表
  async getStaffs(page = 1, size = 100): Promise<{ data: Staff[]; pagination?: any }> {
    const headers = await this.getAuthHeaders()
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFFS}?page=${page}&size=${size}`
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

  // 删除员工
  async deleteStaff(id: number): Promise<void> {
    const headers = await this.getAuthHeaders()
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFF_BY_ID(id)}`, {
      method: "DELETE",
      headers,
    })
    const result = await response.json()
    if (result.code === 200) {
      return
    } else {
      throw new Error(result.message || "请求失败")
    }
  }
}

export const staffApi = new StaffApiService()
