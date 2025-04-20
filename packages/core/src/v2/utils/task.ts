import type { TakeoutTaskMetadata } from '../services/takeout'

import defu from 'defu'

type CoreTaskType = 'takeout' | 'getMessage' | 'embed'

interface CoreTasks {
  takeout: TakeoutTaskMetadata
  getMessage: undefined
  embed: undefined
}

export interface CoreTask<T extends CoreTaskType> {
  taskId: string
  type: T
  progress: number
  lastMessage?: string
  lastError?: string
  metadata: CoreTasks[T]
  createdAt: Date
  updatedAt: Date
}

function createTask<T extends CoreTaskType>(type: T, metadata: CoreTasks[T]): CoreTask<T> {
  return {
    taskId: crypto.randomUUID(),
    type,
    progress: 0,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function useTasks<T extends CoreTaskType>(type: T) {
  const tasks = new Map<string, CoreTask<T>>()

  return {
    createTask: (data: CoreTasks[T]) => {
      const task = createTask(type, data)
      tasks.set(task.taskId, task)
      return task
    },
    listTasks: () => {
      return Array.from(tasks.values())
    },
    getTask: (taskId: string) => {
      return tasks.get(taskId)
    },
    updateTask: (taskId: string, partialTask: Partial<CoreTask<T>>) => {
      const task = tasks.get(taskId)
      if (!task) {
        throw new Error(`Task ${taskId} not found`)
      }

      const updatedTask = defu<CoreTask<T>, Partial<CoreTask<T>>[]>({}, partialTask, task, {
        updatedAt: new Date(),
      })

      tasks.set(taskId, updatedTask)
      return updatedTask
    },
  }
}
