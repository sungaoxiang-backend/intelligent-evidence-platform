"use client"

import { useState, useEffect } from 'react'
import { videoCreationApi } from '@/lib/api-video-creation'
import { QuickAction } from '@/hooks/use-video-creation-sse'
import { Button } from '@/components/ui/button'
import { Zap, FileText, Search, FileSearch, List, Layers, ArrowRight } from 'lucide-react'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface QuickActionsProps {
    onSelectAction: (prompt: string) => void
    variant?: 'scroll' | 'grid'
}

const iconMap: Record<string, React.ComponentType<any>> = {
    Zap,
    FileText,
    Search,
    FileSearch,
    List,
    Layers
}

export function QuickActions({ onSelectAction, variant = 'scroll' }: QuickActionsProps) {
    const [actions, setActions] = useState<QuickAction[]>([])

    useEffect(() => {
        loadActions()
    }, [])

    const loadActions = async () => {
        try {
            const data = await videoCreationApi.getQuickActions()
            setActions(data)
        } catch (err) {
            console.error('加载快捷指令失败:', err)
        }
    }

    if (variant === 'grid') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                {actions.map(action => {
                    const Icon = iconMap[action.icon] || Zap
                    return (
                        <button
                            key={action.id}
                            onClick={() => onSelectAction(action.prompt)}
                            className="flex flex-col items-start p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                        >
                            <div className="flex items-center justify-between w-full mb-2">
                                <Icon className="h-5 w-5 text-primary" />
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                            </div>
                            <div className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                                {action.label}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                                {action.description}
                            </div>
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
                {actions.map(action => {
                    const Icon = iconMap[action.icon] || Zap
                    return (
                        <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectAction(action.prompt)}
                            className="flex-shrink-0 gap-2 bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/20"
                        >
                            <Icon className="h-4 w-4" />
                            <span>{action.label}</span>
                        </Button>
                    )
                })}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
    )
}
