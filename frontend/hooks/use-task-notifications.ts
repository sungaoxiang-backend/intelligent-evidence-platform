import { useEffect, useRef } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { TaskProgress } from './use-celery-tasks'

export interface TaskNotification {
  taskId: string
  title: string
  description: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

export function useTaskNotifications(tasks: TaskProgress[]) {
  const { toast } = useToast()
  const notifiedTasksRef = useRef<Set<string>>(new Set())
  const previousTasksRef = useRef<Record<string, TaskProgress>>({})
  const isInitializedRef = useRef(false)

  useEffect(() => {
    // 如果任务列表为空，直接返回
    if (tasks.length === 0) {
      return
    }

    // 首次初始化时，标记所有已完成的任务为已通知，避免页面刷新后重复通知
    if (!isInitializedRef.current) {
      tasks.forEach(task => {
        if (['success', 'failure', 'revoked'].includes(task.status)) {
          notifiedTasksRef.current.add(task.taskId)
        }
      })
      isInitializedRef.current = true
      return // 首次加载时不显示任何通知
    }

    tasks.forEach(task => {
      const previousTask = previousTasksRef.current[task.taskId]
      const hasNotified = notifiedTasksRef.current.has(task.taskId)

      console.log(`任务通知检查: ${task.taskId}, 当前状态: ${task.status}, 之前状态: ${previousTask?.status}, 已通知: ${hasNotified}`)

      // 任务刚开始运行 - 只有在状态真正从pending变为running时才通知
      if (task.status === 'running' && previousTask?.status === 'pending' && !hasNotified) {
        console.log('显示任务开始通知:', task.taskId)
        toast({
          title: '任务已开始',
          description: `智能证据分析任务已开始处理，请稍候...`,
          duration: 3000,
        })
        notifiedTasksRef.current.add(task.taskId)
      }

      // 任务成功完成 - 只有在状态真正从running变为success时才通知
      if (task.status === 'success' && 
          previousTask && 
          previousTask.status === 'running' && 
          !hasNotified) {
        console.log('任务成功完成，显示通知:', task.taskId, task.result)
        notifiedTasksRef.current.add(task.taskId)
        
        toast({
          title: '任务完成',
          description: task.message || '智能证据分析任务已成功完成',
          duration: 3000,
        })
      }

      // 任务失败 - 只有在状态真正发生变化时才通知
      if (task.status === 'failure' && previousTask?.status !== 'failure' && !hasNotified) {
        notifiedTasksRef.current.add(task.taskId)
        
        toast({
          title: '任务失败',
          description: task.error || '智能证据分析任务执行失败',
          variant: 'destructive',
          duration: 5000,
        })
      }

      // 任务被取消 - 只有在状态真正发生变化时才通知
      if (task.status === 'revoked' && previousTask?.status !== 'revoked' && !hasNotified) {
        notifiedTasksRef.current.add(task.taskId)
        
        toast({
          title: '任务已取消',
          description: '智能证据分析任务已被取消',
          duration: 3000,
        })
      }

      // 更新之前的任务状态
      previousTasksRef.current[task.taskId] = { ...task }
    })

    // 清理已完成的任务记录（避免内存泄漏）
    const completedTaskIds = tasks
      .filter(task => ['success', 'failure', 'revoked'].includes(task.status))
      .map(task => task.taskId)
    
    completedTaskIds.forEach(taskId => {
      setTimeout(() => {
        notifiedTasksRef.current.delete(taskId)
        delete previousTasksRef.current[taskId]
      }, 10000) // 10秒后清理
    })

  }, [tasks, toast])

  // 清理函数
  const cleanup = () => {
    notifiedTasksRef.current.clear()
    previousTasksRef.current = {}
  }

  return { cleanup }
}