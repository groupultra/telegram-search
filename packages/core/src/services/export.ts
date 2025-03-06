import type { DatabaseChatType, DatabaseMessageType } from '@tg-search/db'
import type { ITelegramClientAdapter } from '../types/adapter'
import type { TelegramMessage } from '../types/message'

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { createMessages, findMaxMessageId, findMinMessageId, updateChat } from '@tg-search/db'

const logger = useLogger()

/**
 * Export format type
 */
export type ExportFormat = 'database' | 'html' | 'json'

/**
 * Export method type
 */
export type ExportMethod = 'getMessage' | 'takeout'

/**
 * Export service options
 */
export interface ExportOptions {
  chatMetadata: {
    id: number
    title: string
    type: DatabaseChatType
  }
  chatId: number
  format?: ExportFormat
  path?: string
  messageTypes?: DatabaseMessageType[]
  startTime?: Date
  endTime?: Date
  /** 增量导出: 指定导出该消息ID之后的消息 */
  minId?: number
  /** 增量导出: 指定导出该消息ID之前的消息 */
  maxId?: number
  /** 是否开启增量导出 (基于上次最大消息ID) */
  incremental?: boolean
  limit?: number
  batchSize?: number
  method?: ExportMethod
  onProgress?: (progress: number, message: string, metadata?: Record<string, any>) => void
}

/**
 * Export service for handling message exports
 * Focuses on database export for MVP
 */
export class ExportService {
  constructor(private client: ITelegramClientAdapter) {}

  /**
   * Process a batch of messages for database export
   */
  private async processDatabaseBatch(
    messages: TelegramMessage[],
    startIndex: number,
  ): Promise<{ failedCount: number }> {
    try {
      // Convert messages to database format
      const messagesToCreate = messages.map(msg => ({
        id: msg.id,
        chatId: msg.chatId,
        type: msg.type,
        content: msg.content || '',
        fromId: msg.fromId,
        fromName: msg.fromName,
        replyToId: msg.replyToId,
        forwardFromChatId: msg.forwardFromChatId,
        forwardFromChatName: msg.forwardFromChatName,
        forwardFromMessageId: msg.forwardFromMessageId,
        views: msg.views,
        forwards: msg.forwards,
        links: msg.links || undefined,
        metadata: msg.metadata,
        createdAt: msg.createdAt,
        // Only include media info if exists
        ...(msg.mediaInfo && {
          mediaType: msg.mediaInfo.type,
          mediaFileId: msg.mediaInfo.fileId,
          mediaFileName: msg.mediaInfo.fileName,
          mediaMimeType: msg.mediaInfo.mimeType,
        }),
      }))

      // Create messages in batch
      await createMessages(messagesToCreate)
      logger.debug(
        `已保存 ${startIndex + 1} - ${startIndex + messages.length} 条消息 `
        + `(ID: ${messages[0].id} - ${messages[messages.length - 1].id})`,
      )
      return { failedCount: 0 }
    }
    catch (error) {
      logger.withError(error).error(`保存批次消息失败 (${startIndex + 1} - ${startIndex + messages.length})`)
      return { failedCount: messages.length }
    }
  }

  /**
   * Save messages to JSON file
   */
  private async saveToJsonFile(messages: TelegramMessage[], chatId: number, exportPath: string): Promise<boolean> {
    try {
      await fs.mkdir(exportPath, { recursive: true })

      const fileName = `${chatId}_${new Date().toISOString().split('T')[0]}`
      const filePath = path.join(exportPath, `${fileName}.json`)
      await fs.writeFile(filePath, JSON.stringify(messages, null, 2))
      logger.debug(`已保存 JSON 文件: ${filePath}`)
      logger.log(`已导出到文件: ${filePath}`)
      return true
    }
    catch (error) {
      logger.withError(error).error('保存 JSON 文件失败')
      return false
    }
  }

  /**
   * Export messages from chat
   */
  async exportMessages(options: ExportOptions): Promise<{ count: number, failedCount: number }> {
    const {
      chatMetadata,
      chatId,
      format = 'database',
      path: exportPath,
      messageTypes = ['text'],
      startTime,
      endTime,
      limit,
      batchSize = getConfig().message.export.batchSize,
      method = 'takeout',
      onProgress,
      minId,
      maxId,
      incremental = false,
    } = options

    // Report progress
    onProgress?.(5, `已选择会话: ${chatMetadata.title}`)

    let startId: number | undefined = minId
    let exportMaxId = maxId // 使用新变量而不是修改参数
    const history = await this.client.getHistory(chatId)

    // 增量导出: 如果启用增量导出，尝试查找数据库中最大的消息ID
    if (incremental && !startId) {
      onProgress?.(10, '检查增量导出起点...')
      // 由于Telegram消息ID是递增的，最新的消息有最大的ID
      // 对于增量导出，我们需要处理两种情况：
      // 1. 导出比本地最小ID更早的消息（之前未导出的较旧消息）
      // 2. 导出本地已有消息中间的"缺口"（未完成的导出）
      const localMinId = await findMinMessageId(chatId)
      const localMaxId = await findMaxMessageId(chatId)
      exportMaxId = (history as any).messages[0].id + 1
      // const localMaxId = await findMaxMessageId(chatId)

      logger.debug('增量导出调试信息', {
        chatId,
        localMinId,
        // localMaxId,
      })

      if (localMinId && localMaxId) {
        // TODO: 未来可以实现更复杂的"缺口"检测逻辑
        // 比如通过SQL查询确定消息ID的连续性，找出缺失的ID区间
        startId = Number(localMaxId)
        // 目前优先导出比本地最小ID更小的消息（历史消息）

        // 添加更多详细的日志
        logger.debug('增量导出详细信息', {
          chatId,
          localMinId,
          // localMaxId,
          maxIdSet: exportMaxId,
          exportMethod: method,
          strategy: '导出更早的历史消息',
        })
        onProgress?.(15, `增量导出: 获取ID < ${exportMaxId} 的历史消息（当前最早消息ID: ${localMinId}）`)
      }
      else {
        logger.debug('未找到之前的消息记录，执行完整导出')
        onProgress?.(15, '未找到之前的消息记录，执行完整导出')
      }
    }

    logger.debug('获取到的聊天历史信息', {
      historyCount: history.count,
      chatId,
      method,
      startId,
      maxId: exportMaxId,
    })

    // Export messages
    let count = 0
    let failedCount = 0
    let messages: TelegramMessage[] = []

    const total = limit || history.count - 1 || 100
    function isSkipMedia(type: DatabaseMessageType) {
      return !messageTypes.includes(type)
    }
    if (incremental && exportMaxId && (exportMaxId - 1) === startId) {
      onProgress?.(100, '无需导出', {
        chatId,
        format,
        path: exportPath,
        messageTypes,
        startTime,
        endTime,
        minId,
        maxId,
        incremental,
        limit,
        batchSize,
        method,
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
      })
      return { count: 0, failedCount: 0 }
    }
    try {
      // Try to export messages
      for await (const message of this.client.getMessages(chatId, undefined, {
        skipMedia: isSkipMedia('photo') || isSkipMedia('video') || isSkipMedia('document') || isSkipMedia('sticker'),
        startTime,
        endTime,
        limit,
        messageTypes,
        method,
        minId: startId, // 使用增量导出的起始ID
        maxId: exportMaxId, // 使用传入的最大ID限制
      })) {
        // 在获取第一条消息时记录日志
        if (count === 0) {
          logger.debug('获取到第一条消息', {
            messageId: message.id,
            messageType: message.type,
            createdAt: message.createdAt,
            minIdUsed: startId,
          })
        }

        messages.push(message)
        count++

        // Process batch if needed
        if (format === 'database' && messages.length >= batchSize) {
          const result = await this.processDatabaseBatch(messages, count - messages.length)
          failedCount += result.failedCount
          messages = []

          // Report progress
          const progress = Math.min(95, Math.floor((count / total) * 90) + 5)
          onProgress?.(progress, `已处理 ${count} 条消息`, {
            chatId,
            format,
            path: exportPath,
            messageTypes,
            startTime,
            endTime,
            minId,
            maxId,
            incremental,
            limit,
            batchSize,
            method,
            totalMessages: incremental ? count : total,
            processedMessages: count,
            failedMessages: failedCount > 0 ? failedCount : undefined,
          })
        }

        // Check if we need to stop
        if (limit && count >= limit) {
          break
        }
      }

      // 在消息获取循环结束后记录日志
      logger.debug('消息获取循环结束', {
        totalCount: count,
        startId,
        maxId: exportMaxId,
        method,
        chatId,
      })
      // Process remaining messages
      if (messages.length > 0) {
        if (format === 'database') {
          const result = await this.processDatabaseBatch(messages, count - messages.length)
          failedCount += result.failedCount
        }
        else if (format === 'json' && exportPath) {
          const success = await this.saveToJsonFile(messages, chatId, exportPath)
          if (!success) {
            failedCount = count
          }
        }
        else if (format === 'html') {
          logger.warn('HTML 导出暂未实现')
        }
      }

      // Update chat metadata
      if (format === 'database') {
        await updateChat({
          id: chatMetadata.id,
          type: chatMetadata.type,
          title: chatMetadata.title,
          lastSyncTime: new Date(),
        })
      }

      // Report completion
      const summary = failedCount > 0
        ? `导出完成，共导出 ${count} 条消息，${failedCount} 条消息失败`
        : `导出完成，共导出 ${count} 条消息`
      onProgress?.(100, summary, {
        chatId,
        format,
        path: exportPath,
        messageTypes,
        startTime,
        endTime,
        minId,
        maxId,
        incremental,
        limit,
        batchSize,
        method,
        totalMessages: incremental ? count : total,
        processedMessages: count,
        failedMessages: failedCount > 0 ? failedCount : undefined,
      })

      return { count, failedCount }
    }
    catch (error: any) {
      // Handle special errors
      if (error?.message?.includes('TAKEOUT_INIT_DELAY')) {
        const waitSeconds = Number(error.message.match(/TAKEOUT_INIT_DELAY_(\d+)/)?.[1])
        if (waitSeconds) {
          const waitHours = Math.ceil(waitSeconds / 3600)
          const message = `需要等待 ${waitHours} 小时才能使用 takeout 导出`
          logger.warn(message)
          onProgress?.(0, message, {
            chatId,
            format,
            path: exportPath,
            messageTypes,
            startTime,
            endTime,
            minId,
            maxId,
            incremental,
            limit,
            batchSize,
            method,
            totalMessages: incremental ? count : total,
            processedMessages: count,
            failedMessages: failedCount > 0 ? failedCount : undefined,
          })
          throw error
        }
      }
      else if (error?.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = Number(error.message.match(/FLOOD_WAIT_(\d+)/)?.[1])
        if (waitSeconds) {
          const message = `需要等待 ${waitSeconds} 秒才能继续`
          logger.warn(message)
          onProgress?.(count > 0 ? 50 : 0, message, {
            type: 'waiting',
            waitSeconds,
            resumeTime: new Date(Date.now() + waitSeconds * 1000).toISOString(),
            remainingCount: total - count,
            totalMessages: incremental ? count : total,
            processedMessages: count,
            failedMessages: failedCount > 0 ? failedCount : undefined,
          })
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          logger.log('继续导出...')
          onProgress?.(count > 0 ? 55 : 5, '继续导出...')
        }
      }

      throw error
    }
  }
}

// Export default instance
export default ExportService
