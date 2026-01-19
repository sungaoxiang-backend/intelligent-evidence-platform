"use client"

import { useState, useRef, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface ChatInputProps {
    onSendMessage: (content: string) => void
    disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
    const [input, setInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSend = () => {
        if (!input.trim() || disabled) return
        onSendMessage(input.trim())
        setInput('')

        // 重置 textarea 高度
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // 自动调整高度
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)

        // 自动调整高度
        e.target.style.height = 'auto'
        e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
    }

    return (
        <div className="flex gap-3">
            <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                disabled={disabled}
                className="min-h-[44px] max-h-[200px] resize-none"
                rows={1}
            />
            <Button
                onClick={handleSend}
                disabled={disabled || !input.trim()}
                size="icon"
                className="h-11 w-11 flex-shrink-0"
            >
                <Send className="h-4 w-4" />
            </Button>
        </div>
    )
}
