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
  const isCompletedRef = useRef(false)

  const connect = useCallback((url: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }

    const ws = new WebSocket(url)
    wsRef.current = ws
    connectionIdRef.current = Math.random().toString(36).substring(2, 11)
    isCompletedRef.current = false

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
          isCompletedRef.current = true
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
          // 根据状态设置进度 - 严格按照真实事件
          let progressValue = 0
          if (data.status === 'classifying') {
            progressValue = 10
          } else if (data.status === 'classified') {
            progressValue = 30
          } else if (data.status === 'extracting') {
            progressValue = 40
          } else if (data.status === 'ocr_processing') {
            progressValue = 50
          } else if (data.status === 'ocr_success') {
            progressValue = 70
          } else if (data.status === 'ocr_error') {
            progressValue = 70  // OCR错误不影响整体进度
          } else if (data.status === 'llm_processing') {
            progressValue = 80
          } else if (data.status === 'features_extracted') {
            progressValue = 90
          } else if (data.status === 'completed') {
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
      // 只有在非完成状态下才清除进度
      if (!isCompletedRef.current) {
        setProgress(null)
      }
      setError(null)
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
  const onCompleteRef = useRef<(() => void) | null>(null)

  const startAutoProcess = useCallback((params: {
    case_id: number
    evidence_ids: number[]
    auto_classification: boolean
    auto_feature_extraction: boolean
  }, onComplete?: () => void) => {
    setIsProcessing(true)
    onCompleteRef.current = onComplete || null
    
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

  // 监听进度完成或错误
  useEffect(() => {
    if (progress?.status === 'completed') {
      // 完成后延迟关闭连接和重置状态
      setTimeout(() => {
        setIsProcessing(false)
        // 调用完成回调
        if (onCompleteRef.current) {
          onCompleteRef.current()
        }
      }, 2000)
    } else if (progress?.status === 'error') {
      // 错误状态立即清理
      setIsProcessing(false)
    }
  }, [progress])

  // 监听错误状态，重置处理状态
  useEffect(() => {
    if (error) {
      setIsProcessing(false)
    }
  }, [error])

  return {
    isConnected,
    progress,
    error,
    isProcessing,
    startAutoProcess,
    disconnect
  }
} 