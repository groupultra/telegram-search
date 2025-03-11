import type { ClientProxyConfig } from '@tg-search/common'
import type { ConnectOptions } from '../../types'
import type { SessionManager } from './session-manager'

import process from 'node:process'
import { useLogger } from '@tg-search/common'
import { Api, TelegramClient } from 'telegram'

import { ErrorHandler } from './utils/error-handler'

/**
 * Manager for Telegram client connection
 * Handles connection establishment, authentication and session management
 */
export class ConnectionManager {
  private client: TelegramClient
  private sessionManager: SessionManager
  private logger = useLogger()
  private errorHandler = new ErrorHandler()
  private apiId: number
  private apiHash: string
  private phoneNumber: string

  constructor(
    sessionManager: SessionManager,
    apiId: number,
    apiHash: string,
    phoneNumber: string,
    proxy?: ClientProxyConfig,
  ) {
    this.sessionManager = sessionManager
    this.apiId = apiId
    this.apiHash = apiHash
    this.phoneNumber = phoneNumber

    // 检查环境变量中的代理设置
    const envProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy
    if (envProxy && !proxy) {
      this.logger.warn(`检测到环境变量中的HTTP代理设置: ${envProxy}`)
      this.logger.warn('Telegram 不支持 HTTP 代理，仅支持 SOCKS4、SOCKS5 和 MTProto 代理')
      this.logger.warn('请在配置文件中明确设置支持的代理类型')
    }

    // 记录代理配置信息
    if (proxy) {
      this.logger.withFields({
        proxyIp: proxy.ip,
        proxyPort: proxy.port,
        proxyType: proxy.MTProxy ? 'MTProxy' : `SOCKS${proxy.socksType || 5}`,
      }).debug('使用代理连接 Telegram')
    }

    // Create client with session
    this.client = new TelegramClient(
      this.sessionManager.getSession(),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
        useWSS: proxy ? false : undefined, // 如果使用代理，禁用 WSS
        proxy: proxy
          ? (proxy.MTProxy && proxy.secret
              // MTProxy类型
              ? {
                  ip: proxy.ip,
                  port: proxy.port,
                  MTProxy: true,
                  secret: proxy.secret,
                  timeout: proxy.timeout || 15, // 增加默认超时时间到15秒
                }
              // SOCKS类型
              : {
                  ip: proxy.ip,
                  port: proxy.port,
                  socksType: proxy.socksType || 5, // 默认使用SOCKS5
                  timeout: proxy.timeout || 15, // 增加默认超时时间到15秒
                  username: proxy.username,
                  password: proxy.password,
                })
          : undefined,
      },
    )
  }

  /**
   * Get the Telegram client instance
   */
  public getClient(): TelegramClient {
    return this.client
  }

  public async getMe(): Promise<Api.User> {
    return this.client.getMe()
  }

  /**
   * Check if the client is connected and authorized
   */
  public async isConnected(): Promise<boolean> {
    try {
      return await this.errorHandler.withRetry(
        () => this.client.isUserAuthorized(),
        {
          context: '检查连接状态',
          maxRetries: 2,
          initialDelay: 500,
          throwAfterRetries: false,
        },
      ).then(result => result.success && result.data === true)
    }
    catch (error) {
      this.logger.withError(error).error('检查连接状态失败')
      return false
    }
  }

  /**
   * Connect to Telegram and authenticate with verification code
   * This is the second step of the authentication process
   */
  public async connect(options?: ConnectOptions): Promise<void> {
    try {
      // 加载会话
      const session = await this.sessionManager.loadSession()

      if (session) {
        this.client.session = this.sessionManager.getSession()
      }

      // 确保已连接但未检查授权状态
      try {
        await this.errorHandler.withRetry(
          () => this.client.connect(),
          {
            context: '连接到Telegram',
            maxRetries: 3,
            initialDelay: 1000,
          },
        )
      }
      catch (error: any) {
        // 处理代理连接错误
        if (error.message && (
          error.message.includes('SOCKS')
          || error.message.includes('proxy')
          || error.message.includes('connection')
          || error.message.includes('timeout')
          || error.message.includes('ETIMEDOUT')
          || error.message.includes('ECONNREFUSED')
        )) {
          this.logger.error('代理连接失败，请检查代理配置是否正确')
          this.logger.debug('提示: Telegram 仅支持 SOCKS4、SOCKS5 和 MTProto 代理，不支持 HTTP 代理')

          // 根据错误提供具体建议
          if (error.message.includes('ECONNREFUSED')) {
            this.logger.error('连接被拒绝，请确认代理服务器地址和端口是否正确')
          }
          else if (error.message.includes('ETIMEDOUT')) {
            this.logger.error('连接超时，请检查网络连接或尝试其他代理服务器')
          }
          else if (error.message.includes('91.108.56')) {
            this.logger.error('无法连接到Telegram服务器IP，代理可能不支持该地区的连接')
          }

          throw new Error(`代理连接失败: ${error.message}`)
        }
        throw error
      }

      // 检查用户是否已授权
      const isAuthorized = await this.client.isUserAuthorized()

      if (!isAuthorized) {
        // 验证码必须已通过sendCode()发送
        if (!options?.code) {
          throw new Error('需要验证码才能登录，请先调用sendCode()')
        }

        // 使用验证码和可能的密码进行登录
        await this.errorHandler.withRetry(
          () => this.client.signInUser(
            {
              apiId: this.apiId,
              apiHash: this.apiHash,
            },
            {
              phoneNumber: this.phoneNumber,
              phoneCode: async () => {
                if (typeof options?.code === 'function') {
                  return options.code()
                }
                return options?.code || ''
              },
              password: async () => {
                if (typeof options?.password === 'function') {
                  return options.password()
                }
                return options?.password || ''
              },
              onError: (err: Error) => {
                this.errorHandler.handleError(err, '登录过程', '登录失败')
                throw err
              },
            },
          ),
          {
            context: '用户登录',
            maxRetries: 2,
            initialDelay: 1000,
          },
        )
      }

      // 保存会话
      const sessionString = await this.client.session.save() as unknown as string
      await this.sessionManager.saveSession(sessionString)
      this.logger.log('登录成功')
    }
    catch (error: any) {
      this.errorHandler.handleError(error, '连接过程', '连接失败')
      throw error
    }
  }

  /**
   * Disconnect from Telegram
   */
  public async disconnect(): Promise<void> {
    await this.errorHandler.withRetry(
      async () => this.client.disconnect(),
      {
        context: '断开连接',
        maxRetries: 2,
        initialDelay: 500,
        throwAfterRetries: false,
      },
    )
  }

  /**
   * Logout from Telegram and clear session
   */
  public async logout(): Promise<void> {
    try {
      if (this.client.connected) {
        await this.client.invoke(new Api.auth.LogOut())
        await this.disconnect()
      }
      await this.client.session.delete()
      await this.sessionManager.clearSession()

      this.logger.log('已成功登出并清除会话')
    }
    catch (error: any) {
      this.errorHandler.handleError(error, '登出过程', '登出失败')
      throw error
    }
  }

  /**
   * Send verification code to the user's phone
   * This is the first step of the authentication process
   */
  public async sendCode(): Promise<boolean> {
    try {
      // 首先确保连接到Telegram服务器
      await this.errorHandler.withRetry(
        () => this.client.connect(),
        {
          context: '连接到Telegram服务器',
          maxRetries: 3,
          initialDelay: 1000,
        },
      )

      // 已经授权的情况下不需要发送验证码
      const isAuthorized = await this.client.isUserAuthorized()
      if (isAuthorized) {
        this.logger.log('用户已授权，无需发送验证码')
      }

      // 发送验证码
      const result = await this.errorHandler.withRetry(
        () => this.client.sendCode(
          {
            apiId: this.apiId,
            apiHash: this.apiHash,
          },
          this.phoneNumber,
        ),
        {
          context: '发送验证码',
          maxRetries: 2,
          initialDelay: 1000,
        },
      )

      this.logger.log('验证码已发送')
      return result.success
    }
    catch (error: any) {
      this.errorHandler.handleError(error, '发送验证码过程', '发送验证码失败')
      throw error
    }
  }
}
