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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Home, Scale, Users, UserCheck, Bell, Plus, Search, Moon, Sun, User, LogOut, BarChart3, X, Activity, Clock, ExternalLink, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"
import type { Staff } from "@/lib/config"
import { TaskProgress } from "@/hooks/use-celery-tasks"
import { cn } from "@/lib/utils"

interface TopNavigationProps {
  userRole: string
  currentUser: Staff | null
  onLogout: () => void
  tasks?: TaskProgress[]
  onRemoveTask?: (taskId: string) => void
  onClearAll?: () => void
  onClearCompleted?: () => void
  onRetryTask?: (taskId: string) => void
  onRefreshTask?: (taskId: string) => void
}

export function TopNavigation({ userRole, currentUser, onLogout, tasks = [], onRemoveTask, onClearAll, onClearCompleted, onRetryTask, onRefreshTask }: TopNavigationProps) {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()

  const getActiveModule = () => {
    if (pathname.startsWith("/cases")) return "cases"
    if (pathname.startsWith("/users")) return "users"
    if (pathname.startsWith("/staff")) return "staff"
    if (pathname.startsWith("/profile")) return "profile"
    return "workbench"
  }
  const activeModule = getActiveModule()

  const navigationItems = [
    { id: "workbench", label: "工作台", icon: Home, href: "/" },
    { id: "users", label: "用户管理", icon: Users, href: "/users" },
    { id: "cases", label: "案件管理", icon: Scale, href: "/cases" },
  ]

  if (userRole === "admin") {
    navigationItems.push({ id: "staff", label: "员工管理", icon: UserCheck, href: "/staff" })
  }

  // 任务相关逻辑
  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  
  const runningTasks = sortedTasks.filter(task => task.status === 'running' || task.status === 'pending')
  const completedTasks = sortedTasks.filter(task => ['success', 'failure', 'revoked'].includes(task.status))
  const failedTasks = sortedTasks.filter(task => task.status === 'failure')

  // 格式化时间
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  // 格式化耗时
  const formatDuration = (start: Date, end?: Date) => {
    if (!end) return '进行中'
    const duration = end.getTime() - start.getTime()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`
    } else {
      return `${seconds}秒`
    }
  }

  // 获取状态文本
  const getStatusText = (task: TaskProgress) => {
    if (task.status === 'running' && task.message) {
      return task.message
    }
    
    switch (task.status) {
      case 'pending': return '等待中'
      case 'running': return '运行中'
      case 'success': return '已完成'
      case 'failure': return '失败'
      case 'revoked': return '已取消'
      default: return '未知'
    }
  }

  // 处理任务点击导航
  const handleTaskClick = (task: TaskProgress) => {
    if (task.context?.pagePath) {
      window.location.href = task.context.pagePath
    }
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
                <h1 className="text-base font-bold text-foreground leading-none">汇法律 智能证物平台</h1>
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
                placeholder="搜索案件、用户..."
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

            {/* 任务下拉菜单 */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "relative h-7 px-2 text-muted-foreground hover:text-foreground",
                    (runningTasks.length > 0 || failedTasks.length > 0) && "text-foreground"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">任务列表</span>
                  
                  {/* 任务数量徽章 */}
                  {tasks.length > 0 && (
                    <Badge 
                      variant={failedTasks.length > 0 ? "destructive" : runningTasks.length > 0 ? "default" : "secondary"}
                      className="ml-1 h-4 px-1 text-xs"
                    >
                      {tasks.length}
                    </Badge>
                  )}
                  
                  {/* 运行中状态指示器 */}
                  {runningTasks.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-pulse" />
                      <div 
                        className="absolute inset-0 bg-blue-400 rounded-full opacity-40" 
                        style={{
                          animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                        }}
                      />
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                align="end" 
                className={cn(
                  "w-96 p-0",
                  // 根据任务数量自适应高度，最大为屏幕高度的80%
                  `max-h-[80vh] overflow-hidden`
                )}
                sideOffset={8}
                side="bottom"
                alignOffset={-16}
                avoidCollisions={true}
                collisionPadding={16}
              >
                {/* 任务面板头部 */}
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">任务列表</span>
                    <Badge variant="secondary" className="text-xs">
                      {tasks.length}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {onClearCompleted && completedTasks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={onClearCompleted}
                        title="清理已完成任务"
                      >
                        清理完成
                      </Button>
                    )}
                    
                    {onClearAll && tasks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={onClearAll}
                        title="清空所有任务"
                      >
                        清空
                      </Button>
                    )}
                  </div>
                </div>

                {/* 任务列表 */}
                <div className="max-h-[60vh] overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">暂无任务</p>
                      <p className="text-sm">任务将在开始处理后显示在这里</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {sortedTasks.map((task) => {
                        const evidenceCount = task.context?.evidenceCount || 0
                        const caseId = task.context?.caseId
                        const duration = formatDuration(task.createdAt, task.status === 'success' || task.status === 'failure' ? task.updatedAt : undefined)
                        const isClickable = task.context?.pagePath
                        
                        return (
                          <div
                            key={task.taskId}
                            className={cn(
                              "relative p-3 rounded-lg border transition-all duration-200 overflow-hidden cursor-pointer",
                              isClickable && "hover:shadow-md hover:scale-[1.01]",
                              // 使用渐变背景实现进度条效果
                              task.status === 'success' && `border-green-200 bg-gradient-to-r from-green-50 via-green-100 to-green-50 dark:from-green-900/20 dark:via-green-800/30 dark:to-green-900/20`,
                              task.status === 'failure' && `border-red-200 bg-gradient-to-r from-red-50 via-red-100 to-red-50 dark:from-red-900/20 dark:via-red-800/30 dark:to-red-900/20`,
                              task.status === 'running' && `border-blue-200 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 dark:from-blue-900/20 dark:via-blue-800/30 dark:to-blue-900/20`,
                              task.status === 'pending' && "border-gray-200 bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800"
                            )}
                            onClick={() => isClickable && handleTaskClick(task)}
                            style={{
                              // 动态调整渐变位置来显示进度
                              background: task.status === 'success' 
                                ? `linear-gradient(to right, #dcfce7 0%, #bbf7d0 ${task.progress}%, #f0fdf4 ${task.progress}%, #f0fdf4 100%)`
                                : task.status === 'failure'
                                ? `linear-gradient(to right, #fef2f2 0%, #fecaca ${task.progress}%, #fef7f7 ${task.progress}%, #fef7f7 100%)`
                                : task.status === 'running'
                                ? `linear-gradient(to right, #eff6ff 0%, #dbeafe ${task.progress}%, #f8fafc ${task.progress}%, #f8fafc 100%)`
                                : `linear-gradient(to right, #f9fafb 0%, #f3f4f6 ${task.progress}%, #f9fafb ${task.progress}%, #f9fafb 100%)`
                            }}
                          >
                            {/* 顶部：案件标题 + 操作按钮 */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {task.context?.caseTitle || `案件 ${caseId}`}
                              </div>
                              
                              {/* 操作按钮 */}
                              <div className="flex items-center space-x-1">
                                {isClickable && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-white/50 dark:hover:bg-gray-800/50"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleTaskClick(task)
                                    }}
                                    title="查看案件"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {task.status === 'failure' && onRetryTask && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-white/50 dark:hover:bg-gray-800/50"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onRetryTask(task.taskId)
                                    }}
                                    title="重试任务"
                                  >
                                    <Activity className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {task.status === 'running' && onRefreshTask && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-white/50 dark:hover:bg-gray-800/50"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onRefreshTask(task.taskId)
                                    }}
                                    title="刷新状态"
                                  >
                                    <Clock className="h-3 w-3" />
                                  </Button>
                                )}
                                
                                {onRemoveTask && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-white/50 dark:hover:bg-gray-800/50"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onRemoveTask(task.taskId)
                                    }}
                                    disabled={task.status === 'running'}
                                    title="删除任务"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {/* 中间：进度条和状态描述 */}
                            <div className="mb-3">
                              {/* 进度条 */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                                  <div 
                                    className="h-2 rounded-full transition-all duration-300 ease-out"
                                    style={{
                                      width: `${task.progress}%`,
                                      backgroundColor: task.status === 'success' ? '#10b981' : 
                                                    task.status === 'failure' ? '#ef4444' : 
                                                    task.status === 'running' ? '#3b82f6' : '#6b7280'
                                    }}
                                  />
                                </div>
                                <div className="text-sm font-bold text-gray-800 dark:text-gray-200 min-w-[3rem] text-right">
                                  {task.progress}%
                                </div>
                              </div>
                              
                              {/* 状态描述 - 带动画效果 */}
                              <div className="flex items-center">
                                <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                                  {task.status === 'running' ? (
                                    <div className="flex items-center">
                                      <span className="animate-pulse">{getStatusText(task)}</span>
                                      <span className="ml-1 flex">
                                        <span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
                                        <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
                                        <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <span>{getStatusText(task)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* 底部：时间信息 + 证据数量 */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center space-x-2">
                                <span>{formatDateTime(task.updatedAt)}</span>
                                <span>•</span>
                                <span>耗时: {duration}</span>
                              </div>
                              
                              {/* 右下角：证据数量 + 图标 */}
                              <div className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span className="font-medium">{evidenceCount}个证据</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

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

