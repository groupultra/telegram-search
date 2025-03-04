import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { ClientAdapterConfig, ConnectOptions, GetTelegramMessageParams, ITelegramClientAdapter, TelegramChatsResult, TelegramFolder, TelegramMessage } from '../../types'

import { getConfig, useLogger } from '@tg-search/common'
import { Api } from 'telegram/tl'

import { MediaService } from '../../services/media'
import { ConnectionManager } from './connection-manager'
import { DialogManager } from './dialog-manager'
import { FolderManager } from './folder-manager'
import { MessageManager } from './message-manager'
import { SessionManager } from './session-manager'
import { TakeoutManager } from './takeout-manager'
import { ErrorHandler } from './utils/error-handler'
import { MessageConverter } from './utils/message-converter'

/**
 * Telegram client adapter implementation
 */
export class ClientAdapter implements ITelegramClientAdapter {
  private sessionManager: SessionManager
  private connectionManager: ConnectionManager
  private mediaService: MediaService
  private messageConverter: MessageConverter
  private dialogManager: DialogManager
  private folderManager: FolderManager
  private takeoutManager: TakeoutManager
  private messageManager: MessageManager
  private errorHandler: ErrorHandler
  private logger = useLogger()
  private config: ClientAdapterConfig

  constructor(config: ClientAdapterConfig) {
    this.config = {
      systemVersion: 'Unknown',
      ...config,
    }
    const appConfig = getConfig()

    // Initialize error handler
    this.errorHandler = new ErrorHandler()

    // Initialize session and connection managers
    this.sessionManager = new SessionManager(appConfig.path.session)
    this.connectionManager = new ConnectionManager(
      this.sessionManager,
      config.apiId,
      config.apiHash,
      config.phoneNumber,
    )

    // Get client instance
    const client = this.connectionManager.getClient()

    // Initialize services
    this.mediaService = new MediaService(client)
    this.messageConverter = new MessageConverter(this.mediaService, client)
    this.dialogManager = new DialogManager(client)
    this.folderManager = new FolderManager(client)
    this.takeoutManager = new TakeoutManager(client, this.messageConverter)
    this.messageManager = new MessageManager(client, this.messageConverter, this.takeoutManager)
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

  get type() {
    return 'client' as const
  }

  async isConnected() {
    return this.connectionManager.isConnected()
  }

  async connect(options?: ConnectOptions) {
    try {
      await this.mediaService.init()
      await this.connectionManager.connect(options)
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '连接客户端', '连接到 Telegram 失败')
      throw error
    }
  }

  async disconnect() {
    try {
      await this.connectionManager.disconnect()
    }
    catch (error) {
      this.errorHandler.handleError(this.toError(error), '断开客户端连接', '断开 Telegram 连接失败')
      // We don't rethrow here as this is typically called during shutdown
    }
  }

  /**
   * Send verification code to the user's phone
   * This is the first step of the authentication process
   */
  public async sendCode(): Promise<boolean> {
    return this.connectionManager.sendCode()
  }

  /**
   * Logout from Telegram and clear session
   */
  public async logout(): Promise<void> {
    return this.connectionManager.logout()
  }

  async getPaginationDialogs(offset = 0, limit = 10): Promise<TelegramChatsResult> {
    try {
      return await this.dialogManager.getPaginationDialogs(offset, limit)
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取分页对话列表',
        `获取对话列表失败 (offset: ${offset}, limit: ${limit})`,
      )
      throw error
    }
  }

  async *getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    try {
      yield * this.messageManager.getMessages(chatId, limit, options)
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取消息',
        `获取聊天 ${chatId} 的消息失败`,
      )
      throw error
    }
  }

  async getUserInfo(userId: string): Promise<Api.users.UserFull> {
    return await this.connectionManager.getClient().invoke(new Api.users.GetFullUser({
      id: userId,
    }))
  }

  async getUsersInfo(userIds: string[]): Promise<Api.TypeUser[]> {
    return await this.connectionManager.getClient().invoke(new Api.users.GetUsers({
      id: userIds,
    }))
  }

  async getHistory(chatId: number): Promise<Api.messages.TypeMessages & { count: number }> {
    try {
      return await this.messageManager.getHistory(chatId)
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取消息历史',
        `获取聊天 ${chatId} 的历史记录失败`,
      )
      throw error
    }
  }

  onMessage(callback: (message: TelegramMessage) => Promise<void>) {
    this.messageManager.onMessage(callback)
  }

  async getFolders(): Promise<DatabaseFolder[]> {
    try {
      return await this.folderManager.getFolders()
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取文件夹',
        '获取文件夹列表失败',
      )
      throw error
    }
  }

  async getFoldersForChat(chatId: number): Promise<TelegramFolder[]> {
    try {
      return await this.folderManager.getFoldersForChat(chatId)
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取聊天文件夹',
        `获取聊天 ${chatId} 的文件夹失败`,
      )
      throw error
    }
  }

  async getDialogs(): Promise<DatabaseNewChat[]> {
    try {
      return await this.dialogManager.getDialogs()
    }
    catch (error) {
      this.errorHandler.handleError(
        this.toError(error),
        '获取对话列表',
        '获取所有对话失败',
      )
      throw error
    }
  }
}
