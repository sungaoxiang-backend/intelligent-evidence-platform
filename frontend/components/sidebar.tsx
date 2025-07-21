"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, UserCheck, FileText, Shield, LogOut, Scale } from "lucide-react"
import Link from "next/link"

interface SidebarProps {
  activeModule: string
  setActiveModule: (module: string) => void
}

export function Sidebar({ activeModule, setActiveModule }: SidebarProps) {
  const menuItems = [
    { id: "dashboard", label: "数据仪表盘", icon: LayoutDashboard, href: "/" },
    { id: "staff", label: "员工管理", icon: UserCheck, href: "/staff" },
    { id: "users", label: "用户管理", icon: Users, href: "/users" },
    { id: "cases", label: "案件管理", icon: Scale, href: "/cases" },
    { id: "evidence", label: "证据管理", icon: Shield, href: "/evidence" },
  ]

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6 border-b">
        <div className="flex items-center space-x-2">
          <FileText className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">法律管理系统</h1>
        </div>
      </div>

      <nav className="mt-6">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link href={item.href} key={item.id} passHref legacyBehavior>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start px-6 py-3 text-left",
                  activeModule === item.id && "bg-blue-50 text-blue-600 border-r-2 border-blue-600",
                )}
                as="a"
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-0 w-64 p-6 border-t">
        <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
          <LogOut className="mr-3 h-5 w-5" />
          退出登录
        </Button>
      </div>
    </div>
  )
}
