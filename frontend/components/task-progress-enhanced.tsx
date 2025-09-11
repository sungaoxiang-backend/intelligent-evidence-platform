import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { TaskProgress } from '@/hooks/use-celery-tasks'
import { 
  X, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  RotateCcw,
  Download,
  Eye,
  Filter,
  Trash2,
  Zap,
  Target,
  Shield,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskProgressItemEnhancedProps {
  task: TaskProgress
  onRemove: (taskId: string) => void
  isExpanded: boolean
  onToggle: () => void
  onRetry?: (taskId: string) => void
  showDetails?: boolean
}

function TaskProgressItemEnhanced({ task, onRemove, isExpanded, onToggle, onRetry, showDetails = true }: TaskProgressItemEnhancedProps) {
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

  const getStatusBadgeVariant = (): "secondary" | "default" | "destructive" | "outline" | "success" => {
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

  const formatDuration = (start: Date, end: Date) => {
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

  // 渲染分析结果
  const renderAnalysisResult = () => {
    if (!task.result) return null

    const { result } = task
    
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* 风险等级 */}
          <div className="flex items-center space-x-2 p-2 bg-red-50 rounded-lg">
            <Shield className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">风险等级</p>
              <p className="text-sm font-medium text-red-600">{result.risk_level || '未知'}</p>
            </div>
          </div>
          
          {/* 有效性评分 */}
          <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">有效性评分</p>
              <p className="text-sm font-medium text-green-600">{result.validity_score || 0}分</p>
            </div>
          </div>
        </div>

        {/* 关键发现 */}
        {result.key_findings && result.key_findings.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center space-x-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span>关键发现</span>
            </h5>
            <ul className="space-y-1">
              {result.key_findings.map((finding: string, index: number) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start space-x-1">
                  <div className="w-1 h-1 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 建议 */}
        {result.recommendations && result.recommendations.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center space-x-1">
              <Target className="h-3 w-3 text-blue-500" />
              <span>建议</span>
            </h5>
            <ul className="space-y-1">
              {result.recommendations.map((rec: string, index: number) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start space-x-1">
                  <div className="w-1 h-1 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 处理时间 */}
        {result.analysis_time && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">处理时间</span>
            <span className="text-xs font-medium">{result.analysis_time}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={cn(
      "mb-3 transition-all duration-300 hover:shadow-md",
      task.status === 'running' && "border-blue-200 shadow-md bg-gradient-to-r from-blue-50 to-transparent",
      task.status === 'success' && "border-green-200 bg-gradient-to-r from-green-50 to-transparent",
      task.status === 'failure' && "border-red-200 bg-gradient-to-r from-red-50 to-transparent"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1">
            {getStatusIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium truncate">
                  智能证据分析 #{task.taskId.slice(-8)}
                </span>
                <Badge variant={getStatusBadgeVariant()} className="text-xs">
                  {getStatusText()}
                </Badge>
                
                {/* 进度百分比（仅在运行时显示） */}
                {task.status === 'running' && (
                  <Badge variant="outline" className="text-xs">
                    {task.progress}%
                  </Badge>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground truncate">
                {task.message}
              </p>
              
              {/* 时间信息 */}
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatTime(task.updatedAt)}
                </span>
                {task.status !== 'running' && task.status !== 'pending' && (
                  <>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      耗时: {formatDuration(task.createdAt, task.updatedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* 展开/收起按钮 */}
            {showDetails && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onToggle}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {/* 重试按钮（仅失败状态显示） */}
            {task.status === 'failure' && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600"
                onClick={() => onRetry(task.taskId)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            
            {/* 移除按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:text-destructive"
              onClick={() => onRemove(task.taskId)}
              disabled={task.status === 'running'}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 进度条 */}
        {task.status === 'running' || task.status === 'pending' || (task.progress > 0 && task.progress < 100) ? (
          <div className="mb-3">
            <Progress 
              value={task.progress} 
              className={cn("h-2", getProgressColor())}
            />
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                进度: {task.progress}%
              </span>
              {task.status === 'running' && (
                <span className="text-xs text-blue-600 font-medium animate-pulse">
                  处理中...
                </span>
              )}
            </div>
          </div>
        ) : null}

        {/* 展开的详细信息 */}
        {isExpanded && showDetails && (
          <div className="mt-4 pt-3 border-t space-y-4">
            {/* 任务信息 */}
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-muted-foreground">任务信息</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">任务ID: </span>
                  <span className="font-mono text-xs">{task.taskId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">状态: </span>
                  <span className={cn(
                    "font-medium",
                    task.status === 'success' && "text-green-600",
                    task.status === 'failure' && "text-red-600",
                    task.status === 'running' && "text-blue-600"
                  )}>
                    {getStatusText()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">创建时间: </span>
                  <span>{task.createdAt.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">更新时间: </span>
                  <span>{task.updatedAt.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* 分析结果 */}
            {task.result && renderAnalysisResult()}

            {/* 错误信息 */}
            {task.error && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-red-600">错误信息</h5>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">{task.error}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface TaskProgressPanelEnhancedProps {
  tasks: TaskProgress[]
  onRemoveTask: (taskId: string) => void
  onRetryTask?: (taskId: string) => void
  className?: string
  maxHeight?: string
  showFilters?: boolean
  showDetails?: boolean
}

export function TaskProgressPanelEnhanced({ 
  tasks, 
  onRemoveTask, 
  onRetryTask,
  className,
  maxHeight = "400px",
  showFilters = true,
  showDetails = true
}: TaskProgressPanelEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all')

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

  // 过滤任务
  const filteredTasks = tasks.filter(task => {
    switch (filter) {
      case 'running':
        return task.status === 'running' || task.status === 'pending'
      case 'completed':
        return task.status === 'success' || task.status === 'revoked'
      case 'failed':
        return task.status === 'failure'
      default:
        return true
    }
  })

  const runningTasks = filteredTasks.filter(task => task.status === 'running' || task.status === 'pending')
  const completedTasks = filteredTasks.filter(task => ['success', 'revoked'].includes(task.status))
  const failedTasks = filteredTasks.filter(task => task.status === 'failure')

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">暂无任务</p>
        <p className="text-sm">任务将在开始处理后显示在这里</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 控制面板 */}
      {showFilters && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">筛选:</span>
            <div className="flex space-x-1">
              {[
                { key: 'all', label: '全部', count: tasks.length },
                { key: 'running', label: '运行中', count: runningTasks.length },
                { key: 'completed', label: '已完成', count: completedTasks.length + tasks.filter(t => t.status === 'revoked').length },
                { key: 'failed', label: '失败', count: failedTasks.length }
              ].map(({ key, label, count }) => (
                <Button
                  key={key}
                  variant={filter === key ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setFilter(key as any)}
                >
                  {label} ({count})
                </Button>
              ))}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <span className="ml-1 text-xs">{isExpanded ? '收起' : '展开'}</span>
          </Button>
        </div>
      )}

      {/* 任务列表 */}
      {isExpanded && (
        <ScrollArea className={cn("rounded-lg border", maxHeight && `max-h-[${maxHeight}]`)}>
          <div className="p-2 space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">没有符合条件的任务</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <TaskProgressItemEnhanced
                  key={task.taskId}
                  task={task}
                  onRemove={onRemoveTask}
                  onRetry={onRetryTask}
                  isExpanded={expandedTasks.has(task.taskId)}
                  onToggle={() => toggleTaskExpanded(task.taskId)}
                  showDetails={showDetails}
                />
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {/* 统计信息 */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-muted rounded-lg">
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{runningTasks.length}</div>
          <div className="text-xs text-muted-foreground">运行中</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{completedTasks.length}</div>
          <div className="text-xs text-muted-foreground">已完成</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{failedTasks.length}</div>
          <div className="text-xs text-muted-foreground">失败</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-600">{tasks.length}</div>
          <div className="text-xs text-muted-foreground">总计</div>
        </div>
      </div>
    </div>
  )
}