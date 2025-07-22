import { useState, useEffect, useCallback, useRef } from 'react'
import { API_CONFIG } from '@/lib/config'

interface ProgressUpdate {
  status: string
  message: string
  progress?: number
}

interface WebSocketMessage {
  status: string
  message: string
  data?: any
  error?: string
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [progress, setProgress] = useState<ProgressUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const connectionIdRef = useRef<string | null>(null)

  const connect = useCallback((url: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const ws = new WebSocket(url)
    wsRef.current = ws
    connectionIdRef.current = Math.random().toString(36).substring(2, 11) // 生成连接ID

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
      console.log(`WebSocket连接已建立 [ID: ${connectionIdRef.current}]:`, url)
    }

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data)
        
        if (data.error) {
          setError(data.error)
          return
        }

        if (data.status === 'error') {
          setError(data.message)
          return
        }

        if (data.status === 'completed') {
          setProgress({
            status: 'completed',
            message: data.message,
            progress: 100
          })
          // 完成后延迟关闭连接
          setTimeout(() => {
            ws.close()
          }, 2000)
        } else {
          // 根据状态设置进度
          let progressValue = 0
          if (data.status === 'classifying') {
            progressValue = 0
          } else if (data.status === 'classified') {
            progressValue = 50
          } else if (data.status === 'extracting') {
            progressValue = 50
          } else if (data.status === 'features_extracted') {
            progressValue = 100
          }
          
          setProgress({
            status: data.status,
            message: data.message,
            progress: progressValue
          })
        }
      } catch (e) {
        console.error('WebSocket消息解析错误:', e)
      }
    }

    ws.onerror = (event) => {
      console.error(`WebSocket连接错误 [ID: ${connectionIdRef.current}]:`, event)
      setError('WebSocket连接错误')
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      console.log(`WebSocket连接已关闭 [ID: ${connectionIdRef.current}]:`, event.code, event.reason)
      setIsConnected(false)
      setProgress(null)
      setError(null) // 清除错误状态
      connectionIdRef.current = null
    }

    return ws
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      connectionIdRef.current = null
    }
  }, [])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      setError('WebSocket未连接')
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    progress,
    error,
    connect,
    disconnect,
    sendMessage
  }
}

// 专门用于auto-process的hook
export function useAutoProcessWebSocket() {
  const { isConnected, progress, error, connect, disconnect, sendMessage } = useWebSocket()
  const [isProcessing, setIsProcessing] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [localProgress, setLocalProgress] = useState<ProgressUpdate | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const phaseStartTimeRef = useRef<number | null>(null)
  const onCompleteRef = useRef<(() => void) | null>(null)

  const startAutoProcess = useCallback((params: {
    case_id: number
    evidence_ids: number[]
    auto_classification: boolean
    auto_feature_extraction: boolean
  }, onComplete?: () => void) => {
    setIsProcessing(true)
    startTimeRef.current = Date.now()
    phaseStartTimeRef.current = Date.now() // 初始化阶段开始时间
    onCompleteRef.current = onComplete || null
    
    // 立即设置初始状态
    setLocalProgress({
      status: 'classifying',
      message: '开始证据分类分析',
      progress: 0
    })
    
    // 开始平滑进度更新
    startSmoothProgress()
    
    // 构建WebSocket URL
    const wsUrl = API_CONFIG.BASE_URL.replace('http', 'ws') + '/evidences/ws/auto-process'
    const ws = connect(wsUrl)
    
    // 监听连接建立事件
    const handleOpen = () => {
      console.log('WebSocket onopen triggered')
      
      // 延迟一点时间确保连接完全建立
      setTimeout(() => {
        console.log('Sending WebSocket message:', params)
        sendMessage(params)
      }, 100)
    }
    
    // 如果连接已经建立，立即处理
    if (ws.readyState === WebSocket.OPEN) {
      handleOpen()
    } else {
      // 否则监听onopen事件
      ws.addEventListener('open', handleOpen)
    }
    
    return ws
  }, [connect, sendMessage])

  // 随机进度更新函数
  const startSmoothProgress = useCallback(() => {
    // 清除之前的定时器
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    
    // 每2-4秒随机更新一次进度
    const updateProgress = () => {
      if (!startTimeRef.current || !phaseStartTimeRef.current) return
      
      setLocalProgress(prev => {
        if (!prev) return prev
        
        let targetProgress = 0
        
        if (prev.status === 'classifying') {
          // 分类阶段：0-50%，随机在0-45%之间
          const currentProgress = prev.progress || 0
          const maxProgress = 45
          const minIncrement = 3 // 最小增量3%
          const maxIncrement = 8 // 最大增量8%
          const increment = Math.random() * (maxIncrement - minIncrement) + minIncrement
          targetProgress = Math.min(currentProgress + increment, maxProgress)
          
          console.log(`分类阶段: 当前${currentProgress.toFixed(1)}% -> ${targetProgress.toFixed(1)}%`)
          
        } else if (prev.status === 'classified' || prev.status === 'extracting') {
          // 特征提取阶段：50-100%，随机在50-95%之间
          const currentProgress = prev.progress || 50
          const maxProgress = 95
          const minIncrement = 3 // 最小增量3%
          const maxIncrement = 8 // 最大增量8%
          const increment = Math.random() * (maxIncrement - minIncrement) + minIncrement
          targetProgress = Math.min(currentProgress + increment, maxProgress)
          
          console.log(`特征提取阶段: 当前${currentProgress.toFixed(1)}% -> ${targetProgress.toFixed(1)}%`)
          
        } else if (prev.status === 'features_extracted') {
          // 特征提取完成，保持100%
          targetProgress = 100
        }
        
        return {
          ...prev,
          progress: targetProgress
        }
      })
    }
    
    // 立即执行一次
    updateProgress()
    
    // 每2-4秒随机更新一次
    progressIntervalRef.current = setInterval(() => {
      updateProgress()
    }, 2000 + Math.random() * 2000) // 2-4秒随机间隔
  }, [])

  // 监听进度完成或错误，清理超时
  useEffect(() => {
    if (progress?.status === 'completed' || progress?.status === 'error') {
      // 停止平滑进度更新
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      // 如果是完成状态，先显示100%的完成样式
      if (progress?.status === 'completed') {
        setLocalProgress({
          status: 'completed',
          message: progress.message,
          progress: 100
        })
        
        // 3秒后开始清理，给前端足够时间显示完成状态
        setTimeout(() => {
          setIsProcessing(false)
          // 调用完成回调
          if (onCompleteRef.current) {
            onCompleteRef.current()
          }
          // 再延迟1秒清理本地进度状态
          setTimeout(() => {
            setLocalProgress(null)
          }, 1000)
        }, 3000)
      } else {
        // 错误状态立即清理
        setIsProcessing(false)
        setTimeout(() => {
          setLocalProgress(null)
        }, 1000)
      }
    } else if (progress?.status) {
      // 收到后端状态更新，更新状态和消息，但保持平滑进度
      
      // 如果状态发生变化，重置阶段开始时间
      if (progress.status !== localProgress?.status) {
        phaseStartTimeRef.current = Date.now()
      }
      
      setLocalProgress(prev => {
        if (!prev) {
          // 如果没有本地进度，创建新的
          let exactProgress = 0
          if (progress.status === 'classifying') {
            exactProgress = 0
          } else if (progress.status === 'classified') {
            exactProgress = 50
          } else if (progress.status === 'extracting') {
            exactProgress = 50
          } else if (progress.status === 'features_extracted') {
            exactProgress = 100
          }
          
          return {
            status: progress.status,
            message: progress.message,
            progress: exactProgress
          }
        }
        
        // 只更新状态和消息，保持当前进度值
        return {
          ...prev,
          status: progress.status,
          message: progress.message
        }
      })
    }
  }, [progress])

  // 监听错误状态，重置处理状态
  useEffect(() => {
    if (error) {
      // 停止平滑进度更新
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      
      setIsProcessing(false)
      // 清理本地进度状态
      setTimeout(() => {
        setLocalProgress(null)
      }, 1000)
    }
  }, [error])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  return {
    isConnected,
    progress: localProgress || progress,
    error,
    isProcessing,
    startAutoProcess,
    disconnect
  }
} 