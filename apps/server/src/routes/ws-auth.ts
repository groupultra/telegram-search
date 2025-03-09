import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Peer } from 'crossws'
import type { App } from 'h3'
import type { UserInfoResponse } from '../types/apis/user-info'
import type { WsMessage } from '../utils/ws'

import { useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, defineWebSocketHandler } from 'h3'
import { z } from 'zod'

import { useTelegramClient } from '../services/telegram'
import { createErrorResponse, createResponse } from '../utils/response'
import { createErrorMessage, createSuccessMessage, parseMessage } from '../utils/ws'

// 创建日志实例
const logger = useLogger()

// 消息类型
enum MessageType {
  LOGIN = 'LOGIN',
  VERIFICATION_CODE = 'VERIFICATION_CODE',
  TWO_FACTOR_AUTH = 'TWO_FACTOR_AUTH',
  LOGIN_PROGRESS = 'LOGIN_PROGRESS',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_ERROR = 'LOGIN_ERROR',
  STATUS = 'STATUS',
  LOGOUT = 'LOGOUT',
}

// 消息验证模式
const schemas = {
  login: z.object({
    type: z.literal(MessageType.LOGIN),
    data: z.object({
      phoneNumber: z.string(),
      apiId: z.number().optional(),
      apiHash: z.string().optional(),
    }),
  }),
  verificationCode: z.object({
    type: z.literal(MessageType.VERIFICATION_CODE),
    data: z.object({
      code: z.string(),
    }),
  }),
  status: z.object({
    type: z.literal(MessageType.STATUS),
  }),
  logout: z.object({
    type: z.literal(MessageType.LOGOUT),
  }),
  twoFactorAuth: z.object({
    type: z.literal(MessageType.TWO_FACTOR_AUTH),
    data: z.object({
      password: z.string(),
    }),
  }),
}

// 客户端状态管理
interface ClientState {
  client?: ITelegramClientAdapter
  phoneNumber?: string
  pendingVerificationCode?: boolean
  pendingTwoFactorAuth?: boolean
  codeResolver?: (code: string) => void
  codeRejector?: (error: Error) => void
  passwordResolver?: (password: string) => void
  passwordRejector?: (error: Error) => void
}

/**
 * 设置WebSocket认证路由
 */
export function setupWsAuthRoutes(app: App) {
  // 创建临时路由处理器，处理之前REST API的请求
  const router = createRouter()

  router.get('/status', defineEventHandler(async () => {
    const client = await useTelegramClient()
    if (!await client.isConnected()) {
      try {
        await client.connect()
        const isConnected = await client.isConnected()
        return createResponse({ connected: isConnected })
      }
      catch (connError) {
        return createErrorResponse(connError)
      }
    }
    return createResponse({ connected: true })
  }))

  router.post('/logout', defineEventHandler(async () => {
    const client = await useTelegramClient()
    try {
      await client.logout()
      return createResponse({ success: true })
    }
    catch (error) {
      return createErrorResponse(error)
    }
  }))

  router.get('/me', defineEventHandler(async () => {
    const client = await useTelegramClient()
    const userInfo = await client.getMeInfo()

    const response: UserInfoResponse = {
      id: userInfo.id.toString(),
      firstName: userInfo.firstName ?? '',
      lastName: userInfo.lastName ?? '',
      username: userInfo.username ?? '',
    }

    return createResponse<UserInfoResponse>(response)
  }))

  // 将旧的auth路由挂载到/auth路径
  app.use('/auth', router.handler)

  // 存储每个WebSocket连接的状态
  const clientStates = new Map<string, ClientState>()

  // WebSocket处理
  app.use('/ws/auth', defineWebSocketHandler({
    async open(peer) {
      logger.debug('[/ws/auth] WebSocket连接已打开', { peerId: peer.id })

      // 初始化连接状态
      clientStates.set(peer.id, {})

      try {
        const client = await useTelegramClient()
        const connected = await client.isConnected()
        logger.debug(`[/ws/auth] 状态检查结果: connected=${connected}`)

        peer.send(JSON.stringify({
          type: 'CONNECTED',
          data: { connected },
        }))
      }
      catch (error) {
        logger.error('[/ws/auth] 发送初始连接消息失败', { error })
      }
    },

    // 消息处理
    async message(peer, message) {
      // 获取此连接的客户端状态
      let clientState = clientStates.get(peer.id)
      if (!clientState) {
        // 如果状态不存在（理论上不应发生），创建一个新状态
        clientState = {}
        clientStates.set(peer.id, clientState)
      }

      try {
        const msgData = parseMessage(message)
        if (!msgData) {
          throw new Error('Invalid message format')
        }

        logger.debug('[/ws/auth] 收到WebSocket消息', { type: msgData.type })

        // 根据消息类型分发处理
        switch (msgData.type) {
          case MessageType.LOGIN:
            await handleLogin(peer, msgData, clientState)
            break
          case MessageType.VERIFICATION_CODE:
            await handleVerificationCode(peer, msgData, clientState)
            break
          case MessageType.STATUS:
            await handleStatus(peer, clientState)
            break
          case MessageType.LOGOUT:
            await handleLogout(peer, clientState)
            break
          case MessageType.TWO_FACTOR_AUTH:
            await handleTwoFactorAuth(peer, msgData, clientState)
            break
          default:
            logger.warn('[/ws/auth] 未知消息类型', { type: msgData.type })
            peer.send(JSON.stringify(createErrorMessage(
              MessageType.LOGIN_ERROR,
              'Unknown message type',
            )))
        }
      }
      catch (error) {
        logger.error('[/ws/auth] 处理WebSocket消息失败', { error })
        try {
          peer.send(JSON.stringify(createErrorMessage(
            MessageType.LOGIN_ERROR,
            error instanceof Error ? error.message : 'Unknown error',
          )))
        }
        catch (sendError) {
          logger.error('[/ws/auth] 发送错误消息失败', { error: sendError })
        }
      }
    },

    // 连接关闭
    close(peer) {
      logger.debug('[/ws/auth] WebSocket连接已关闭', { peerId: peer.id })

      // 清理状态
      clientStates.delete(peer.id)
    },
  }))
}

/**
 * 处理登录请求 - 统一版本
 */
async function handleLogin(peer: Peer, message: WsMessage, state: ClientState) {
  try {
    // 验证消息格式
    const { data } = schemas.login.parse(message)
    const { phoneNumber, apiId, apiHash } = data // 不再需要code参数

    // 检查是否已经有客户端实例
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client
    state.phoneNumber = phoneNumber

    // 如果提供了API凭据，则更新配置
    if (apiId && apiHash && phoneNumber) {
      await updateClientConfig(phoneNumber, apiId, apiHash)
      logger.debug('[/ws/auth] API凭据已更新')
    }

    // 通知前端登录开始
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGIN_PROGRESS,
      { step: 'LOGIN_STARTED' },
    )))

    // 初始化状态
    state.pendingVerificationCode = false
    state.pendingTwoFactorAuth = false
    state.codeResolver = undefined
    state.codeRejector = undefined
    state.passwordResolver = undefined
    state.passwordRejector = undefined

    try {
      await client.connect({
        // 验证码回调
        code: async () => {
          // 标记需要验证码
          state.pendingVerificationCode = true

          // 通知前端需要验证码
          peer.send(JSON.stringify(createSuccessMessage(
            MessageType.LOGIN_PROGRESS,
            { step: 'CODE_REQUIRED' },
          )))

          // 返回Promise等待验证码
          return new Promise<string>((resolve, reject) => {
            // 设置解析器，以便在收到验证码消息时可以解析
            state.codeResolver = resolve
            state.codeRejector = reject

            // 设置超时（可选）
            setTimeout(() => {
              if (state.pendingVerificationCode) {
                reject(new Error('验证码请求超时'))
                state.pendingVerificationCode = false
                state.codeResolver = undefined
                state.codeRejector = undefined
              }
            }, 300000) // 5分钟超时
          })
        },
        // 密码回调
        password: async () => {
          // 标记需要2FA
          state.pendingTwoFactorAuth = true

          // 通知前端需要2FA密码
          peer.send(JSON.stringify(createSuccessMessage(
            MessageType.LOGIN_PROGRESS,
            { step: 'PASSWORD_REQUIRED' },
          )))

          // 创建一个Promise等待密码
          return new Promise<string>((resolve, reject) => {
            // 设置解析器，以便在收到2FA消息时可以解析
            state.passwordResolver = resolve
            state.passwordRejector = reject

            // 设置超时（可选）
            setTimeout(() => {
              if (state.pendingTwoFactorAuth) {
                reject(new Error('2FA请求超时'))
                state.pendingTwoFactorAuth = false
                state.passwordResolver = undefined
                state.passwordRejector = undefined
              }
            }, 300000) // 5分钟超时
          })
        },
      })

      // 登录成功
      logger.debug('[/ws/auth] 登录成功')
      peer.send(JSON.stringify(createSuccessMessage(
        MessageType.LOGIN_SUCCESS,
        { success: true },
      )))
    }
    catch (error) {
      // 错误处理
      logger.error('[/ws/auth] 登录失败', { error })

      // 清理2FA状态
      if (state.passwordRejector) {
        (state.passwordRejector as (error: Error) => void)(new Error('登录过程中断'))
      }

      // 清理验证码状态
      if (state.codeRejector) {
        (state.codeRejector as (error: Error) => void)(new Error('登录过程中断'))
      }

      // 重置所有状态
      state.pendingVerificationCode = false
      state.pendingTwoFactorAuth = false
      state.codeResolver = undefined
      state.codeRejector = undefined
      state.passwordResolver = undefined
      state.passwordRejector = undefined

      peer.send(JSON.stringify(createErrorMessage(
        MessageType.LOGIN_ERROR,
        error,
        'Login failed',
      )))
    }
  }
  catch (error) {
    logger.error('[/ws/auth] 处理登录请求失败', { error })
    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Invalid request format',
    )))
  }
}

/**
 * 处理验证码输入
 */
async function handleVerificationCode(peer: Peer, message: WsMessage, state: ClientState) {
  try {
    // 验证消息格式
    const { data } = schemas.verificationCode.parse(message)
    const { code } = data

    // 确保存在待处理的验证码请求
    if (!state.pendingVerificationCode || !state.codeResolver) {
      throw new Error('没有待处理的验证码请求')
    }

    logger.debug('[/ws/auth] 收到验证码')

    // 通知前端验证码已接收
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGIN_PROGRESS,
      { step: 'CODE_RECEIVED' },
    )))

    // 解析验证码promise
    state.codeResolver(code)

    // 清理状态
    state.pendingVerificationCode = false
    state.codeResolver = undefined
    state.codeRejector = undefined

    // 注意：不需要在这里发送LOGIN_SUCCESS消息
    // 因为验证码解析后，登录流程会继续，成功后会在handleLogin中发送成功消息
  }
  catch (error) {
    logger.error('[/ws/auth] 处理验证码请求失败', { error })

    // 如果有验证码拒绝器，拒绝验证码promise
    if (state.codeRejector) {
      (state.codeRejector as (error: Error) => void)(error instanceof Error ? error : new Error(String(error)))
    }

    // 清理状态
    state.pendingVerificationCode = false
    state.codeResolver = undefined
    state.codeRejector = undefined

    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Invalid verification code request',
    )))
  }
}

/**
 * 处理状态检查请求
 */
async function handleStatus(peer: Peer, state: ClientState) {
  try {
    // 如果还没有客户端实例，创建一个
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client

    // 如果未连接，尝试连接（不会执行登录）
    let connected = false
    if (!await client.isConnected()) {
      try {
        await client.connect()
        connected = await client.isConnected()
      }
      catch (connError) {
        // 连接失败但不中断流程，返回未连接状态
        logger.debug('[/ws/auth] 尝试连接失败，返回未连接状态', { error: connError })
      }
    }
    else {
      connected = true
    }

    logger.debug(`[/ws/auth] 状态检查结果: connected=${connected}`)
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.STATUS,
      { connected },
    )))
  }
  catch (error) {
    logger.error('[/ws/auth] 状态检查失败', { error })
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.STATUS,
      { connected: false },
    )))
  }
}

/**
 * 处理登出请求
 */
async function handleLogout(peer: Peer, state: ClientState) {
  try {
    // 如果还没有客户端实例，创建一个
    if (!state.client) {
      state.client = await useTelegramClient()
    }

    const client = state.client

    if (await client.isConnected()) {
      await client.logout()
      logger.debug('[/ws/auth] 已成功登出并清除会话')
    }
    else {
      logger.debug('[/ws/auth] 客户端未连接，无需登出')
    }

    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGOUT,
      { success: true },
    )))
  }
  catch (error) {
    logger.error('[/ws/auth] 登出失败', { error })
    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Logout failed',
    )))
  }
}

/**
 * 更新客户端API配置
 */
async function updateClientConfig(phoneNumber: string, apiId: number, apiHash: string): Promise<void> {
  const { getConfig, updateConfig } = await import('@tg-search/common')
  const config = getConfig()
  config.api.telegram = {
    ...config.api.telegram,
    apiId: apiId.toString(),
    apiHash,
    phoneNumber,
  }
  updateConfig(config)
}

/**
 * 处理2FA请求
 */
async function handleTwoFactorAuth(peer: Peer, message: WsMessage, state: ClientState) {
  try {
    // 验证消息格式
    const { data } = schemas.twoFactorAuth.parse(message)
    const { password } = data

    // 确保存在待处理的2FA请求
    if (!state.pendingTwoFactorAuth || !state.passwordResolver) {
      throw new Error('没有待处理的2FA认证请求')
    }

    logger.debug('[/ws/auth] 收到2FA密码')

    // 通知前端2FA验证已接收
    peer.send(JSON.stringify(createSuccessMessage(
      MessageType.LOGIN_PROGRESS,
      { step: '2FA_RECEIVED' },
    )))

    // 解析密码promise
    state.passwordResolver(password)

    // 清理状态
    state.pendingTwoFactorAuth = false
    state.passwordResolver = undefined
    state.passwordRejector = undefined
  }
  catch (error) {
    logger.error('[/ws/auth] 处理2FA请求失败', { error })

    // 如果有密码拒绝器，拒绝密码promise
    if (state.passwordRejector) {
      (state.passwordRejector as (error: Error) => void)(error instanceof Error ? error : new Error(String(error)))
    }

    // 清理状态
    state.pendingTwoFactorAuth = false
    state.passwordResolver = undefined
    state.passwordRejector = undefined

    peer.send(JSON.stringify(createErrorMessage(
      MessageType.LOGIN_ERROR,
      error,
      'Invalid 2FA request format',
    )))
  }
}
