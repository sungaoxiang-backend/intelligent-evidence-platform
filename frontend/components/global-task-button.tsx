import { useState } from 'react'
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
  ChevronUp
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

  const runningTasks = tasks.filter(task => task.status === 'running' || task.status === 'pending')
  const completedTasks = tasks.filter(task => ['success', 'failure', 'revoked'].includes(task.status))
  const failedTasks = tasks.filter(task => task.status === 'failure')

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

  const getStatusText = (status: TaskProgress['status']) => {
    switch (status) {
      case 'pending': return '等待中'
      case 'running': return '运行中'
      case 'success': return '已完成'
      case 'failure': return '失败'
      case 'revoked': return '已取消'
      default: return '未知'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
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
          tasks.length === 0 && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={tasks.length === 0}
      >
        <BarChart3 className="h-4 w-4 mr-2" />
        任务 ({tasks.length})
        
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
        "absolute top-12 right-0 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border transition-all duration-300 ease-out",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      )}>
        {/* 面板头部 */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="font-medium">任务列表</span>
            <Badge variant="secondary" className="text-xs">
              {tasks.length}
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
          {tasks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              暂无任务
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {tasks.map((task) => (
                <div
                  key={task.taskId}
                  className="p-2 rounded-md border bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  {/* 任务头部 - 紧凑布局 */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      {getTaskIcon(task.status)}
                      <span className="text-sm font-medium truncate">
                        #{task.taskId.slice(-6)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className="text-xs px-1 py-0 h-4"
                      >
                        {getStatusText(task.status)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-muted-foreground">
                        {formatTime(task.updatedAt)}
                      </span>
                      
                      {/* 重试按钮 - 只对失败的任务显示 */}
                      {task.status === 'failure' && onRetryTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:text-blue-600"
                          onClick={() => onRetryTask(task.taskId)}
                          title="重试任务"
                        >
                          <Activity className="h-3 w-3" />
                        </Button>
                      )}
                      
                      {/* 刷新按钮 - 对运行中的任务显示 */}
                      {task.status === 'running' && onRefreshTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:text-green-600"
                          onClick={() => onRefreshTask(task.taskId)}
                          title="刷新状态"
                        >
                          <Clock className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:text-destructive"
                        onClick={() => onRemoveTask(task.taskId)}
                        disabled={task.status === 'running'}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 进度条 - 简化版本 */}
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground truncate">
                      {task.message}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={task.progress} 
                        className="h-1 flex-1"
                      />
                      <span className="text-xs text-muted-foreground min-w-[30px]">
                        {task.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  )
}