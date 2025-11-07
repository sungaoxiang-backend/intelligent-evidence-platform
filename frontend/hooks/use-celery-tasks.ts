import { useState, useEffect, useCallback, useRef } from 'react'
import { evidenceApi, taskApi, evidenceCardApi } from '@/lib/api'
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
  // 新增业务上下文信息
  context?: {
    type: 'evidence_analysis' | 'document_processing' | 'case_analysis' | 'other'
    title: string // 任务标题，如"证据智能分析"
    description: string // 任务描述，如"分析3个证据文件"
    caseId?: number // 关联的案件ID
    caseTitle?: string // 案件标题
    pagePath?: string // 启动任务的页面路径
    pageTitle?: string // 页面标题
    evidenceCount?: number // 证据数量
    evidenceTypes?: string[] // 证据类型
    metadata?: Record<string, any> // 其他元数据
  }
}

interface TaskQueue {
  tasks: TaskProgress[]
  addTask: (taskId: string, context?: TaskProgress['context']) => void
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
    }
    // 注意：不要在这里自动删除localStorage，只有在用户明确操作时才删除
  }, [tasks])

  // 添加任务到队列
  const addTask = useCallback((taskId: string, context?: TaskProgress['context']) => {
    console.log('添加任务到队列:', taskId, context)
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
        updatedAt: new Date(),
        context
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
        ? { 
            ...task, 
            ...updates, 
            // 每次更新都更新 updatedAt 字段，除非明确提供了新的 updatedAt 值
            updatedAt: updates.updatedAt || new Date()
          }
        : task
    ))
    
    // 如果任务状态变为失败、成功或取消，停止轮询
    if (updates.status && ['failure', 'success', 'revoked'].includes(updates.status)) {
      console.log(`任务 ${taskId} 状态变为 ${updates.status}，停止轮询`)
      if (pollingRefs.current[taskId]) {
        clearInterval(pollingRefs.current[taskId])
        delete pollingRefs.current[taskId]
      }
    }
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
      
      // 更新localStorage，只保留运行中的任务
      if (runningTasks.length > 0) {
        localStorage.setItem('celery-tasks', JSON.stringify(runningTasks))
      } else {
        localStorage.removeItem('celery-tasks')
      }
      
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
      
      // 添加调试日志
      console.log('Celery任务状态响应:', {
        taskId,
        status: data.status,
        info: data.info,
        result: data.result
      })
      
      // 详细显示info对象内容
      if (data.info) {
        console.log('🔍 Info对象详情:', {
          status: data.info.status,
          message: data.info.message,
          progress: data.info.progress,
          current: data.info.current,
          total: data.info.total
        })
      } else {
        console.log('⚠️ Info对象为空或undefined')
      }
      
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
          // 优先使用后端传递的精确进度值，支持字符串和数字格式
          if (data.info?.progress !== undefined) {
            progress = typeof data.info.progress === 'string' ? parseInt(data.info.progress) : data.info.progress
          } else if (data.info?.current !== undefined && data.info?.total !== undefined && data.info.total > 0) {
            progress = Math.round((data.info.current / data.info.total) * 100)
          } else {
            // 如果没有进度数据，保持当前进度不变，避免跳跃
            const currentTask = tasks.find(t => t.taskId === taskId)
            progress = currentTask?.progress || 0
            console.warn(`⚠️ 缺少进度数据，保持当前进度: ${progress}%`)
          }
          
          // 根据后端的具体状态显示不同的消息
          const backendStatus = data.info?.status
          if (backendStatus) {
            const statusMessages: Record<string, string> = {
              'processing': '开始证据分析处理',
              'uploaded': '文件上传完成',
              'classifying': '正在分类证据',
              'classified': '证据分类完成', 
              'extracting': '正在提取特征',
              'ocr_processing': 'OCR处理中',
              'llm_processing': 'AI特征提取中',
              'features_extracted': '特征提取完成',
              'role_annotation': '证据角色标注中',
              'role_annotated': '证据角色标注完成',
              'completed': '分析完成',
              'validating': '验证案件信息',
              'started': '任务已开始'
            }
            message = statusMessages[backendStatus] || data.info?.message || '任务执行中...'
          } else {
            message = data.info?.message || '任务执行中...'
          }
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
      console.log('🔄 更新任务状态:', taskId, '状态:', taskStatus, '进度:', progress, '消息:', message)
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
  const addTaskWithPolling = useCallback((taskId: string, context?: TaskProgress['context']) => {
    console.log('addTaskWithPolling 被调用:', taskId, context)
    // 先添加任务
    addTask(taskId, context)
    // 然后启动轮询
    setTimeout(() => {
      console.log('启动任务轮询:', taskId)
      startPolling(taskId, 2000) // 每2秒轮询一次
    }, 100) // 短暂延迟，避免立即触发状态变化通知
  }, [addTask, startPolling])

  // 停止轮询任务状态
  const stopPolling = useCallback((taskId: string) => {
    if (pollingRefs.current[taskId]) {
      clearInterval(pollingRefs.current[taskId])
      delete pollingRefs.current[taskId]
    }
  }, [])

  // 处理任务加载后的轮询启动
  useEffect(() => {
    // 只对运行中的任务重新启动轮询，失败和已完成的任务不轮询
    tasks.forEach((task: TaskProgress) => {
      if ((task.status === 'pending' || task.status === 'running') && !pollingRefs.current[task.taskId]) {
        console.log('重新启动轮询:', task.taskId, task.status)
        startPolling(task.taskId, 2000)
      } else if (['failure', 'success', 'revoked'].includes(task.status) && pollingRefs.current[task.taskId]) {
        console.log('停止已完成/失败任务的轮询:', task.taskId, task.status)
        if (pollingRefs.current[task.taskId]) {
          clearInterval(pollingRefs.current[task.taskId])
          delete pollingRefs.current[task.taskId]
        }
      }
    })
  }, [tasks, startPolling])

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
export function useEvidenceAnalysis(tasksHook?: { addTask: (taskId: string, context?: TaskProgress['context']) => void; updateTask: (taskId: string, updates: Partial<TaskProgress>) => void; removeTask: (taskId: string) => void }) {
  const defaultTasksHook = useCeleryTasks()
  const { addTask, updateTask, removeTask } = tasksHook || defaultTasksHook
  const { toast } = useToast()

  const startEvidenceAnalysis = useCallback(async (params: {
    case_id: number
    evidence_ids: (number | string)[]
    auto_classification: boolean
    auto_feature_extraction: boolean
    caseTitle?: string
    evidenceTypes?: string[]
  }) => {
    try {
      console.log('启动智能分析任务，参数:', params)
      
      // 使用真实的Celery API启动真实证据分析任务
      const result = await taskApi.startRealAnalyzeEvidences(params.case_id, params.evidence_ids.map(id => Number(id)))
      console.log('真实证据分析任务已启动:', result)
      
      // 构建任务上下文信息
      const taskContext: TaskProgress['context'] = {
        type: 'evidence_analysis',
        title: '证据智能分析',
        description: `分析 ${params.evidence_ids.length} 个证据文件`,
        caseId: params.case_id,
        caseTitle: params.caseTitle || `案件 ${params.case_id}`,
        pagePath: `/cases/${params.case_id}?tab=evidence`,
        pageTitle: '独立证据分析',
        evidenceCount: params.evidence_ids.length,
        evidenceTypes: params.evidenceTypes || [],
        metadata: {
          auto_classification: params.auto_classification,
          auto_feature_extraction: params.auto_feature_extraction
        }
      }
      
      // 为每个任务ID添加到任务队列
      console.log('准备添加任务到队列，任务IDs:', result.task_ids)
      result.task_ids.forEach(taskId => {
        console.log('调用 addTask 添加任务:', taskId)
        addTask(taskId, taskContext)
      })
      
      // 移除这里的toast通知，让useTaskNotifications统一处理
      // toast({
      //   title: '任务已启动',
      //   description: result.message || '智能分析任务已成功启动，请稍候...',
      // })

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

// 专门用于关联证据分析的Hook
export function useAssociationEvidenceAnalysis(tasksHook?: { addTask: (taskId: string, context?: TaskProgress['context']) => void; updateTask: (taskId: string, updates: Partial<TaskProgress>) => void; removeTask: (taskId: string) => void }) {
  const defaultTasksHook = useCeleryTasks()
  const { addTask, updateTask, removeTask } = tasksHook || defaultTasksHook
  const { toast } = useToast()

  const startAssociationEvidenceAnalysis = useCallback(async (params: {
    case_id: number
    evidence_ids: (number | string)[]
    caseTitle?: string
    evidenceTypes?: string[]
  }) => {
    try {
      console.log('启动关联证据分析任务，参数:', params)
      
      // 使用关联证据分析API
      const result = await taskApi.startAssociationAnalyzeEvidences(params.case_id, params.evidence_ids.map(id => Number(id)))
      console.log('关联证据分析任务已启动:', result)
      
      // 构建任务上下文信息
      const taskContext: TaskProgress['context'] = {
        type: 'evidence_analysis',
        title: '关联证据分析',
        description: `分析 ${params.evidence_ids.length} 个微信聊天记录证据`,
        caseId: params.case_id,
        caseTitle: params.caseTitle || `案件 ${params.case_id}`,
        pagePath: `/cases/${params.case_id}?tab=reasoning`,
        pageTitle: '关联证据分析',
        evidenceCount: params.evidence_ids.length,
        evidenceTypes: params.evidenceTypes || ['微信聊天记录'],
        metadata: {
          analysis_type: 'association',
          evidence_category: '微信聊天记录'
        }
      }
      
      // 为每个任务ID添加到任务队列
      console.log('准备添加关联证据分析任务到队列，任务IDs:', result.task_ids)
      result.task_ids.forEach(taskId => {
        console.log('调用 addTask 添加关联证据分析任务:', taskId)
        addTask(taskId, taskContext)
      })

      return { taskIds: result.task_ids, success: true }

    } catch (error) {
      console.error('启动关联证据分析失败:', error)
      
      const errorMessage = error instanceof Error ? error.message : '启动关联证据分析任务失败'
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
    startAssociationEvidenceAnalysis
  }
}

// 专门用于证据卡片铸造的Hook
export function useCardCasting(tasksHook?: { addTask: (taskId: string, context?: TaskProgress['context']) => void; updateTask: (taskId: string, updates: Partial<TaskProgress>) => void; removeTask: (taskId: string) => void }) {
  const defaultTasksHook = useCeleryTasks()
  const { addTask, updateTask, removeTask } = tasksHook || defaultTasksHook
  const { toast } = useToast()

  const startCardCasting = useCallback(async (params: {
    case_id: number
    evidence_ids: (number | string)[]
    caseTitle?: string
    card_id?: number // 重铸时的卡片ID
    skip_classification?: boolean // 是否跳过分类
    target_card_type?: string // 目标分类（更新分类时使用）
  }) => {
    try {
      console.log('启动卡片铸造任务，参数:', params)
      
      // 使用证据卡片API启动卡片铸造任务
      const result = await evidenceCardApi.castEvidenceCards({
        case_id: params.case_id,
        evidence_ids: params.evidence_ids.map(id => Number(id)),
        card_id: params.card_id,
        skip_classification: params.skip_classification || false,
        target_card_type: params.target_card_type
      })
      
      console.log('卡片铸造任务已启动:', result)
      
      // 构建任务上下文信息
      const taskContext: TaskProgress['context'] = {
        type: 'evidence_analysis',
        title: params.card_id ? `重铸卡片 #${params.card_id}` : '证据卡片铸造',
        description: params.card_id 
          ? `重铸卡片 #${params.card_id}，使用 ${params.evidence_ids.length} 个证据重新提取特征`
          : `铸造 ${params.evidence_ids.length} 个证据的卡片`,
        caseId: params.case_id,
        caseTitle: params.caseTitle || `案件 ${params.case_id}`,
        pagePath: `/cases/${params.case_id}?tab=card-factory`,
        pageTitle: '卡片工厂',
        evidenceCount: params.evidence_ids.length,
        metadata: {
          operation: params.card_id ? 'card_recasting' : 'card_casting',
          card_id: params.card_id
        }
      }
      
      // 添加任务到队列
      console.log('准备添加卡片铸造任务到队列，任务ID:', result.task_id)
      addTask(result.task_id, taskContext)

      return { taskId: result.task_id, success: true }

    } catch (error) {
      console.error('启动卡片铸造失败:', error)
      
      const errorMessage = error instanceof Error ? error.message : '启动卡片铸造任务失败'
      
      toast({
        title: '启动失败',
        description: errorMessage,
        variant: 'destructive'
      })

      return { taskId: '', success: false }
    }
  }, [addTask, toast])

  return {
    startCardCasting
  }
}