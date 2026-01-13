import { useRef, useEffect } from "react"
import { Sparkles, Terminal } from "lucide-react"

interface LoadingViewProps {
    progress: number
    message: string
    logs: string[]
}

export function LoadingView({ progress, message, logs }: LoadingViewProps) {
    const logsEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when logs update
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [logs])

    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 space-y-8 max-w-xl w-full mx-auto">
            {/* Header Section */}
            <div className="text-center space-y-4">
                <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 bg-blue-50 rounded-full animate-ping opacity-20 duration-1000"></div>
                    <div className="relative bg-white border border-blue-100 w-20 h-20 rounded-full flex items-center justify-center shadow-sm">
                        <Sparkles className="w-10 h-10 text-blue-600 animate-pulse" />
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">AI 法律大脑正在分析</h3>
                    <p className="text-sm text-gray-500 font-medium">Claude 模型正在梳理证据链并生成法律意见...</p>
                </div>
            </div>

            {/* Progress Bar Section */}
            <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-600 px-1 uppercase tracking-wide">
                    <span>已完成</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                    <div
                        className="bg-blue-600 h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(37,99,235,0.3)] relative overflow-hidden"
                        style={{ width: `${Math.max(5, progress)}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-white/30 w-full -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                    </div>
                </div>
                <p className="text-xs text-center text-blue-600 font-medium h-4">{message}</p>
            </div>

            {/* Terminal / Log Section */}
            <div className="w-full bg-[#1e1e1e] rounded-lg p-5 font-mono text-xs text-gray-300 min-h-[220px] max-h-[320px] overflow-y-auto shadow-2xl border border-gray-800 relative group">

                {/* Terminal Header */}
                <div className="flex items-center gap-2 border-b border-gray-700 pb-3 mb-3 select-none sticky top-0 bg-[#1e1e1e] z-10 opacity-90 backdrop-blur-sm">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                    </div>
                    <span className="ml-2 text-gray-500 font-semibold flex items-center gap-1">
                        <Terminal className="w-3 h-3" />
                        analysis-agent-output
                    </span>
                </div>

                {/* Logs Content */}
                <div className="space-y-2 pl-1">
                    {logs.length === 0 ? (
                        <div className="text-gray-500 animate-pulse italic pt-2">Waiting for task signal...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 items-start">
                                <span className="text-blue-500 shrink-0 select-none mt-0.5">➜</span>
                                <span className="break-words leading-relaxed text-[#e0e0e0]">
                                    {log}
                                </span>
                            </div>
                        ))
                    )}

                    {/* Active Cursor Line */}
                    <div className="flex gap-3 items-center mt-2 opacity-80">
                        <span className="text-blue-500 shrink-0 select-none">➜</span>
                        <span className="h-4 w-2 bg-blue-500/50 animate-pulse"></span>
                    </div>
                </div>

                {/* Anchor */}
                <div ref={logsEndRef} />
            </div>
        </div>
    )
}
