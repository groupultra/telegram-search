import type { CoreEmitter } from '../context'
import type { TakeoutTaskMetadata } from '../services/takeout'

import { useLogger } from '@unbird/logg'

type CoreTaskType = 'takeout' | 'getMessage' | 'embed'

interface CoreTasks {
  takeout: TakeoutTaskMetadata
  getMessage: undefined
  embed: undefined
}

export interface CoreTaskData<T extends CoreTaskType> {
  taskId: string
  type: T
  progress: number
  lastMessage?: string
  lastError?: string
  rawError?: unknown
  metadata: CoreTasks[T]
  createdAt: Date
  updatedAt: Date
  abortController: AbortController
}

export interface CoreTask<T extends CoreTaskType> extends CoreTaskData<T> {
  updateProgress: (progress: number, message?: string) => CoreTask<T>
  updateError: (error: Error | unknown) => CoreTask<T>
  markStarted: () => CoreTask<T>
  markCompleted: () => CoreTask<T>
  abort: () => CoreTask<T>
  toJSON: () => CoreTaskData<T>
}

/**
 * Create a task that manages its own state
 */
export function createTask<T extends CoreTaskType>(
  type: T,
  metadata: CoreTasks[T],
  emitter: CoreEmitter,
): CoreTask<T> {
  const state: CoreTaskData<T> = {
    taskId: crypto.randomUUID(),
    type,
    progress: 0,
    metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
    abortController: new AbortController(),
  }

  let task: CoreTask<T>

  const emitUpdate = () => {
    if (type === 'takeout') {
      emitter.emit('takeout:task:progress', task.toJSON() as any)
    }
  }

  task = {
    ...state,

    updateProgress(progress: number, message?: string) {
      state.progress = progress
      state.lastMessage = message
      state.updatedAt = new Date()
      emitUpdate()
      return task
    },

    updateError(error: Error | unknown) {
      state.progress = -1
      state.lastError = error instanceof Error ? error.message : String(error)
      state.rawError = error
      state.updatedAt = new Date()
      emitUpdate()
      return task
    },

    markStarted() {
      const now = new Date()
      state.updatedAt = now
      emitUpdate()
      return task
    },

    markCompleted() {
      const now = new Date()
      state.updatedAt = now
      emitUpdate()
      return task
    },

    abort() {
      state.abortController.abort()
      task.updateError(new Error('Task aborted'))
      useLogger().withFields({ taskId: state.taskId }).verbose('Task aborted')
      return task
    },

    toJSON() {
      return {
        taskId: state.taskId,
        type: state.type,
        progress: state.progress,
        lastMessage: state.lastMessage,
        lastError: state.lastError,
        rawError: state.rawError,
        metadata: state.metadata,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
        abortController: state.abortController,
      }
    },
  }

  return task
}
