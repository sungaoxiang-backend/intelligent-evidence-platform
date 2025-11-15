/**
 * 统一的错误处理工具
 * 用于处理 API 错误、网络错误等，并提供友好的错误提示
 */

import { toast } from "@/hooks/use-toast"

export interface ApiError {
  detail?: string
  message?: string
  error?: string
}

/**
 * 处理 API 错误并显示友好的错误提示
 */
export function handleApiError(error: unknown, defaultMessage = "操作失败"): void {
  let errorMessage = defaultMessage

  if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === "object" && error !== null) {
    const apiError = error as ApiError
    errorMessage = apiError.detail || apiError.message || apiError.error || defaultMessage
  } else if (typeof error === "string") {
    errorMessage = error
  }

  // 显示错误提示
  toast({
    title: "错误",
    description: errorMessage,
    variant: "destructive",
    duration: 5000,
  })
}

/**
 * 处理网络错误
 */
export function handleNetworkError(error: unknown): void {
  if (error instanceof Error && error.message.includes("fetch")) {
    handleApiError(error, "网络连接失败，请检查网络设置")
  } else {
    handleApiError(error, "网络错误，请稍后重试")
  }
}

/**
 * 处理验证错误
 */
export function handleValidationError(errors: Record<string, string[]>): void {
  const errorMessages = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
    .join("\n")

  toast({
    title: "验证失败",
    description: errorMessages,
    variant: "destructive",
    duration: 5000,
  })
}

/**
 * 处理成功提示
 */
export function handleSuccess(message = "操作成功"): void {
  toast({
    title: "成功",
    description: message,
    duration: 3000,
  })
}

