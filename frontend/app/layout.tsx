"use client"

import type React from "react"
import { useState, useEffect } from "react"
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppContent>{children}</AppContent>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
