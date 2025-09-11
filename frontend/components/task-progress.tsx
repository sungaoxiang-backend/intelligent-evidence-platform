import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  X, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { TaskProgress } from '@/hooks/use-celery-tasks'
import { cn } from '@/lib/utils'

interface TaskProgressItemProps {
  task: TaskProgress
  onRemove: (taskId: string) => void
  isExpanded: boolean
  onToggle: () => void
}

function TaskProgressItem({ task, onRemove, isExpanded, onToggle }: TaskProgressItemProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'revoked':
        return <AlertCircle className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadgeVariant = (): "secondary" | "default" | "destructive" | "outline" => {
    switch (task.status) {
      case 'pending':
        return 'secondary'
      case 'running':
        return 'default'
      case 'success':
        return 'default'
      case 'failure':
        return 'destructive'
      case 'revoked':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getStatusText = () => {
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

  const getProgressColor = () => {
    switch (task.status) {
      case 'success':
        return 'bg-green-500'
      case 'failure':
        return 'bg-red-500'
      case 'running':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <Card className={cn(
      "mb-2 transition-all duration-300",
      task.status === 'running' && "border-blue-200 shadow-md",
      task.status === 'success' && "border-green-200",
      task.status === 'failure' && "border-red-200"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium truncate">
                  智能证据分析 #{task.taskId.slice(-8)}
                </span>
                <Badge variant={getStatusBadgeVariant()} className="text-xs">
                  {getStatusText()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {task.message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggle}
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:text-destructive"
              onClick={() => onRemove(task.taskId)}
              disabled={task.status === 'running'}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-2">
          <Progress 
            value={task.progress} 
            className={cn("h-1", getProgressColor())}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-muted-foreground">
              {task.progress}%
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(task.updatedAt)}
            </span>
          </div>
        </div>

        {/* 展开的详细信息 */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <div className="text-xs text-muted-foreground">
              <span>任务ID: {task.taskId}</span>
            </div>
            
            {task.result && (
              <div className="text-xs">
                <span className="text-muted-foreground">结果: </span>
                <span className="text-green-600">{JSON.stringify(task.result, null, 2)}</span>
              </div>
            )}
            
            {task.error && (
              <div className="text-xs">
                <span className="text-muted-foreground">错误: </span>
                <span className="text-red-600">{task.error}</span>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground">
              <span>创建时间: {task.createdAt.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TaskProgressPanelProps {
  tasks: TaskProgress[]
  onRemoveTask: (taskId: string) => void
  className?: string
}

export function TaskProgressPanel({ tasks, onRemoveTask, className }: TaskProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const runningTasks = tasks.filter(task => task.status === 'running' || task.status === 'pending')
  const completedTasks = tasks.filter(task => ['success', 'failure', 'revoked'].includes(task.status))

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <>
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out;
        }
        
        .animate-pulse-fast {
          animation: pulse 1s infinite;
        }
      `}</style>
      
      <div className={cn("fixed top-4 right-4 z-50", className)}>
      {/* 折叠状态 - 显示任务计数 */}
      {!isExpanded && (
        <Button
          variant="default"
          size="sm"
          className="relative shadow-lg bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 animate-slide-in-right"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">
              任务进度 ({runningTasks.length})
            </span>
            {runningTasks.length > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse-fast" />
            )}
          </div>
        </Button>
      )}

      {/* 展开状态 - 显示任务详情 */}
      {isExpanded && (
        <Card className="w-80 max-h-96 shadow-xl border-0 bg-background/95 backdrop-blur animate-slide-in-right">
          <CardContent className="p-4">
            {/* 面板头部 */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold">任务进度</h3>
                <Badge variant="secondary" className="text-xs">
                  {tasks.length}
                </Badge>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* 运行中的任务 */}
            {runningTasks.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  运行中 ({runningTasks.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {runningTasks.map(task => (
                    <TaskProgressItem
                      key={task.taskId}
                      task={task}
                      onRemove={onRemoveTask}
                      isExpanded={expandedTasks.has(task.taskId)}
                      onToggle={() => toggleTaskExpanded(task.taskId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 已完成的任务 */}
            {completedTasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  已完成 ({completedTasks.length})
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto opacity-75">
                  {completedTasks.map(task => (
                    <TaskProgressItem
                      key={task.taskId}
                      task={task}
                      onRemove={onRemoveTask}
                      isExpanded={expandedTasks.has(task.taskId)}
                      onToggle={() => toggleTaskExpanded(task.taskId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 空状态 */}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无任务</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  </>
  )
}
