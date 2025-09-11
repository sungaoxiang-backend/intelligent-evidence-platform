import { useState, useEffect, useCallback, useRef } from 'react'
import { evidenceApi, taskApi } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { API_CONFIG } from '@/lib/config'

// 导入认证头函数
function getAuthHeader(): Record<string, string> {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token') || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
  return {}
}

// 构建API URL函数
function buildApiUrl(path: string): string {
  return API_CONFIG.BASE_URL + path
}

export interface TaskProgress {
  taskId: string
  status: 'pending' | 'running' | 'success' | 'failure' | 'revoked'
  progress: number
  message: string
  result?: any
  error?: string
  createdAt: Date
  updatedAt: Date
}

interface TaskQueue {
  tasks: TaskProgress[]
  addTask: (taskId: string) => void
  removeTask: (taskId: string) => void
  updateTask: (taskId: string, updates: Partial<TaskProgress>) => void
  clearAllTasks: () => void
  clearCompletedTasks: () => void
  retryTask: (taskId: string) => void
  refreshTask: (taskId: string) => void
}

export function useCeleryTasks(): TaskQueue {
  const [tasks, setTasks] = useState<TaskProgress[]>([])
  const pollingRefs = useRef<Record<string, NodeJS.Timeout>>({})
  const { toast } = useToast()

  // 从localStorage加载任务
  useEffect(() => {
    const savedTasks = localStorage.getItem('celery-tasks')
    if (savedTasks) {
      try {
        const parsedTasks = JSON.parse(savedTasks).map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt)
        }))
        setTasks(parsedTasks)
        console.log('从localStorage加载任务:', parsedTasks)
      } catch (error) {
        console.error('加载任务失败:', error)
      }
    }
  }, [])

  // 保存任务到localStorage
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('celery-tasks', JSON.stringify(tasks))
      console.log('保存任务到localStorage:', tasks)
    } else {
      localStorage.removeItem('celery-tasks')
    }
  }, [tasks])

  // 添加任务到队列
  const addTask = useCallback((taskId: string) => {
    console.log('添加任务到队列:', taskId)
    setTasks(prev => {
      // 避免重复添加相同任务
      if (prev.some(task => task.taskId === taskId)) {
        console.log('任务已存在，跳过添加:', taskId)
        return prev
      }
      
      const newTask: TaskProgress = {
        taskId,
        status: 'pending',
        progress: 0,
        message: '任务已提交，等待开始...',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      console.log('成功添加新任务:', newTask)
      return [...prev, newTask]
    })
  }, [])

  // 从队列移除任务
  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.taskId !== taskId))
    
    // 清除轮询定时器
    if (pollingRefs.current[taskId]) {
      clearInterval(pollingRefs.current[taskId])
      delete pollingRefs.current[taskId]
    }
  }, [])

  // 更新任务状态
  const updateTask = useCallback((taskId: string, updates: Partial<TaskProgress>) => {
    setTasks(prev => prev.map(task => 
      task.taskId === taskId 
        ? { ...task, ...updates, updatedAt: new Date() }
        : task
    ))
  }, [])

  // 清理所有任务
  const clearAllTasks = useCallback(() => {
    // 清除所有轮询定时器
    Object.values(pollingRefs.current).forEach(timer => {
      clearInterval(timer)
    })
    pollingRefs.current = {}
    
    setTasks([])
    localStorage.removeItem('celery-tasks')
    console.log('已清理所有任务')
  }, [])

  // 清理已完成的任务
  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => {
      const runningTasks = prev.filter(task => 
        task.status === 'pending' || task.status === 'running'
      )
      console.log('已清理已完成的任务，保留运行中任务:', runningTasks.length)
      return runningTasks
    })
  }, [])


  // 查询任务状态
  const pollTaskStatus = useCallback(async (taskId: string) => {
    try {
      console.log('查询任务状态:', taskId)
      const url = buildApiUrl(`/tasks/status/${taskId}`)
      console.log('请求URL:', url)
      
      // 使用后端提供的Celery任务状态查询API
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      })
      
      console.log('响应状态:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API错误响应:', errorText)
        throw new Error(`查询任务状态失败: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // 转换Celery状态到我们的状态系统
      let taskStatus: TaskProgress['status'] = 'pending'
      let progress = 0
      let message = ''
      
      switch (data.status) {
        case 'PENDING':
          taskStatus = 'pending'
          progress = 0
          message = '任务等待中...'
          break
        case 'STARTED':
        case 'RETRY':
        case 'PROGRESS':
          taskStatus = 'running'
          progress = data.info?.current ? Math.round((data.info.current / data.info.total) * 100) : 30
          message = data.info?.status || '任务执行中...'
          break
        case 'SUCCESS':
          taskStatus = 'success'
          progress = 100
          message = '任务完成'
          break
        case 'FAILURE':
          taskStatus = 'failure'
          progress = data.info?.current ? Math.round((data.info.current / data.info.total) * 100) : 0
          message = data.info?.error || '任务失败'
          break
        case 'REVOKED':
          taskStatus = 'revoked'
          progress = data.info?.current ? Math.round((data.info.current / data.info.total) * 100) : 0
          message = '任务已取消'
          break
        default:
          taskStatus = 'pending'
          progress = 0
          message = '未知状态'
      }
      
      // 更新任务状态
      console.log('更新任务状态:', taskId, '状态:', taskStatus, '进度:', progress)
      updateTask(taskId, {
        status: taskStatus,
        progress: progress,
        message: message,
        result: data.result,
        error: data.error
      })

      // 根据状态处理 - 不再自动清理任务，让用户手动控制
      if (taskStatus === 'success') {
        console.log('任务成功完成:', taskId, data)
        // 任务完成后不再自动移除，让用户手动清理
        
      } else if (taskStatus === 'failure') {
        console.log('任务失败:', taskId, data)
        // 任务失败后不再自动移除，让用户查看错误信息
        
      } else if (taskStatus === 'revoked') {
        console.log('任务被取消:', taskId, data)
        // 任务取消后不再自动移除
      }
      
      return data
      
    } catch (error) {
      console.error('查询任务状态失败:', error)
      
      // 查询失败时，标记任务为失败状态
      updateTask(taskId, {
        status: 'failure',
        error: '查询任务状态失败'
      })
      
      // 查询失败的通知由useTaskNotifications处理
      return null
    }
  }, [updateTask, removeTask, toast])

  // 开始轮询任务状态
  const startPolling = useCallback((taskId: string, intervalMs: number = 1000) => {
    // 如果已经有轮询定时器，先清除
    if (pollingRefs.current[taskId]) {
      clearInterval(pollingRefs.current[taskId])
    }
    
    // 记录任务开始时间，用于超时检测
    const startTime = Date.now()
    const maxPollingTime = 5 * 60 * 1000 // 5分钟超时
    
    // 立即查询一次
    pollTaskStatus(taskId)
    
    // 设置轮询定时器
    pollingRefs.current[taskId] = setInterval(() => {
      // 检查是否超时
      if (Date.now() - startTime > maxPollingTime) {
        console.warn(`任务 ${taskId} 轮询超时，停止轮询`)
        updateTask(taskId, {
          status: 'failure',
          message: '任务轮询超时，请检查任务状态',
          error: '任务轮询超过5分钟未完成'
        })
        if (pollingRefs.current[taskId]) {
          clearInterval(pollingRefs.current[taskId])
          delete pollingRefs.current[taskId]
        }
        return
      }
      
      pollTaskStatus(taskId).then(data => {
        // 如果任务已完成、失败或被取消，停止轮询
        if (data && ['SUCCESS', 'FAILURE', 'REVOKED'].includes(data.status)) {
          if (pollingRefs.current[taskId]) {
            clearInterval(pollingRefs.current[taskId])
            delete pollingRefs.current[taskId]
          }
        }
      }).catch(error => {
        console.error(`轮询任务 ${taskId} 时发生错误:`, error)
        // 连续错误超过3次，停止轮询
        const errorCount = (pollingRefs.current[`${taskId}_errors`] as unknown as number || 0) + 1
        pollingRefs.current[`${taskId}_errors`] = errorCount as any
        
        if (errorCount >= 3) {
          console.warn(`任务 ${taskId} 连续错误 ${errorCount} 次，停止轮询`)
          updateTask(taskId, {
            status: 'failure',
            message: '任务轮询连续失败',
            error: `连续轮询失败 ${errorCount} 次: ${error.message}`
          })
          if (pollingRefs.current[taskId]) {
            clearInterval(pollingRefs.current[taskId])
            delete pollingRefs.current[taskId]
          }
        }
      })
    }, intervalMs)
  }, [pollTaskStatus, updateTask])

  // 重试任务（重新开始轮询）
  const retryTask = useCallback((taskId: string) => {
    console.log('重试任务:', taskId)
    
    // 重置任务状态
    updateTask(taskId, {
      status: 'pending',
      progress: 0,
      message: '重新开始任务...',
      error: undefined
    })
    
    // 清除错误计数
    delete pollingRefs.current[`${taskId}_errors`]
    
    // 重新开始轮询
    setTimeout(() => {
      startPolling(taskId, 2000)
    }, 100)
    
    toast({
      title: '任务重试',
      description: `任务 ${taskId.slice(-6)} 已重新开始`,
    })
  }, [updateTask, startPolling, toast])

  // 刷新任务状态（手动查询一次）
  const refreshTask = useCallback(async (taskId: string) => {
    console.log('手动刷新任务状态:', taskId)
    
    try {
      await pollTaskStatus(taskId)
      toast({
        title: '任务状态已刷新',
        description: `任务 ${taskId.slice(-6)} 状态已更新`,
      })
    } catch (error) {
      console.error('刷新任务状态失败:', error)
      toast({
        title: '刷新失败',
        description: '无法获取任务最新状态',
        variant: 'destructive'
      })
    }
  }, [pollTaskStatus, toast])

  // 修改 addTask 函数，在 startPolling 定义后添加轮询逻辑
  const addTaskWithPolling = useCallback((taskId: string) => {
    console.log('addTaskWithPolling 被调用:', taskId)
    // 先添加任务
    addTask(taskId)
    // 然后启动轮询
    setTimeout(() => {
      console.log('启动任务轮询:', taskId)
      startPolling(taskId, 2000) // 每2秒轮询一次
    }, 100)
  }, [addTask, startPolling])

  // 停止轮询任务状态
  const stopPolling = useCallback((taskId: string) => {
    if (pollingRefs.current[taskId]) {
      clearInterval(pollingRefs.current[taskId])
      delete pollingRefs.current[taskId]
    }
  }, [])

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      Object.values(pollingRefs.current).forEach(timer => {
        clearInterval(timer)
      })
      pollingRefs.current = {}
    }
  }, [])

  console.log('useCeleryTasks 返回 tasks:', tasks)
  
  return {
    tasks,
    addTask: addTaskWithPolling,
    removeTask,
    updateTask,
    clearAllTasks,
    clearCompletedTasks,
    retryTask,
    refreshTask
  }
}

// 专门用于证据智能分析的Hook
export function useEvidenceAnalysis(tasksHook?: { addTask: (taskId: string) => void; updateTask: (taskId: string, updates: Partial<TaskProgress>) => void; removeTask: (taskId: string) => void }) {
  const defaultTasksHook = useCeleryTasks()
  const { addTask, updateTask, removeTask } = tasksHook || defaultTasksHook
  const { toast } = useToast()

  const startEvidenceAnalysis = useCallback(async (params: {
    case_id: number
    evidence_ids: (number | string)[]
    auto_classification: boolean
    auto_feature_extraction: boolean
  }) => {
    try {
      console.log('启动智能分析任务，参数:', params)
      
      // 使用真实的Celery API启动批量证据分析任务
      const result = await taskApi.startBatchAnalyzeEvidences(params.case_id, params.evidence_ids.map(id => Number(id)))
      console.log('批量分析任务已启动:', result)
      
      // 为每个任务ID添加到任务队列
      console.log('准备添加任务到队列，任务IDs:', result.task_ids)
      result.task_ids.forEach(taskId => {
        console.log('调用 addTask 添加任务:', taskId)
        addTask(taskId)
      })
      
      toast({
        title: '任务已启动',
        description: result.message || '智能分析任务已成功启动，请稍候...',
      })

      return { taskIds: result.task_ids, success: true }

    } catch (error) {
      console.error('启动智能分析失败:', error)
      
      const errorMessage = error instanceof Error ? error.message : '启动智能分析任务失败'
      const errorDetails = error instanceof Error && 'response' in error ? JSON.stringify(error.response) : ''
      
      console.error('错误详情:', errorDetails)
      
      toast({
        title: '启动失败',
        description: errorMessage,
        variant: 'destructive'
      })

      return { taskIds: [], success: false }
    }
  }, [addTask, toast])

  return {
    startEvidenceAnalysis
  }
}