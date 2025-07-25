"use client"

import React, { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { TopNavigation } from "@/components/top-navigation"
import { LoginPage } from "@/components/login-page"
import { authService } from "@/lib/auth"
import type { Staff } from "@/lib/config"

const inter = Inter({ subsets: ["latin"] })

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
        }
      } else {
        setIsAuthenticated(false)
      }
      setLoading(false)
    }
    checkAuth()
  }, [pathname]) // Re-check auth on route change

  const handleLoginSuccess = async () => {
    const userInfo = await authService.getCurrentUser()
    if (userInfo.success && userInfo.user) {
      setCurrentUser(userInfo.user)
      setIsAuthenticated(true)
      router.push("/") // 登录成功后跳转到工作台
    }
  }

  const handleLogout = () => {
    authService.logout()
    setIsAuthenticated(false)
    setCurrentUser(null)
    router.push("/") // 退出后回到登录页
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

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen gradient-bg">
      <TopNavigation
        userRole={currentUser?.is_superuser ? "admin" : "user"}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="pt-12">
        <div className="container mx-auto px-4 lg:px-6 py-3 max-w-7xl">{children}</div>
      </main>
    </div>
  )
}

// 全局错误边界组件
class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, errorInfo: any) {
    // 可在此处上报错误日志
    // console.error('GlobalErrorBoundary:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">页面发生错误</h1>
          <p className="text-muted-foreground mb-2">{this.state.error?.message || '未知错误'}</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => window.location.reload()}>刷新页面</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>汇法律 智能证物平台</title>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GlobalErrorBoundary>
            <AppContent>{children}</AppContent>
            <Toaster />
          </GlobalErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
