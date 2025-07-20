"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Home, Scale, Shield, Users, UserCheck, Bell, Plus, Search, Moon, Sun, User, LogOut } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import type { Staff } from "@/lib/config"

interface TopNavigationProps {
  userRole: string
  currentUser: Staff | null
  onLogout: () => void
}

export function TopNavigation({ userRole, currentUser, onLogout }: TopNavigationProps) {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const getActiveModule = () => {
    if (pathname.startsWith("/cases")) return "cases"
    if (pathname.startsWith("/evidence")) return "evidence"
    if (pathname.startsWith("/users")) return "users"
    if (pathname.startsWith("/staff")) return "staff"
    if (pathname.startsWith("/profile")) return "profile"
    return "workbench"
  }
  const activeModule = getActiveModule()

  const navigationItems = [
    { id: "workbench", label: "工作台", icon: Home, href: "/" },
    { id: "cases", label: "案件管理", icon: Scale, href: "/cases" },
    { id: "evidence", label: "证据管理", icon: Shield, href: "/evidence" },
    { id: "users", label: "当事人", icon: Users, href: "/users" },
  ]

  if (userRole === "admin") {
    navigationItems.push({ id: "staff", label: "员工管理", icon: UserCheck, href: "/staff" })
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 lg:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-12">
          {/* Logo和导航 */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground leading-none">债务纠纷管理平台</h1>
              </div>
            </Link>

            <nav className="hidden md:flex items-center">
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.id} href={item.href} passHref>
                    <Button
                      variant={activeModule === item.id ? "default" : "ghost"}
                      size="sm"
                      className={`flex items-center space-x-1 transition-all duration-200 h-7 px-2.5 mx-0.5 ${
                        activeModule === item.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* 搜索和用���操作 */}
          <div className="flex items-center space-x-2">
            {/* 全局搜索 */}
            <div className="hidden md:block relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
              <Input
                placeholder="搜索案件、当事人..."
                className="pl-7 w-48 h-7 bg-muted/50 border-0 focus:bg-background transition-colors text-xs"
              />
            </div>

            {/* 主题切换 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
            >
              <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>

            {/* 通知 */}
            <Button
              variant="ghost"
              size="sm"
              className="relative text-muted-foreground hover:text-foreground h-7 w-7 p-0"
            >
              <Bell className="h-3.5 w-3.5" />
              <Badge className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 p-0 text-xs bg-red-500 text-white">3</Badge>
            </Button>

            {/* 快速录入 */}
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-all duration-200 h-7 px-2.5"
            >
              <Plus className="h-3 w-3 mr-1" />
              <span className="text-xs">录入案件</span>
            </Button>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-7 w-7 rounded-full p-0">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                      {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5 text-sm">
                  <div className="font-medium">{currentUser?.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {currentUser?.is_superuser ? "超级管理员" : "普通员工"}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <Link href="/profile" passHref>
                  <DropdownMenuItem className="text-sm cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    个人资料
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 text-sm cursor-pointer" onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}

