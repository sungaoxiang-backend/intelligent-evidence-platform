"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useCeleryTasks } from '@/hooks/use-celery-tasks'
import { useTaskNotifications } from '@/hooks/use-task-notifications'
import { GlobalTaskButton } from '@/components/global-task-button'

interface GlobalTaskContextType {
  tasks: ReturnType<typeof useCeleryTasks>['tasks']
  addTask: ReturnType<typeof useCeleryTasks>['addTask']
  removeTask: ReturnType<typeof useCeleryTasks>['removeTask']
  updateTask: ReturnType<typeof useCeleryTasks>['updateTask']
  clearAllTasks: ReturnType<typeof useCeleryTasks>['clearAllTasks']
  clearCompletedTasks: ReturnType<typeof useCeleryTasks>['clearCompletedTasks']
  retryTask: ReturnType<typeof useCeleryTasks>['retryTask']
  refreshTask: ReturnType<typeof useCeleryTasks>['refreshTask']
}

const GlobalTaskContext = createContext<GlobalTaskContextType | undefined>(undefined)

export function GlobalTaskProvider({ children }: { children: ReactNode }) {
  const { tasks, addTask, removeTask, updateTask, clearAllTasks, clearCompletedTasks, retryTask, refreshTask } = useCeleryTasks()
  
  // 任务通知
  useTaskNotifications(tasks)

  return (
    <GlobalTaskContext.Provider value={{ tasks, addTask, removeTask, updateTask, clearAllTasks, clearCompletedTasks, retryTask, refreshTask }}>
      {children}
      {/* 全局任务按钮 */}
      <GlobalTaskButton 
        tasks={tasks} 
        onRemoveTask={removeTask}
        onClearAll={clearAllTasks}
        onClearCompleted={clearCompletedTasks}
        onRetryTask={retryTask}
        onRefreshTask={refreshTask}
      />
    </GlobalTaskContext.Provider>
  )
}

export function useGlobalTasks() {
  const context = useContext(GlobalTaskContext)
  if (context === undefined) {
    throw new Error('useGlobalTasks must be used within a GlobalTaskProvider')
  }
  return context
}
