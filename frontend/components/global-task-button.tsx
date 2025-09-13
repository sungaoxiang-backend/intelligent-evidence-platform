import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TaskProgress } from '@/hooks/use-celery-tasks'
import { 
  BarChart3, 
  X, 
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Search,
  Building
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalTaskButtonProps {
  tasks: TaskProgress[]
  onRemoveTask: (taskId: string) => void
  onClearAll?: () => void
  onClearCompleted?: () => void
  onRetryTask?: (taskId: string) => void
  onRefreshTask?: (taskId: string) => void
  className?: string
}

export function GlobalTaskButton({ tasks, onRemoveTask, onClearAll, onClearCompleted, onRetryTask, onRefreshTask, className }: GlobalTaskButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  // 按创建时间排序，最新添加的在上方
  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  const runningTasks = sortedTasks.filter(task => task.status === 'running' || task.status === 'pending')
  const completedTasks = sortedTasks.filter(task => ['success', 'failure', 'revoked'].includes(task.status))
  const failedTasks = sortedTasks.filter(task => task.status === 'failure')

  // 处理任务点击导航
  const handleTaskClick = (task: TaskProgress) => {
    if (task.context?.pagePath) {
      router.push(task.context.pagePath)
      setIsOpen(false)
    }
  }

  // 获取任务类型图标
  const getTaskTypeIcon = (type?: string) => {
    switch (type) {
      case 'evidence_analysis':
        return <Search className="h-3 w-3 text-blue-500" />
      case 'document_processing':
        return <FileText className="h-3 w-3 text-green-500" />
      case 'case_analysis':
        return <Building className="h-3 w-3 text-purple-500" />
      default:
        return <BarChart3 className="h-3 w-3 text-gray-500" />
    }
  }

  // 格式化任务显示文本
  const getTaskDisplayText = (task: TaskProgress) => {
    if (task.context) {
      return {
        title: task.context.title,
        subtitle: task.context.description,
        caseInfo: task.context.caseTitle ? `案件: ${task.context.caseTitle}` : undefined
      }
    }
    
    // 回退到任务ID显示
    return {
      title: `任务 ${task.taskId.slice(-6)}`,
      subtitle: task.message,
      caseInfo: undefined
    }
  }

  const getTaskIcon = (status: TaskProgress['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="h-3 w-3 text-blue-500" />
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />
      case 'success':
        return <CheckCircle className="h-3 w-3 text-green-500" />
      case 'failure':
        return <XCircle className="h-3 w-3 text-red-500" />
      default:
        return <BarChart3 className="h-3 w-3 text-gray-500" />
    }
  }

  const getStatusText = (task: TaskProgress) => {
    // 对于运行中的任务，优先使用后端传递的具体状态消息
    if (task.status === 'running' && task.message) {
      return task.message
    }
    
    // 对于其他状态，使用默认的状态文本
    switch (task.status) {
      case 'pending': 
        return '等待中'
      case 'running': 
        return '运行中'
      case 'success': 
        return '已完成'
      case 'failure': 
        return '失败'
      case 'revoked': 
        return '已取消'
      default: 
        return '未知'
    }
  }

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

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date()
    const diffMs = end.getTime() - startTime.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes % 60}m`
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ${diffSeconds % 60}s`
    } else {
      return `${diffSeconds}s`
    }
  }

  return (
    <>
      <style jsx>{`
        @keyframes wave {
          0% {
            transform: scale(1);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
      <div className={cn("fixed top-4 right-4 z-50", className)}>
      {/* 任务按钮 */}
        <Button
        variant={failedTasks.length > 0 ? "destructive" : runningTasks.length > 0 ? "default" : "secondary"}
        size="sm"
        className={cn(
          "relative shadow-lg transition-all duration-200 hover:shadow-xl",
          sortedTasks.length === 0 && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={sortedTasks.length === 0}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        任务 ({sortedTasks.length})
        
        {/* 状态指示器 - 使用柔和的wave动画 */}
        {runningTasks.length > 0 && (
          <div className="absolute -top-1 -right-1 w-2 h-2">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-pulse" />
            <div 
              className="absolute inset-0 bg-blue-400 rounded-full opacity-40" 
              style={{ 
                animation: 'wave 2s ease-in-out infinite',
                transformOrigin: 'center'
              }} 
            />
          </div>
        )}
        {failedTasks.length > 0 && (
          <Badge variant="destructive" className="ml-2 px-1 py-0 text-xs min-w-[16px] h-[16px] flex items-center justify-center">
            {failedTasks.length}
          </Badge>
        )}
      </Button>

      {/* 任务面板 */}
      <div className={cn(
        "absolute top-12 right-0 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border transition-all duration-300 ease-out",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      )}>
        {/* 面板头部 */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="font-medium">任务列表</span>
            <Badge variant="secondary" className="text-xs">
              {sortedTasks.length}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* 清理按钮 */}
            {completedTasks.length > 0 && onClearCompleted && (
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
            {tasks.length > 0 && onClearAll && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={onClearAll}
                title="清理所有任务"
              >
                清空
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 任务列表 */}
        <div className="max-h-[300px] overflow-y-auto">
          {sortedTasks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              暂无任务
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {sortedTasks.map((task) => {
                const displayText = getTaskDisplayText(task)
                const isClickable = task.context?.pagePath
                const evidenceCount = task.context?.evidenceCount || 0
                const caseId = task.context?.caseId
                const duration = formatDuration(task.createdAt, task.status === 'success' || task.status === 'failure' ? task.updatedAt : undefined)
                
                return (
                  <div
                    key={task.taskId}
                    className={cn(
                      "relative p-3 rounded-lg border transition-all duration-200 overflow-hidden",
                      isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.01]",
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
                        <span>{formatDateTime(task.createdAt)}</span>
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
      </div>
      </div>
    </>
  )
}