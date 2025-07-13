"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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
  ChevronDown,
  ChevronRight,
  List,
  Brain,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

// 添加 navigation 数组定义
const navigation = [
  { name: "仪表板", href: "/dashboard", icon: LayoutDashboard },
  { name: "员工管理", href: "/staffs", icon: UserCheck },
  { name: "用户管理", href: "/users", icon: Users },
  { name: "案件管理", href: "/cases", icon: FileText },
  { name: "证据管理", href: "/evidences", icon: FolderOpen },
  { name: "系统设置", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const [isClient, setIsClient] = useState(false);
  
  // 使用持久化状态
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-expanded-items');
      return saved ? JSON.parse(saved) : ['证据管理'];
    }
    return ['证据管理'];
  });

  // 确保只在客户端渲染时显示激活状态
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 保存状态到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar-expanded-items', JSON.stringify(expandedItems));
    }
  }, [expandedItems]);

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

  const handleLogout = async () => {
    try {
      await logout();
      queryClient.clear();
      router.push('/login');
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isItemActive = (href: string, children?: any[]) => {
    if (!isClient) return false; // 服务端渲染时返回 false
    if (children) {
      return children.some(child => pathname === child.href || pathname.startsWith(child.href + '/'));
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">智能证据平台</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = isItemActive(item.href, item.children);
          const isExpanded = expandedItems.includes(item.name);
          const hasChildren = item.children && item.children.length > 0;

          return (
            <div key={item.name}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpanded(item.name)}
                  onMouseEnter={() => handleLinkHover(item.href)}
                  className={cn(
                    "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  <span className="flex-1 text-left">{item.name}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  onMouseEnter={() => handleLinkHover(item.href)}
                  // 修改按钮和链接的className
                  className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  // 移除 transition-colors 或添加条件
                  "transition-colors duration-150", // 缩短动画时间
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )}
              
              {/* 子菜单 */}
              {hasChildren && isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={cn(
                          "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isChildActive
                            ? "bg-gray-700 text-white"
                            : "text-gray-400 hover:bg-gray-700 hover:text-white"
                        )}
                      >
                        <child.icon className="mr-3 h-4 w-4" />
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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