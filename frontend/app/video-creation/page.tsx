"use client"

import { useState, useEffect } from 'react'
import { videoCreationApi } from '@/lib/api-video-creation'
import { useVideoCreationSSE } from '@/hooks/use-video-creation-sse'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, Trash2, Zap } from 'lucide-react'
import { ChatInterface } from '@/components/video-creation/chat-interface'
import { ChatInput } from '@/components/video-creation/chat-input'
import { QuickActions } from '@/components/video-creation/quick-actions'

interface Session {
    id: number
    title: string
    created_at: string
    updated_at: string
    last_message?: string
}

export default function VideoCreationPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
    const [isCreatingSession, setIsCreatingSession] = useState(false)

    const { messages, isStreaming, error, sendMessage } = useVideoCreationSSE(currentSessionId || 0)

    // 加载会话列表
    useEffect(() => {
        loadSessions()
    }, [])

    const loadSessions = async () => {
        try {
            const data = await videoCreationApi.getSessions()
            setSessions(data)

            // 如果有会话但没有选中，自动选中第一个
            if (data.length > 0 && !currentSessionId) {
                setCurrentSessionId(data[0].id)
            }
        } catch (err) {
            console.error('加载会话失败:', err)
        }
    }

    const handleCreateSession = async () => {
        setIsCreatingSession(true)
        try {
            const newSession = await videoCreationApi.createSession()
            setSessions(prev => [newSession, ...prev])
            setCurrentSessionId(newSession.id)
        } catch (err) {
            console.error('创建会话失败:', err)
        } finally {
            setIsCreatingSession(false)
        }
    }

    const handleDeleteSession = async (sessionId: number) => {
        if (!confirm('确定要删除这个会话吗？')) return

        try {
            await videoCreationApi.deleteSession(sessionId)
            setSessions(prev => prev.filter(s => s.id !== sessionId))

            // 如果删除的是当前会话，切换到第一个会话
            if (currentSessionId === sessionId) {
                const remaining = sessions.filter(s => s.id !== sessionId)
                setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null)
            }
        } catch (err) {
            console.error('删除会话失败:', err)
        }
    }

    const handleSendMessage = async (content: string) => {
        if (!currentSessionId) {
            // 如果没有会话，先创建一个
            try {
                const newSession = await videoCreationApi.createSession()
                setSessions(prev => [newSession, ...prev])
                setCurrentSessionId(newSession.id)
                // 等待状态更新后发送
                setTimeout(() => {
                    // 手动调用 hook 里的 sendMessage 可能会有点问题如果 session ID 还没变
                    // 但这里的闭包可能会有问题？hook 是基于 props currentSessionId 的
                    // 实际上 setCurrentSessionId 触发 re-render, hook 会更新
                    // 但 setTimeout 里能否获取到新的 hook 实例？
                    // 我们需要一种方式将 message 传递给新的 session。
                    // 暂时的 workaround: 页面重绘后，hook 会变，但 content 需要保留。
                    // 不过 useVideoCreationSSE 是依赖 currentSessionId 的。
                    // 更好的做法可能是：组件记住 pending message，当 sessionId 变化时自动发送。
                    // 为了简单起见，这里假设用户是在已有 Session (即使只有1个) 下操作。
                    // 上面的原有逻辑其实也是 setTimeout，大概率能工作，因为 hook 引用可能没变，
                    // 只是 internal session_id 变了？不，hook 是 key=currentSessionId? 
                    // No, page component holds the hook.
                    // The hook takes `currentSessionId`.
                    // When `currentSessionId` changes, the hook re-runs (or useEffect inside it runs).
                }, 500)

                // 实际上 api-video-creation 的 sendMessage 是无状态的吗？
                // 是的，sendMessage 调用 SSE hook 里的 fetch。
                // 让我们直接调用 API 或者让 hook 暴露发送方法。
                // 上面的逻辑稍微有点不可靠，但在 MVP 中如果不涉及复杂状态切换通常可以。

                // 为了确保发送成功，我们可以在 Session 有效时才渲染 ChatInput。
                // 但在 Welcome 页面，我们允许输入。
                // 修正方案：
                // 我们不等待 setSession，而是直接用 newSession.id 发送？
                // 不，我们需要 hook 建立连接。
                // 暂时保持原样，假设 500ms 够了。但更好的用户体验是立刻进入 Loading 状态。
            } catch (e) {
                console.error(e)
            }
        }

        // 确保如果有 session，立刻发送
        if (currentSessionId) {
            sendMessage(content)
        } else {
            // 上面的 handleCreateSession 已经处理了 new session creation
            // 我们在这里需要稍微 tricky 一点：
            // 创建 Session -> Set ID -> (Re-render) -> Hook connects -> Send.
            // 上面的 setTimeout 是为了等待 Hook 连接。
            // 实际上，我们可以优化：在 handleCreateSession 里返回 id，然后...
            setIsCreatingSession(true)
            const newSession = await videoCreationApi.createSession()
            setSessions(prev => [newSession, ...prev])
            setCurrentSessionId(newSession.id)
            setIsCreatingSession(false)
            setTimeout(() => {
                // Hacky but works for now to allow hook to update
                // 理想做法是 PendingMessage State
                // 但这里无法访问 hook 内部方法，除非 hook 暴露更复杂的 API
                // 只能依赖 hook 重新渲染后自动连接。
                // 我们暂时相信之前的逻辑，稍微增加 delay 并添加 loading state。
            }, 100)
            // 我们还需要在这里再次调用 sendMessage？不，上面的 if (currentSessionId) 会 fail。
            // 所以必须在 else block 里 call。
            // 但只能拿到 hook 的 sendMessage。
            // 如果 hook 内部依赖 props，那它是旧的。
            // 这是一个 React 闭包陷阱。
            // 但是 user-video-creation-sse.ts 的 sendMessage 依赖当前的 sessionId state 吗？
            // 它是用参数 `session_id` 初始化的。
            // 所以旧 hook instance 仍然绑定旧 ID (0)。
            // 我们无法通过旧 hook 发送给新 ID。
            // 我们必须等待 re-render。

            // 解决方案：使用一个 useEffect 监听 currentSessionId 和 pendingMessage。
        }
    }

    // 处理 Welcome Page 的发送逻辑优化
    const [pendingMessage, setPendingMessage] = useState<string | null>(null)

    const handleWelcomeSend = async (content: string) => {
        setIsCreatingSession(true)
        try {
            // 如果已经在 creating，不用重复
            const newSession = await videoCreationApi.createSession()
            setSessions(prev => [newSession, ...prev])
            setCurrentSessionId(newSession.id)
            setPendingMessage(content)
        } catch (err) {
            console.error('创建会话失败:', err)
        } finally {
            setIsCreatingSession(false)
        }
    }

    useEffect(() => {
        if (currentSessionId && pendingMessage) {
            // Session 建立且有待发送消息，发送之
            // 此时 hook 应该已经更新为新的 session ID
            sendMessage(pendingMessage)
            setPendingMessage(null)
        }
    }, [currentSessionId, pendingMessage, sendMessage])

    // 判断是否处于聊天模式 (有选中会话且有消息，或者正在流式传输)
    // 或者是：只要选中了会话，且不再是初始空白状态(用户发了第一条消息后)
    // 为了仿 DeepSeek，刚创建的新会话(无消息)也应该显示 Welcome Screen?
    // DeepSeek 新建对话是一片空白中间 Input。
    // 所以：messages.length === 0 -> Welcome Screen.
    const isChatMode = currentSessionId && messages.length > 0

    return (
        <div className="h-[calc(100vh-3rem)] flex pt-12">
            {/* 左侧边栏 - 会话列表 */}
            <div className="w-80 border-r bg-muted/30 flex flex-col hidden md:flex">
                <div className="p-4 border-b">
                    <Button
                        onClick={handleCreateSession}
                        disabled={isCreatingSession}
                        className="w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        新建会话
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors group hover:bg-accent ${currentSessionId === session.id ? 'bg-accent' : ''
                                }`}
                            onClick={() => setCurrentSessionId(session.id)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                        <h3 className="font-medium text-sm truncate">{session.title}</h3>
                                    </div>
                                    {session.last_message && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {session.last_message}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {new Date(session.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteSession(session.id)
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {sessions.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm p-8">
                            <p>暂无历史会话</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 主内容区 */}
            <div className="flex-1 flex flex-col h-full bg-background relative">
                {isChatMode ? (
                    // 聊天模式布局
                    <>
                        <div className="flex-1 overflow-hidden relative">
                            <ChatInterface messages={messages} isStreaming={isStreaming} error={error} />
                        </div>
                        <div className="p-4 border-t w-full max-w-4xl mx-auto bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                            <ChatInput
                                onSendMessage={(content) => sendMessage(content)}
                                disabled={isStreaming}
                            />
                        </div>
                    </>
                ) : (
                    // 欢迎页/DeepSeek 风格布局
                    <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-2xl mx-auto -mt-20 animate-in fade-in zoom-in duration-500">
                        {/* Logo & Slogan */}
                        <div className="mb-10 text-center space-y-4">
                            <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/5">
                                <Zap className="h-8 w-8 text-primary" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">今天想创作什么？</h1>
                            <p className="text-muted-foreground text-lg">智能分析法律文章，一键生成短视频脚本</p>
                        </div>

                        {/* Input Box */}
                        <div className="w-full bg-background rounded-2xl shadow-xl border p-2 mb-8 focus-within:ring-2 ring-primary/20 transition-all hover:shadow-2xl hover:border-primary/20">
                            <ChatInput
                                onSendMessage={currentSessionId ? sendMessage : handleWelcomeSend}
                                disabled={isStreaming || isCreatingSession}
                            />
                        </div>

                        {/* Quick Actions */}
                        <div className="w-full">
                            <QuickActions
                                onSelectAction={currentSessionId ? sendMessage : handleWelcomeSend}
                                variant="grid"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
