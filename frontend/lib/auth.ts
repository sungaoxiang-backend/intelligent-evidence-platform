"use client"

import { API_CONFIG } from "./config"
import type { Staff } from "./config"

class AuthService {
  private tokenKey = API_CONFIG.TOKEN_KEY
  private userKey = API_CONFIG.USER_KEY

  // 获取存储的token
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.tokenKey)
    }
    return null
  }

  // 存储token
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token)
    }
  }

  // 清除token
  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey)
    }
  }

  // 获取存储的用户信息
  getUser(): Staff | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(this.userKey)
      if (userStr) {
        try {
          return JSON.parse(userStr)
        } catch {
          return null
        }
      }
    }
    return null
  }

  // 存储用户信息
  setUser(user: Staff): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.userKey, JSON.stringify(user))
    }
  }

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getToken()
  }

  // 检查是否为超级用户
  isSuperUser(): boolean {
    const user = this.getUser()
    return user?.is_superuser || false
  }

  // 创建请求头（包含ngrok绕过头）
  private createHeaders(includeAuth = false): HeadersInit {
    const headers: HeadersInit = {
      "ngrok-skip-browser-warning": "true", // 绕过ngrok浏览器警告
    }

    if (includeAuth) {
      const token = this.getToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      headers["Content-Type"] = "application/json"
    }

    return headers
  }

  // 登录
  async login(username: string, password: string): Promise<{ success: boolean; user?: Staff; error?: string }> {
    try {
      const loginUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LOGIN}`
      console.log("开始登录，API地址:", loginUrl)

      // 使用FormData因为OAuth2 token端点通常要求application/x-www-form-urlencoded
      const formData = new FormData()
      formData.append("username", username)
      formData.append("password", password)

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "true", // 绕过ngrok浏览器警告
        },
        body: formData,
      })

      console.log("登录响应状态:", response.status)
      console.log("登录响应头:", Object.fromEntries(response.headers.entries()))

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        let errorMsg = "登录失败"
        try {
          const errorObj = JSON.parse(errorText)
          errorMsg = errorObj.message || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        return {
          success: false,
          error: errorMsg,
        }
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text()
        console.error("非JSON响应:", textResponse.substring(0, 200))
        return { success: false, error: "服务器返回了非JSON响应，请检查API端点是否正确" }
      }

      const result = await response.json()
      console.log("登录响应内容:", result)

      // 检查是否是标准的OAuth2响应格式
      if (result.access_token) {
        // 标准OAuth2格式
        this.setToken(result.access_token)

        // 获取用户信息
        const userInfo = await this.getCurrentUser()
        if (userInfo.success && userInfo.user) {
          this.setUser(userInfo.user)
          return { success: true, user: userInfo.user }
        }

        return { success: true }
      } else if (result.code === 200 && result.data?.access_token) {
        // 自定义格式
        this.setToken(result.data.access_token)

        // 获取用户信息
        const userInfo = await this.getCurrentUser()
        if (userInfo.success && userInfo.user) {
          this.setUser(userInfo.user)
          return { success: true, user: userInfo.user }
        }

        return { success: true }
      } else {
        const errorMsg = result.detail || result.message || "登录失败"
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      console.error("登录错误:", error)
      return { success: false, error: "网络连接失败，请检查服务器连接和API地址" }
    }
  }

  // 登出
  logout(): void {
    this.removeToken()
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<{ success: boolean; user?: Staff; error?: string }> {
    try {
      const token = this.getToken()
      if (!token) {
        return { success: false, error: "未登录" }
      }

      const userUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFF_ME}`
      console.log("获取用户信息，API地址:", userUrl)

      const response = await fetch(userUrl, {
        method: "GET",
        headers: this.createHeaders(true),
      })

      console.log("获取用户信息响应状态:", response.status)

      // 检查响应状态
      if (!response.ok) {
        if (response.status === 401) {
          this.removeToken()
          return { success: false, error: "登录已过期，请重新登录" }
        }

        const errorText = await response.text()
        console.error("获取用户信息请求失败:", response.status, errorText)
        return {
          success: false,
          error: `获取用户信息失败 (${response.status}): ${errorText.substring(0, 100)}`,
        }
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text()
        console.error("获取用户信息非JSON响应:", textResponse.substring(0, 200))
        return { success: false, error: "服务器返回了非JSON响应" }
      }

      const result = await response.json()
      console.log("获取用户信息响应内容:", result)

      // 检查响应格式
      if (result.id && result.username) {
        // 直接返回用户数据
        return { success: true, user: result }
      } else if (result.code === 200 && result.data) {
        // 自定义格式
        return { success: true, user: result.data }
      } else {
        const errorMsg = result.detail || result.message || "获取用户信息失败"
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      console.error("获取用户信息错误:", error)
      return { success: false, error: "网络连接失败" }
    }
  }

  // 更新当前用户密码
  async updatePassword(newPassword: string): Promise<{ success: boolean; user?: Staff; error?: string }> {
    try {
      const token = this.getToken()
      if (!token) {
        return { success: false, error: "未登录" }
      }

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STAFF_ME}`, {
        method: "PUT",
        headers: this.createHeaders(true),
        body: JSON.stringify({ password: newPassword }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `更新密码失败 (${response.status}): ${errorText.substring(0, 100)}`,
        }
      }

      // 检查响应是否为JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text()
        console.error("更新密码非JSON响应:", textResponse.substring(0, 200))
        return { success: false, error: "服务器返回了非JSON响应" }
      }

      const result = await response.json()

      if (result.id && result.username) {
        this.setUser(result)
        return { success: true, user: result }
      } else if (result.code === 200 && result.data) {
        this.setUser(result.data)
        return { success: true, user: result.data }
      } else {
        const errorMsg = result.detail || result.message || "更新密码失败"
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      console.error("更新密码错误:", error)
      return { success: false, error: "网络连接失败" }
    }
  }
}

export const authService = new AuthService()
