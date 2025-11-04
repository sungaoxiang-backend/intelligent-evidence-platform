"use client"

import { X, Hammer, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ForgeTask } from "@/app/page"

interface ForgeQueuePanelProps {
  show: boolean
  tasks: ForgeTask[]
  onClose: () => void
}

export function ForgeQueuePanel({ show, tasks, onClose }: ForgeQueuePanelProps) {
  if (!show) return null

  const activeTasks = tasks.filter((t) => t.status === "forging")
  const completedTasks = tasks.filter((t) => t.status === "completed")

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300",
          show ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-orange-600" />
            <h3 className="font-bold text-slate-900">铸造队列</h3>
            {activeTasks.length > 0 && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                {activeTasks.length} 进行中
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Hammer className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-900 mb-1">暂无铸造任务</p>
              <p className="text-xs text-slate-500">选择证据并点击铸造按钮开始</p>
            </div>
          ) : (
            <>
              {/* Active Tasks */}
              {activeTasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">进行中</h4>
                  {activeTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mt-4">已完成</h4>
                  {completedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function TaskCard({ task }: { task: ForgeTask }) {
  const isCompleted = task.status === "completed"
  const isFailed = task.status === "failed"

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all",
        isCompleted && "bg-green-50 border-green-200",
        isFailed && "bg-red-50 border-red-200",
        !isCompleted && !isFailed && "bg-white border-slate-200",
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isCompleted && "bg-green-500",
            isFailed && "bg-red-500",
            !isCompleted && !isFailed && "bg-orange-500",
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
          ) : isFailed ? (
            <AlertCircle className="h-4 w-4 text-white" strokeWidth={2.5} />
          ) : (
            <Hammer className="h-4 w-4 text-white animate-bounce" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 mb-1">铸造 {task.evidenceIds.length} 个证据卡片</p>
          <p className="text-xs text-slate-500">证据 ID: {task.evidenceIds.map((id) => `#${id}`).join(", ")}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              "font-medium",
              isCompleted && "text-green-700",
              isFailed && "text-red-700",
              !isCompleted && !isFailed && "text-slate-600",
            )}
          >
            {isCompleted ? "已完成" : isFailed ? "失败" : "铸造中..."}
          </span>
          <span
            className={cn(
              "font-semibold",
              isCompleted && "text-green-700",
              isFailed && "text-red-700",
              !isCompleted && !isFailed && "text-orange-600",
            )}
          >
            {Math.round(task.progress)}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isCompleted && "bg-green-500",
              isFailed && "bg-red-500",
              !isCompleted && !isFailed && "bg-gradient-to-r from-orange-500 to-orange-600",
            )}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
