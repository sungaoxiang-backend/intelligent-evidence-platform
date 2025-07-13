"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  FolderOpen,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
// 删除这行重复的导入：import { useRouter } from "next/navigation";

const navigation = [
  {
    name: "仪表板",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "员工管理",
    href: "/staffs",
    icon: UserCheck,
  },
  {
    name: "用户管理",
    href: "/users",
    icon: Users,
  },
  {
    name: "案件管理",
    href: "/cases",
    icon: FileText,
  },
  {
    name: "证据管理",
    href: "/evidences",
    icon: FolderOpen,
  },
  {
    name: "系统设置",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  // 预加载数据
  const handleLinkHover = (href: string) => {
    if (href === '/users') {
      queryClient.prefetchQuery({
        queryKey: ['users', 1, 10],
        queryFn: () => apiClient.getUsers({ skip: 0, limit: 10 }),
        staleTime: 30000,
      });
    } else if (href === '/staffs') {
      queryClient.prefetchQuery({
        queryKey: ['staffs', 1, 10],
        queryFn: () => apiClient.getStaffs({ skip: 0, limit: 10 }),
        staleTime: 30000,
      });
    }
  };

  // 添加这个函数
  const handleLogout = async () => {
    try {
      await logout();
      // 清除所有查询缓存
      queryClient.clear();
      // 重定向到登录页
      router.push('/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">智能证据平台</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onMouseEnter={() => handleLinkHover(item.href)}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-5 w-5" />
          退出登录
        </Button>
      </div>
    </div>
  );
}