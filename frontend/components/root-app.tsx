"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { TopNavigation } from "@/components/top-navigation"
import { LoginPage } from "@/components/login-page"
import { GlobalTaskProvider, useGlobalTasks } from "@/contexts/global-task-context"
import { authService } from "@/lib/auth"
import type { Staff } from "@/lib/config"

function TopNavigationWithTasks({
  userRole,
  currentUser,
  onLogout,
}: {
  userRole: string
  currentUser: Staff | null
  onLogout: () => void
}) {
  const { tasks, removeTask, clearAllTasks, clearCompletedTasks, retryTask, refreshTask } =
    useGlobalTasks()

  return (
    <TopNavigation
      userRole={userRole}
      currentUser={currentUser}
      onLogout={onLogout}
      tasks={tasks}
      onRemoveTask={removeTask}
      onClearAll={clearAllTasks}
      onClearCompleted={clearCompletedTasks}
      onRetryTask={retryTask}
      onRefreshTask={refreshTask}
    />
  )
}

function AppContent({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAuth = async () => {
      const authStatus = authService.isAuthenticated()
      if (authStatus) {
        const userInfo = await authService.getCurrentUser()
        if (userInfo.success && userInfo.user) {
          setCurrentUser(userInfo.user)
          setIsAuthenticated(true)
        } else {
          authService.logout()
          setIsAuthenticated(false)
          // 如果不在登录页，跳转到登录页
          if (pathname !== "/login") {
            router.push("/login")
          }
        }
      } else {
        setIsAuthenticated(false)
        // 如果不在登录页，跳转到登录页
        if (pathname !== "/login") {
          router.push("/login")
        }
      }
      setLoading(false)
    }
    checkAuth()
  }, [pathname])

  const handleLoginSuccess = async () => {
    const userInfo = await authService.getCurrentUser()
    if (userInfo.success && userInfo.user) {
      setCurrentUser(userInfo.user)
      setIsAuthenticated(true)
      router.push("/")
    }
  }

  const handleLogout = () => {
    authService.logout()
    setIsAuthenticated(false)
    setCurrentUser(null)
    router.push("/login") // 退出登录后跳转到登录页
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  // 如果未登录且当前在登录页，渲染登录页（通过children传递）
  if (!isAuthenticated && pathname === "/login") {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // 如果未登录且不在登录页，等待重定向
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">跳转中...</p>
        </div>
      </div>
    )
  }

  return (
    <GlobalTaskProvider>
      <div className="min-h-screen gradient-bg">
        <TopNavigationWithTasks
          userRole={currentUser?.is_superuser ? "admin" : "user"}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <main className="pt-12">
          <div
            className={
              pathname?.includes("/card-factory") ||
              pathname?.includes("/document-creation") ||
              pathname?.includes("/skill-management")
                ? "w-full px-4 lg:px-6 py-3"
                : "container mx-auto px-4 lg:px-6 py-3 max-w-7xl"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </GlobalTaskProvider>
  )
}

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    // 可以在此处上报错误日志
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">页面发生错误</h1>
          <p className="text-muted-foreground mb-2">{this.state.error?.message || "未知错误"}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function RootApp({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <GlobalErrorBoundary>
        <AppContent>{children}</AppContent>
        <Toaster />
      </GlobalErrorBoundary>
    </ThemeProvider>
  )
}
