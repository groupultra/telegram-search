import type { TelegramClient } from 'telegram'
import type { SendMessageParams } from 'telegram/client/messages'
import type { GetTelegramMessageParams, TelegramMessage } from '../../types'
import type { TakeoutManager } from './takeout-manager'
import type { MessageConverter } from './utils/message-converter'

import { useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram/tl'

import { ErrorHandler } from './utils/error-handler'

/**
 * Manager for Telegram messages
 * Handles message retrieval using different methods
 */
export class MessageManager {
  private client: TelegramClient
  private messageConverter: MessageConverter
  private takeoutManager: TakeoutManager
  private logger = useLogger()
  private errorHandler = new ErrorHandler()
  private messageCallback?: (message: TelegramMessage) => Promise<void>

  constructor(client: TelegramClient, messageConverter: MessageConverter, takeoutManager: TakeoutManager) {
    this.client = client
    this.messageConverter = messageConverter
    this.takeoutManager = takeoutManager
  }

  /**
   * send message
   */
  public async sendMessage(chatId: number, sendMessageParams: SendMessageParams) {
    await this.client.sendMessage(chatId, {
      ...sendMessageParams,
    })
  }

  /**
   * Convert any error to Error type
   */
  private toError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }

  /**
   * Get messages using normal API
   */
  private async* getNormalMessages(
    chatId: number,
    limit?: number,
    options?: GetTelegramMessageParams,
  ): AsyncGenerator<TelegramMessage> {
    let offsetId = 0
    let hasMore = true
    let processedCount = 0

    try {
      while (hasMore) {
        // Get messages using normal API with retry
        const apiResponse = await this.errorHandler.withRetry(
          () => this.client.getMessages(chatId, {
            limit: limit || 100,
            offsetId,
            minId: options?.minId || 0,
            maxId: options?.maxId || 0,
          }),
          {
            context: '获取普通消息',
            maxRetries: 3,
            initialDelay: 2000,
          },
        )

        if (!apiResponse.success || !apiResponse.data) {
          this.logger.warn('获取消息请求失败或返回空数据')
          break
        }

        const messages = apiResponse.data

        // If we got fewer messages than requested, there are no more
        hasMore = messages.length === (limit || 100)

        for (const message of messages) {
          // Skip empty messages
          if (message instanceof Api.MessageEmpty) {
            continue
          }

          // Check time range
          const messageTime = new Date(message.date * 1000)
          if (options?.startTime && messageTime < options.startTime) {
            continue
          }
          if (options?.endTime && messageTime > options.endTime) {
            continue
          }

          // Convert message to custom message type
          const customMessage = new Api.Message({
            ...message,
            id: message.id,
            date: message.date,
            message: message.message || '',
          })

          try {
            // If it's a media message, only get basic info without downloading files
            const converted = await this.messageConverter.convertMessage(customMessage, options?.skipMedia)

            // Check message type
            if (options?.messageTypes && !options.messageTypes.includes(converted.type)) {
              continue
            }

            yield converted
            processedCount++

            // Update offsetId to current message ID
            offsetId = message.id

            // Check if we've reached the limit
            if (options?.limit && processedCount >= options.limit) {
              return
            }
          }
          catch (error) {
            // Log error but continue with next message
            this.errorHandler.handleError(this.toError(error), '转换消息', `处理消息 ${message.id} 时出错，跳过该消息`)
          }
        }
      }
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取普通消息', '获取消息失败')
      throw error
    }
  }

  /**
   * Get messages from a chat using specified method
   */
  public async* getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    try {
      if (options?.method === 'takeout') {
        try {
          // Try to use takeout first
          yield* this.takeoutManager.getMessages(chatId, limit, options)
        }
        catch (error: any) {
          // If takeout is not available, fallback to normal API
          if (error.message === 'TAKEOUT_NOT_AVAILABLE' || error.message?.includes('TAKEOUT_INIT_DELAY')) {
            this.logger.warn('Takeout session not available, using normal message fetch')
            yield* this.getNormalMessages(chatId, limit, options)
          }
          else {
            this.errorHandler.handleError(this.toError(error), '获取takeout消息', '获取takeout消息失败')
            throw error
          }
        }
      }
      else {
        yield* this.getNormalMessages(chatId, limit, options)
      }
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取消息', `获取聊天 ${chatId} 的消息失败`)
      throw error
    }
  }

  /**
   * Get chat history information
   */
  public async getHistory(chatId: number): Promise<Api.messages.TypeMessages & { count: number }> {
    try {
      const result = await this.errorHandler.withRetry(
        () => this.client.invoke(new Api.messages.GetHistory({
          peer: chatId,
          limit: 1,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })),
        {
          context: '获取聊天历史信息',
          maxRetries: 3,
          initialDelay: 2000,
        },
      )

      if (!result.success || !result.data) {
        throw new Error('获取聊天历史信息失败')
      }

      return result.data as Api.messages.TypeMessages & { count: number }
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '获取聊天历史信息', `获取聊天 ${chatId} 的历史信息失败`)
      throw error
    }
  }

  /**
   * Set callback function for incoming messages
   */
  public onMessage(callback: (message: TelegramMessage) => Promise<void>): void {
    this.messageCallback = callback
  }

  /**
   * Get the current message callback function
   */
  public getMessageCallback(): ((message: TelegramMessage) => Promise<void>) | undefined {
    return this.messageCallback
  }

  /**
   * Process a new incoming message
   * @param message The message to process
   */
  public async processIncomingMessage(message: Api.Message): Promise<void> {
    if (!this.messageCallback) {
      return
    }

    try {
      const convertedMessage = await this.messageConverter.convertMessage(message, true)
      await this.messageCallback(convertedMessage)
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '处理新消息', `处理消息 ${message.id} 时出错`)
    }
  }
}
