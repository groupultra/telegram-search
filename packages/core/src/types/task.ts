export type CoreTaskType = 'takeout' | 'getMessage' | 'embed'

export interface TakeoutTaskMetadata {
  chatIds: string[]
}

export interface CoreTasks {
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

export interface CoreTask<T extends CoreTaskType> {
  get state(): CoreTaskData<T>
  updateProgress: (progress: number, message?: string) => CoreTask<T>
  updateError: (error: Error | unknown) => CoreTask<T>
  markStarted: () => CoreTask<T>
  markCompleted: () => CoreTask<T>
  abort: () => CoreTask<T>
  toJSON: () => Omit<CoreTaskData<T>, 'abortController'>
}
