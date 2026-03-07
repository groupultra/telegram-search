import type { Bot, Context } from 'grammy'

import type { BotCommandContext } from '.'

import { CoreEventType } from '@tg-search/core'

interface LoginState {
  step: 'phone' | 'code' | 'password'
  phoneNumber?: string
  accountId?: string
}

const loginStates = new Map<number, LoginState>()

export function registerLoginCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:login')

  bot.command('login', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you.')
      return
    }

    // Check if already logged in
    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (account) {
      const coreCtx = ctx.getAccountContext(account.id)
      if (coreCtx) {
        await gramCtx.reply(
          'You are already logged in.\n\n'
          + 'Use /status to check your connection status.\n'
          + 'Use /logout to disconnect.',
        )
        return
      }
    }

    loginStates.set(userId, { step: 'phone' })

    await gramCtx.reply(
      'Please send your phone number to log in.\n\n'
      + 'Format: +1234567890 (with country code)\n\n'
      + 'Send /cancel to cancel the login process.',
    )
  })

  bot.command('cancel', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId)
      return

    if (loginStates.has(userId)) {
      loginStates.delete(userId)
      await gramCtx.reply('Login process cancelled.')
    }
  })

  // Handle text messages for login flow
  bot.on('message:text', async (gramCtx, next) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      return next()
    }

    const state = loginStates.get(userId)
    if (!state) {
      return next()
    }

    const text = gramCtx.message.text.trim()

    // Ignore commands
    if (text.startsWith('/')) {
      return next()
    }

    switch (state.step) {
      case 'phone':
        await handlePhoneNumber(gramCtx, userId, text)
        break
      case 'code':
        await handleCode(gramCtx, userId, text)
        break
      case 'password':
        await handlePassword(gramCtx, userId, text)
        break
      default:
        return next()
    }
  })

  async function handlePhoneNumber(gramCtx: Context, userId: number, phone: string) {
    // Basic phone number validation
    const cleaned = phone.replace(/[\s\-()]/g, '')
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      await gramCtx.reply(
        'Invalid phone number format.\n'
        + 'Please send a valid phone number with country code (e.g., +1234567890).',
      )
      return
    }

    const phoneNumber = cleaned.startsWith('+') ? cleaned : `+${cleaned}`

    logger.withFields({ userId }).log('Starting login with phone number')

    try {
      // Create or get an account context for this user
      const accountId = String(userId)
      const coreCtx = ctx.ensureAccountContext(accountId)

      loginStates.set(userId, { step: 'phone', phoneNumber, accountId })

      await gramCtx.reply('Sending verification code...')

      // Listen for auth events
      const codeNeededPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthCodeNeeded, () => resolve())
      })

      const passwordNeededPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthPasswordNeeded, () => resolve())
      })

      const connectedPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthConnected, () => resolve())
      })

      const errorPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthError, () => resolve())
      })

      // Emit the login event
      coreCtx.emitter.emit(CoreEventType.AuthLogin, { phoneNumber })

      // Wait for one of the auth events
      const result = await Promise.race([
        codeNeededPromise.then(() => 'code' as const),
        passwordNeededPromise.then(() => 'password' as const),
        connectedPromise.then(() => 'connected' as const),
        errorPromise.then(() => 'error' as const),
        new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 60_000)),
      ])

      switch (result) {
        case 'code':
          loginStates.set(userId, { step: 'code', phoneNumber, accountId })
          await gramCtx.reply(
            'Verification code sent to your Telegram account.\n'
            + 'Please enter the code you received.',
          )
          break
        case 'password':
          loginStates.set(userId, { step: 'password', phoneNumber, accountId })
          await gramCtx.reply('Two-factor authentication is enabled.\nPlease enter your password.')
          break
        case 'connected':
          loginStates.delete(userId)
          await gramCtx.reply(
            'Login successful!\n\n'
            + 'You can now use:\n'
            + '/search - Search your messages\n'
            + '/export - Export/sync messages\n'
            + '/summary - Get message summaries\n'
            + '/status - Check connection status',
          )
          break
        case 'error':
          loginStates.delete(userId)
          await gramCtx.reply('Login failed. Please try again with /login.')
          break
        case 'timeout':
          loginStates.delete(userId)
          await gramCtx.reply('Login timed out. Please try again with /login.')
          break
      }
    }
    catch (error) {
      logger.withError(error).error('Login phone step failed')
      loginStates.delete(userId)
      await gramCtx.reply('An error occurred during login. Please try again with /login.')
    }
  }

  async function handleCode(gramCtx: Context, userId: number, code: string) {
    const state = loginStates.get(userId)
    if (!state?.accountId) {
      loginStates.delete(userId)
      await gramCtx.reply('Session expired. Please start over with /login.')
      return
    }

    // Validate code format
    const cleanCode = code.replace(/[\s\-]/g, '')
    if (!/^\d{5}$/.test(cleanCode)) {
      await gramCtx.reply('Invalid code format. Please enter the 5-digit code.')
      return
    }

    const coreCtx = ctx.getAccountContext(state.accountId)
    if (!coreCtx) {
      loginStates.delete(userId)
      await gramCtx.reply('Session expired. Please start over with /login.')
      return
    }

    logger.withFields({ userId }).log('Submitting verification code')

    try {
      const passwordNeededPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthPasswordNeeded, () => resolve())
      })

      const connectedPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthConnected, () => resolve())
      })

      const errorPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthError, () => resolve())
      })

      // Submit the code
      coreCtx.emitter.emit(CoreEventType.AuthCode, { code: cleanCode })

      const result = await Promise.race([
        passwordNeededPromise.then(() => 'password' as const),
        connectedPromise.then(() => 'connected' as const),
        errorPromise.then(() => 'error' as const),
        new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 30_000)),
      ])

      switch (result) {
        case 'password':
          loginStates.set(userId, { ...state, step: 'password' })
          await gramCtx.reply('Two-factor authentication is enabled.\nPlease enter your password.')
          break
        case 'connected':
          loginStates.delete(userId)
          await gramCtx.reply(
            'Login successful!\n\n'
            + 'You can now use:\n'
            + '/search - Search your messages\n'
            + '/export - Export/sync messages\n'
            + '/summary - Get message summaries\n'
            + '/status - Check connection status',
          )
          break
        case 'error':
          loginStates.delete(userId)
          await gramCtx.reply('Invalid code. Please try again with /login.')
          break
        case 'timeout':
          loginStates.delete(userId)
          await gramCtx.reply('Verification timed out. Please try again with /login.')
          break
      }
    }
    catch (error) {
      logger.withError(error).error('Login code step failed')
      loginStates.delete(userId)
      await gramCtx.reply('An error occurred. Please try again with /login.')
    }
  }

  async function handlePassword(gramCtx: Context, userId: number, password: string) {
    const state = loginStates.get(userId)
    if (!state?.accountId) {
      loginStates.delete(userId)
      await gramCtx.reply('Session expired. Please start over with /login.')
      return
    }

    const coreCtx = ctx.getAccountContext(state.accountId)
    if (!coreCtx) {
      loginStates.delete(userId)
      await gramCtx.reply('Session expired. Please start over with /login.')
      return
    }

    logger.withFields({ userId }).log('Submitting 2FA password')

    try {
      // Try to delete the password message for security
      try {
        await gramCtx.deleteMessage()
      }
      catch {
        // Ignore if we can't delete (e.g., no permission)
      }

      const connectedPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthConnected, () => resolve())
      })

      const errorPromise = new Promise<void>((resolve) => {
        coreCtx.emitter.once(CoreEventType.AuthError, () => resolve())
      })

      // Submit the password
      coreCtx.emitter.emit(CoreEventType.AuthPassword, { password })

      const result = await Promise.race([
        connectedPromise.then(() => 'connected' as const),
        errorPromise.then(() => 'error' as const),
        new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 30_000)),
      ])

      switch (result) {
        case 'connected':
          loginStates.delete(userId)
          await gramCtx.reply(
            'Login successful!\n\n'
            + 'You can now use:\n'
            + '/search - Search your messages\n'
            + '/export - Export/sync messages\n'
            + '/summary - Get message summaries\n'
            + '/status - Check connection status',
          )
          break
        case 'error':
          loginStates.delete(userId)
          await gramCtx.reply('Invalid password. Please try again with /login.')
          break
        case 'timeout':
          loginStates.delete(userId)
          await gramCtx.reply('Verification timed out. Please try again with /login.')
          break
      }
    }
    catch (error) {
      logger.withError(error).error('Login password step failed')
      loginStates.delete(userId)
      await gramCtx.reply('An error occurred. Please try again with /login.')
    }
  }

  return {
    hasActiveLogin: (userId: number) => loginStates.has(userId),
  }
}
