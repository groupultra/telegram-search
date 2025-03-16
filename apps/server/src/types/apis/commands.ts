import type { DatabaseMessageType } from '@tg-search/db'
import type { CommandType } from './command'

export interface CommandsParamsMap extends Record<CommandType, unknown> {
  sync: null

  export: {
    chatId: number
    messageTypes: DatabaseMessageType[]
    method: 'getMessage' | 'takeout'
    /** 增量导出: 指定导出该消息ID之后的消息 */
    minId?: number
    /** 增量导出: 指定导出该消息ID之前的消息 */
    maxId?: number
    /** 是否开启增量导出 (基于上次最大消息ID) */
    incremental?: boolean
  }

  embed: {
    chatId: number
    batchSize?: number
    concurrency?: number
  }
}

export interface CommandsResultMap extends Record<CommandType, unknown> {
  sync: null

  export: null

  embed: null
}

export interface CommandsMetadataMap extends Record<CommandType, unknown> {
  sync: null

  export: {
    // Status fields
    totalMessages?: number
    processedMessages?: number
    failedMessages?: number
    currentBatch?: number
    totalBatches?: number
    // Formatted fields
    startTime: string
    endTime?: string
    totalDuration?: string
    averageSpeed?: string
    estimatedTimeRemaining?: string
    currentSpeed?: string
    error?: {
      name: string
      message: string
      stack?: string
    } | string
  }

  embed: null

  search: null
}

export interface CommandParams<T extends keyof CommandsParamsMap> {
  type: T
  params: CommandsParamsMap[T]
}

export interface CommandResult<T extends keyof CommandsResultMap> {
  type: T
  result: CommandsResultMap[T]
}

export interface CommandMetadata<T extends keyof CommandsMetadataMap> {
  type: T
  metadata: CommandsMetadataMap[T]
}

/**
 * Sync params
 */
export interface SyncParams {
  [key: string]: unknown
}

/**
 * Export command details
 */
export interface ExportDetails {
  // Status fields
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number
  currentBatch?: number
  totalBatches?: number
  // Formatted fields
  startTime: string
  endTime?: string
  totalDuration?: string
  averageSpeed?: string
  estimatedTimeRemaining?: string
  currentSpeed?: string
  error?: {
    name: string
    message: string
    stack?: string
  } | string
}

/**
 * Export params
 */
export interface ExportParams {
  chatId: number
  messageTypes: DatabaseMessageType[]
  method: 'getMessage' | 'takeout'
  /** 增量导出: 指定导出该消息ID之后的消息 */
  minId?: number
  /** 增量导出: 指定导出该消息ID之前的消息 */
  maxId?: number
  /** 是否开启增量导出 (基于上次最大消息ID) */
  incremental?: boolean
  [key: string]: unknown
}

/**
 * Embed command parameters
 */
export interface EmbedParams {
  chatId: number
  batchSize?: number
  concurrency?: number
  [key: string]: any
}
