"use client"

import { useEffect, useRef, useState } from 'react'
import { Message } from '@/hooks/use-video-creation-sse'
import { Bot, User, AlertCircle, Wrench, Zap, Copy, Check, FileText, ChevronRight, ChevronDown, Brain } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
// 使用浅色主题适配整体 UI，例如 vs (Visual Studio) 风格
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ChatInterfaceProps {
    messages: Message[]
    isStreaming: boolean
    error: string | null
}

function parseMessageContent(content: string) {
    let reasoning = ''
    let clean = content

    // Extract <think> blocks
    const thinkMatch = clean.match(/<think>([\s\S]*?)<\/think>/)
    if (thinkMatch) {
        reasoning = thinkMatch[1].trim()
        clean = clean.replace(thinkMatch[0], '').trim()
    }

    // Handle unclosed tags in streaming (simple heuristic)
    const openThink = clean.match(/<think>([\s\S]*)$/)
    if (openThink && !openThink[0].includes('</think>')) {
        reasoning = openThink[1].trim()
        clean = clean.replace(openThink[0], '').trim()
    }

    clean = clean.replace(/^<\/think>/, '').trim()
    clean = clean.replace(/<\|[a-zA-Z]+\|>/g, '')  // Clean artifacts

    return { clean, reasoning }
}

function parseSkillOutputJson(content: string): {
    rssArticle?: any
    videoScript?: any
} {
    const result: any = {}

    // 提取 <skill-output type="rss-article">
    const rssMatch = content.match(/<skill-output type="rss-article"[^>]*>([\s\S]*?)<\/skill-output>/)
    if (rssMatch) {
        try {
            result.rssArticle = JSON.parse(rssMatch[1].trim())
        } catch (e) {
            console.error('Failed to parse RSS article JSON:', e)
        }
    }

    // 提取 <skill-output type="video-script">
    const scriptMatch = content.match(/<skill-output type="video-script"[^>]*>([\s\S]*?)<\/skill-output>/)
    if (scriptMatch) {
        try {
            result.videoScript = JSON.parse(scriptMatch[1].trim())
        } catch (e) {
            console.error('Failed to parse video script JSON:', e)
        }
    }

    return result
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-muted rounded-md transition-colors flex items-center gap-1.5 group"
            title="复制内容"
        >
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                {copied ? '已复制' : '复制'}
            </span>
            {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
            )}
        </button>
    )
}

function ThinkingBlock({ reasoning, toolCalls, skillHits }: { reasoning: string, toolCalls?: any[], skillHits?: string[] }) {
    const [isOpen, setIsOpen] = useState(false)
    const hasContent = reasoning || (toolCalls && toolCalls.length > 0) || (skillHits && skillHits.length > 0)

    if (!hasContent) return null

    return (
        <div className="my-4 border-l-2 border-muted-foreground/20 pl-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm text-muted-foreground/70 hover:text-foreground transition-colors py-1 select-none"
            >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-medium">思考过程 {reasoning.length > 0 && "..."}</span>
                {(toolCalls?.length || 0) > 0 && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {toolCalls?.length} 工具
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="mt-2 text-sm text-muted-foreground/80 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {reasoning && (
                        <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed bg-muted/30 p-3 rounded-md">
                            {reasoning}
                        </div>
                    )}

                    {/* Tool Calls Display */}
                    {toolCalls && toolCalls.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground">工具调用:</div>
                            <div className="flex flex-col gap-2">
                                {toolCalls.map((tool, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs bg-muted/40 p-2 rounded">
                                        <Wrench className="h-3 w-3 mt-0.5 opacity-70" />
                                        <div>
                                            <div className="font-medium">{tool.name}</div>
                                            <div className="opacity-70 font-mono mt-1 break-all">
                                                {JSON.stringify(tool.params).slice(0, 100)}
                                                {JSON.stringify(tool.params).length > 100 ? '...' : ''}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {skillHits && skillHits.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {skillHits.map((skill, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-purple-50 text-purple-700">
                                    <Zap className="h-3 w-3" /> {skill}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function StructuredScriptCard({ scriptData }: { scriptData: any }) {
    const { final_script, metadata, templates } = scriptData
    const [showMetadata, setShowMetadata] = useState(false)

    return (
        <div className="my-6 rounded-xl border bg-card shadow-sm overflow-hidden not-prose ring-1 ring-border/50">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b backdrop-blur-sm">
                <span className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                    <FileText className="h-4 w-4 text-primary" />
                    视频脚本 (类型 {metadata.script_type})
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {final_script.word_count} 字 · {Math.round(final_script.estimated_duration)} 秒
                    </span>
                    <CopyButton text={final_script.full_text} />
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-white dark:bg-zinc-950 overflow-x-auto">
                <div className="p-4 min-w-full">
                    <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
                        {final_script.full_text}
                    </pre>
                </div>
            </div>

            {/* Expandable Metadata */}
            <details className="group">
                <summary
                    onClick={(e) => {
                        e.preventDefault()
                        setShowMetadata(!showMetadata)
                    }}
                    className="px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 cursor-pointer flex items-center justify-between select-none"
                >
                    <span>查看风格分析与元数据</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
                </summary>
                {showMetadata && (
                    <div className="px-4 py-3 border-t bg-muted/20 text-sm space-y-4">
                        {/* Style Analysis */}
                        <div>
                            <h4 className="font-medium mb-2">7维风格分析</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(metadata.style_analysis || {}).map(([key, value]: [string, any]) => (
                                    <div key={key} className="bg-background rounded p-2">
                                        <div className="font-medium text-xs text-muted-foreground mb-1">
                                            {key.replace(/_/g, ' ')}
                                        </div>
                                        <div className="text-xs">{value.summary || ''}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Templates */}
                        {templates && (
                            <div>
                                <h4 className="font-medium mb-2">模板库</h4>
                                <div className="space-y-2">
                                    {templates.hooks?.length > 0 && (
                                        <div>
                                            <div className="text-xs font-medium text-muted-foreground mb-1">开头模板</div>
                                            {templates.hooks.map((hook: string, i: number) => (
                                                <div key={i} className="text-xs bg-background rounded p-2 mb-1">{hook}</div>
                                            ))}
                                        </div>
                                    )}
                                    {templates.ctas?.length > 0 && (
                                        <div>
                                            <div className="text-xs font-medium text-muted-foreground mb-1">CTA模板</div>
                                            {templates.ctas.map((cta: string, i: number) => (
                                                <div key={i} className="text-xs bg-background rounded p-2 mb-1">{cta}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </details>
        </div>
    )
}

export function ChatInterface({ messages, isStreaming, error }: ChatInterfaceProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // 自动滚动到最新消息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    return (
        <div className="h-full overflow-y-auto p-6 space-y-8">
            {messages.map((message, index) => {
                const { clean: cleanContent, reasoning } = parseMessageContent(message.content)

                return (
                    <div
                        key={index}
                        className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'lex-col'}`} // User right, Assistant full width/left
                    >
                        {message.role === 'assistant' && (
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/10">
                                    <Bot className="h-5 w-5 text-primary" />
                                </div>
                            </div>
                        )}

                        <div
                            className={`max-w-4xl w-full ${message.role === 'user'
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3 ml-auto w-auto max-w-[80%]'
                                : '' // Assistant uses transparent bg for cleaner look
                                }`}
                        >
                            {/* DeepSeek Style: Rendering reasoning separately before content */}
                            {message.role === 'assistant' && (
                                <ThinkingBlock
                                    reasoning={reasoning}
                                    toolCalls={message.message_metadata?.tool_calls}
                                    skillHits={message.message_metadata?.skill_hits}
                                />
                            )}

                            {message.role === 'assistant' ? (
                                (() => {
                                    // 解析 skill-output 标签
                                    const skillOutputs = parseSkillOutputJson(cleanContent)

                                    // 清除 skill-output 标签后的纯文本内容
                                    let textWithoutSkillOutput = cleanContent
                                        .replace(/<skill-output[^>]*>[\s\S]*?<\/skill-output>/g, '')
                                        .trim()

                                    return (
                                        <>
                                            {/* 显示普通文本内容 */}
                                            {textWithoutSkillOutput && (
                                                <div className="prose prose-slate max-w-none dark:prose-invert leading-7">
                                                    <ReactMarkdown
                                                        components={{
                                                            code({ node, inline, className, children, ...props }) {
                                                                const match = /language-(\w+)/.exec(className || '')
                                                                const isVideoScript = match && match[1] === 'video-script'

                                                                // 检测 skill-output JSON 格式
                                                                if (!inline && className === 'language-json') {
                                                                    const jsonString = String(children)
                                                                    try {
                                                                        const jsonData = JSON.parse(jsonString)
                                                                        if (jsonData.version && jsonData.final_script) {
                                                                            return <StructuredScriptCard scriptData={jsonData} />
                                                                        }
                                                                    } catch (e) { }
                                                                }

                                                                if (!inline && isVideoScript) {
                                                                    return (
                                                                        <div className="my-6 rounded-xl border bg-card shadow-sm overflow-hidden not-prose ring-1 ring-border/50">
                                                                            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b backdrop-blur-sm">
                                                                                <span className="font-semibold text-sm flex items-center gap-2 text-foreground/80">
                                                                                    <FileText className="h-4 w-4 text-primary" />
                                                                                    视频脚本
                                                                                </span>
                                                                                <CopyButton text={String(children)} />
                                                                            </div>
                                                                            <div className="bg-white dark:bg-zinc-950 overflow-x-auto">
                                                                                <div className="p-4 min-w-full">
                                                                                    <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">
                                                                                        {children}
                                                                                    </pre>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                }

                                                                return !inline && match ? (
                                                                    <div className="rounded-lg overflow-hidden border my-4">
                                                                        <div className="bg-muted/50 px-3 py-1.5 flex justify-between items-center border-b">
                                                                            <span className="text-xs text-muted-foreground font-mono">{match[1]}</span>
                                                                            <CopyButton text={String(children)} />
                                                                        </div>
                                                                        <SyntaxHighlighter
                                                                            style={vs}
                                                                            language={match[1]}
                                                                            PreTag="div"
                                                                            customStyle={{ margin: 0, borderRadius: 0 }}
                                                                            {...props}
                                                                        >
                                                                            {String(children).replace(/\n$/, '')}
                                                                        </SyntaxHighlighter>
                                                                    </div>
                                                                ) : (
                                                                    <code className={`${className} bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary/80`} {...props}>
                                                                        {children}
                                                                    </code>
                                                                )
                                                            }
                                                        }}
                                                    >
                                                        {textWithoutSkillOutput}
                                                    </ReactMarkdown>
                                                </div>
                                            )}

                                            {/* 渲染结构化视频脚本卡片 */}
                                            {skillOutputs.videoScript && (
                                                <StructuredScriptCard scriptData={skillOutputs.videoScript} />
                                            )}

                                            {/* 渲染 RSS 文章摘要（如果有） */}
                                            {skillOutputs.rssArticle && (
                                                <div className="my-4 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30">
                                                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                                        RSS 文章
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {skillOutputs.rssArticle.result?.article?.title ||
                                                            skillOutputs.rssArticle.result?.articles?.[0]?.title ||
                                                            '已获取文章'}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )
                                })()
                            ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            )}
                        </div>

                        {message.role === 'user' && (
                            <div className="flex-shrink-0 mt-1">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                                    <User className="h-5 w-5 text-primary-foreground" />
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}

            {/* 流式输入指示器 */}
            {isStreaming && (
                <div className="flex gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <Bot className="h-5 w-5 text-primary" />
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="flex justify-center">
                    <div className="bg-destructive/10 text-destructive rounded-full px-4 py-2 flex items-center gap-2 shadow-sm border border-destructive/20">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    )
}
