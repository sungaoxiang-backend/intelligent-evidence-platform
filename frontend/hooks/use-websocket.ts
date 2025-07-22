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
          setProgress({
            status: data.status,
            message: data.message,
            progress: data.status === 'uploaded' ? 20 : 
                     data.status === 'loaded' ? 40 :
                     data.status === 'classified' ? 70 :
                     data.status === 'features_extracted' ? 90 : 0
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

  const startAutoProcess = useCallback((params: {
    case_id: number
    evidence_ids: number[]
    auto_classification: boolean
    auto_feature_extraction: boolean
  }) => {
    setIsProcessing(true)
    
    // 构建WebSocket URL
    const wsUrl = API_CONFIG.BASE_URL.replace('http', 'ws') + '/evidences/ws/auto-process'
    const ws = connect(wsUrl)
    
    // 设置连接超时（30秒）
    timeoutRef.current = setTimeout(() => {
      console.warn('WebSocket连接超时，正在断开...')
      disconnect()
      setIsProcessing(false)
    }, 30000)
    
    // 等待连接建立后再发送消息
    ws.onopen = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      sendMessage(params)
    }
    
    return ws
  }, [connect, sendMessage, disconnect])

  // 监听进度完成，清理超时
  useEffect(() => {
    if (progress?.status === 'completed' || progress?.status === 'error') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      setIsProcessing(false)
    }
  }, [progress])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    isConnected,
    progress,
    error,
    isProcessing,
    startAutoProcess,
    disconnect
  }
} 