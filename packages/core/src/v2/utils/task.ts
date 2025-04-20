import type { TakeoutTaskMetadata } from '../services/takeout'

import defu from 'defu'

type TaskType = 'takeout' | 'getMessage' | 'embed'

interface Tasks {
  takeout: TakeoutTaskMetadata
  getMessage: undefined
  embed: undefined
}

export interface Task<T extends TaskType> {
  taskId: string
  type: T
  progress: number
  lastMessage?: string
  lastError?: string
  metadata: Tasks[T]
  createdAt: Date
  updatedAt: Date
}

function createTask<T extends TaskType>(type: T, metadata: Tasks[T]): Task<T> {
  return {
    taskId: crypto.randomUUID(),
    type,
    progress: 0,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function useTasks<T extends TaskType>(type: T) {
  const tasks = new Map<string, Task<T>>()

  return {
    createTask: (data: Tasks[T]) => {
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
    updateTask: (taskId: string, partialTask: Partial<Task<T>>) => {
      const task = tasks.get(taskId)
      if (!task) {
        throw new Error(`Task ${taskId} not found`)
      }

      const updatedTask = defu<Task<T>, Partial<Task<T>>[]>({}, partialTask, task, {
        updatedAt: new Date(),
      })

      tasks.set(taskId, updatedTask)
      return updatedTask
    },
  }
}
