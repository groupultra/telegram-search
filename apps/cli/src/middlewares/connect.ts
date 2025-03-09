import type { TelegramAdapter } from '@tg-search/core'

import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'

const logger = useLogger()

/**
 * Authentication middleware to handle Telegram login
 * This middleware ensures that the client is authenticated before executing commands
 */
export async function ensureAuthenticated(client: TelegramAdapter): Promise<void> {
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      logger.log('正在连接到 Telegram...')

      // Try to connect with callbacks for authentication
      await client.connect({
        code: async () => {
          logger.log('需要验证码')
          const code = await input.input({ message: '请输入你收到的验证码：' })
          if (!code)
            throw new Error('需要验证码')
          return code
        },
        password: async () => {
          logger.log('需要两步验证密码')
          const password = await input.password({ message: '请输入两步验证密码：' })
          if (!password)
            throw new Error('需要两步验证密码')
          return password
        },
      })

      logger.log('连接成功')
      return
    }
    catch (error) {
      if (error instanceof Error) {
        // Skip if already connected
        if (error.message.includes('already connected')) {
          logger.log('已经连接')
          return
        }

        // Handle invalid code
        if (error.message.includes('PHONE_CODE_INVALID')) {
          logger.warn('验证码无效，请重试')
          retryCount++
          continue
        }

        // Log other errors
        logger.withError(error).error('连接失败')
      }
      throw error
    }
  }

  throw new Error('验证码重试次数过多，请稍后再试')
}
