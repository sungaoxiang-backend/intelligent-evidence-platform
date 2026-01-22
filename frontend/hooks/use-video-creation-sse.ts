import { useState, useCallback, useRef, useEffect } from 'react'
import { API_CONFIG } from '@/lib/config'

export interface Message {
    id?: number
    role: 'user' | 'assistant' | 'system'
    content: string
    message_metadata?: {
        tool_calls?: Array<{
            name: string
            params: any
            status: string
            result?: any
        }>
        skill_hits?: string[]
        streaming_status?: string
    }
    createdAt?: Date
}

export interface StreamChunk {
    type: 'text' | 'tool_call' | 'skill_hit' | 'thinking' | 'error' | 'done' | 'status' | 'heartbeat'
    content: string
    metadata: any
}

export interface QuickAction {
    id: string
    label: string
    prompt: string
    description: string
    icon: string
}

export function useVideoCreationSSE(sessionId: number) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // 当前流式消息的累积内容
    const streamingMessageRef = useRef<Message>({
        role: 'assistant',
        content: '',
        message_metadata: {
            tool_calls: [],
            skill_hits: [],
            streaming_status: 'streaming'
        }
    })

    // 加载历史消息
    useEffect(() => {
        if (!sessionId) {
            setMessages([])
            return
        }

        const loadMessages = async () => {
            try {
                // 动态导入以避免循环依赖（如果需要），或者直接使用已有的 api导入
                // 这里假设 api-video-creation 已在顶部导入或者可以导入
                // 由于 useVideoCreationSSE 在 hooks 目录，api 在 lib 目录，应该没问题
                // 但原文件未导入 videoCreationApi，需在顶部添加导入
                const { videoCreationApi } = await import('@/lib/api-video-creation')
                const history = await videoCreationApi.getSessionMessages(sessionId)
                setMessages(history)
            } catch (err) {
                console.error('加载历史消息失败:', err)
                setError('加载历史消息失败')
            }
        }

        loadMessages()
    }, [sessionId])

    const sendMessage = useCallback(async (content: string) => {
        // 1. 添加用户消息
        const userMessage: Message = {
            role: 'user',
            content,
            createdAt: new Date()
        }
        setMessages(prev => [...prev, userMessage])

        // 2. 重置流式消息
        streamingMessageRef.current = {
            role: 'assistant',
            content: '',
            message_metadata: {
                tool_calls: [],
                skill_hits: [],
                streaming_status: 'streaming'
            }
        }

        // 3. 建立 SSE 连接
        setIsStreaming(true)
        setError(null)

        try {
            const response = await fetch(
                `${API_CONFIG.BASE_URL}/video-creation/sessions/${sessionId}/chat`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem(API_CONFIG.TOKEN_KEY)}`
                    },
                    body: JSON.stringify({ content })
                }
            )

            if (!response.ok) {
                throw new Error('请求失败')
            }

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('无法获取响应流')
            }

            // 4. 读取 SSE 流
            let buffer = ''

            // 4. 读取 SSE 流
            while (true) {
                const { done, value } = await reader.read()

                if (done) {
                    break
                }

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')

                // 保留最后一个可能不完整的行到下一次处理
                buffer = lines.pop() || ''

                for (const line of lines) {
                    const trimmedLine = line.trim()
                    if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue

                    const data = trimmedLine.slice(6)
                    try {
                        const event: StreamChunk = JSON.parse(data)
                        handleStreamEvent(event)
                    } catch (e) {
                        console.error('解析 SSE 数据失败:', e)
                    }
                }
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : '未知错误')
            setIsStreaming(false)
        }
    }, [sessionId])

    const handleStreamEvent = useCallback((event: StreamChunk) => {
        switch (event.type) {
            case 'text':
                // 累积文本内容
                streamingMessageRef.current.content += event.content
                setMessages(prev => {
                    const newMessages = [...prev]
                    // 查找是否已存在流式 assistant 消息
                    const lastAssistantIndex = newMessages.findIndex(
                        m => m.role === 'assistant' && m.message_metadata?.streaming_status === 'streaming'
                    )

                    if (lastAssistantIndex >= 0) {
                        // 更新已存在的流式消息
                        newMessages[lastAssistantIndex] = { ...streamingMessageRef.current }
                    } else {
                        // 检查最后一条消息是否是用户消息（刚发送的）
                        const lastMessage = newMessages[newMessages.length - 1]
                        if (lastMessage?.role === 'user') {
                            // 用户消息之后，添加新的 assistant 消息
                            newMessages.push({ ...streamingMessageRef.current })
                        } else if (lastMessage?.role === 'assistant') {
                            // 如果最后是 assistant 消息但不是 streaming 状态，更新它
                            newMessages[newMessages.length - 1] = { ...streamingMessageRef.current }
                        } else {
                            // 其他情况，添加新消息
                            newMessages.push({ ...streamingMessageRef.current })
                        }
                    }
                    return newMessages
                })
                break

            case 'tool_call':
                // 记录工具调用
                if (event.metadata.tool_name) {
                    streamingMessageRef.current.message_metadata!.tool_calls!.push({
                        name: event.metadata.tool_name,
                        params: event.metadata.params,
                        status: event.metadata.result ? 'completed' : 'started',
                        result: event.metadata.result
                    })
                }
                break

            case 'skill_hit':
                // 记录技能命中
                if (event.metadata.skill_name) {
                    streamingMessageRef.current.message_metadata!.skill_hits!.push(event.metadata.skill_name)
                }
                break

            case 'done':
                // 流式完成
                streamingMessageRef.current.message_metadata!.streaming_status = 'completed'
                streamingMessageRef.current.id = event.metadata.message_id
                setMessages(prev => {
                    const newMessages = [...prev]
                    // 找到最后一个 assistant 消息并更新
                    for (let i = newMessages.length - 1; i >= 0; i--) {
                        if (newMessages[i].role === 'assistant') {
                            newMessages[i] = { ...streamingMessageRef.current }
                            break
                        }
                    }
                    return newMessages
                })
                setIsStreaming(false)
                break

            case 'error':
                setError(event.content)
                setIsStreaming(false)
                break

            case 'status':
            case 'heartbeat':
                // 忽略状态和心跳消息，只用于保持连接
                // 不需要做任何处理
                break
        }
    }, [])

    return {
        messages,
        isStreaming,
        error,
        sendMessage
    }
}
