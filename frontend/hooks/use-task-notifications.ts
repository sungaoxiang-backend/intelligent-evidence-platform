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

  useEffect(() => {
    tasks.forEach(task => {
      const previousTask = previousTasksRef.current[task.taskId]
      const hasNotified = notifiedTasksRef.current.has(task.taskId)

      // 任务刚开始运行
      if (task.status === 'running' && (!previousTask || previousTask.status === 'pending')) {
        toast({
          title: '任务已开始',
          description: `智能证据分析任务已开始处理，请稍候...`,
          duration: 3000,
        })
        notifiedTasksRef.current.add(task.taskId)
      }

      // 任务成功完成
      if (task.status === 'success' && previousTask?.status !== 'success') {
        console.log('任务成功完成，显示通知:', task.taskId, task.result)
        // 如果任务没有经过running状态，先标记为已通知
        if (!hasNotified) {
          notifiedTasksRef.current.add(task.taskId)
        }
        
        toast({
          title: '任务完成',
          description: task.message || '智能证据分析任务已成功完成',
          duration: 3000,
        })
      }

      // 任务失败
      if (task.status === 'failure' && previousTask?.status !== 'failure') {
        // 如果任务没有经过running状态，先标记为已通知
        if (!hasNotified) {
          notifiedTasksRef.current.add(task.taskId)
        }
        
        toast({
          title: '任务失败',
          description: task.error || '智能证据分析任务执行失败',
          variant: 'destructive',
          duration: 5000,
        })
      }

      // 任务被取消
      if (task.status === 'revoked' && previousTask?.status !== 'revoked') {
        // 如果任务没有经过running状态，先标记为已通知
        if (!hasNotified) {
          notifiedTasksRef.current.add(task.taskId)
        }
        
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