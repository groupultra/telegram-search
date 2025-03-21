import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { SendMessageParams } from 'telegram/client/messages'
import type { ClientAdapterConfig, ConnectOptions, GetTelegramMessageParams, ITelegramClientAdapter, TelegramChatsResult, TelegramFolder, TelegramMessage } from '../../types'

import process from 'node:process'
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

    // 检查并处理环境变量中的SOCKS代理
    if (!this.config.proxy) {
      const socksProxy = process.env.SOCKS_PROXY || process.env.socks_proxy || process.env.ALL_PROXY || process.env.all_proxy
      if (socksProxy) {
        try {
          // 解析SOCKS_PROXY环境变量 (格式: socks5://user:pass@host:port)
          const socksUrl = new URL(socksProxy)
          const socksType = socksUrl.protocol.startsWith('socks5') ? 5 : 4
          const proxyHost = socksUrl.hostname
          const proxyPort = Number.parseInt(socksUrl.port || '1080')

          // 设置代理配置
          this.config.proxy = {
            ip: proxyHost,
            port: proxyPort,
            socksType,
            username: socksUrl.username || undefined,
            password: socksUrl.password || undefined,
          }

          this.logger.debug(`已从环境变量配置SOCKS${socksType}代理: ${proxyHost}:${proxyPort}`)
        }
        catch {
          this.logger.warn(`无法解析SOCKS代理环境变量: ${socksProxy}`)
        }
      }
    }

    // Initialize session and connection managers
    this.sessionManager = new SessionManager(appConfig.path.session)
    this.connectionManager = new ConnectionManager(
      this.sessionManager,
      config.apiId,
      config.apiHash,
      config.phoneNumber,
      this.config.proxy,
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

  async* getMessages(chatId: number, limit = 100, options?: GetTelegramMessageParams): AsyncGenerator<TelegramMessage> {
    try {
      yield* this.messageManager.getMessages(chatId, limit, options)
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

  async getMeInfo(): Promise<Api.User> {
    return this.connectionManager.getMe()
  }

  async getUserInfo(userId: string): Promise<Api.User> {
    const users = await this.connectionManager.getClient().invoke(new Api.users.GetUsers({
      id: [userId],
    }))

    const user = users[0]

    // Filter out empty user results
    if (!user || user instanceof Api.UserEmpty) {
      throw new Error(`User ${userId} not found`)
    }

    return user
  }

  /**
   * Send message
   */
  async sendMessage(chatId: number, sendMessageParams?: SendMessageParams) {
    await this.messageManager.sendMessage(chatId, sendMessageParams!)
  }

  async getUsersInfo(userIds: string[]): Promise<Api.User[]> {
    const users = await this.connectionManager.getClient().invoke(new Api.users.GetUsers({
      id: userIds,
    }))

    // Filter out empty or invalid user results
    const validUsers = users.filter(user => user && !(user instanceof Api.UserEmpty))

    if (validUsers.length === 0) {
      throw new Error('No valid users found')
    }

    return validUsers as Api.User[]
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
