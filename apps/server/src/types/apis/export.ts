import type { DatabaseMessageType } from '@tg-search/db'
import type { ExportMethod } from './command'

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
  method: ExportMethod
  /** 增量导出: 指定导出该消息ID之后的消息 */
  minId?: number
  /** 增量导出: 指定导出该消息ID之前的消息 */
  maxId?: number
  /** 是否开启增量导出 (基于上次最大消息ID) */
  incremental?: boolean
  [key: string]: unknown
}
