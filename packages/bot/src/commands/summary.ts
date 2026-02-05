import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

type SummaryMode = 'unread' | 'today' | 'last24h'

export function registerSummaryCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:summary')

  // /summary - show mode selection
  bot.command('summary', async (gramCtx) => {
    const userId = gramCtx.from?.id
    if (!userId) {
      await gramCtx.reply('Could not identify you.')
      return
    }

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.reply('Your account is not linked. Please log in through the web interface first.')
      return
    }

    try {
      const keyboard = new InlineKeyboard()
        .text('📬 Unread', 'sum:unread')
        .text('📅 Today', 'sum:today')
        .row()
        .text('🕐 Last 24h', 'sum:last24h')

      await gramCtx.reply('Choose what to summarize:', { reply_markup: keyboard })
    }
    catch (error) {
      logger.withError(error).error('Summary command failed')
      await gramCtx.reply('An error occurred. Please try again later.')
    }
  })

  // Handle summary mode selection
  bot.callbackQuery(/^sum:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const mode = gramCtx.callbackQuery.data.split(':')[1] as SummaryMode

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    try {
      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText('📝 Fetching messages...')

      const db = ctx.getDB()

      // 1. Fetch messages
      const messages = await fetchMessagesForSummary(ctx, account.id, mode)

      if (messages.length === 0) {
        await gramCtx.editMessageText(`No ${mode} messages to summarize.`)
        return
      }

      // 2. Get LLM config
      const accountResult = await ctx.models.accountModels.findAccountByUUID(db, account.id)
      const accountData = accountResult.expect('Account not found')
      const llmConfig = accountData.settings?.llm

      if (!llmConfig?.apiKey) {
        await gramCtx.editMessageText(
          '⚠️ Please configure your OpenAI API key in the web interface first.\n\nGo to Settings → LLM Configuration',
        )
        return
      }

      // 3. Generate summary
      await gramCtx.editMessageText(
        `📝 Generating summary for ${messages.length} messages...`,
      )

      const summary = await generateSummary(messages, llmConfig)

      // 4. Format and send summary
      const modeLabel = {
        unread: 'Unread Messages',
        today: 'Today\'s Messages',
        last24h: 'Last 24 Hours',
      }[mode]

      const summaryText = `📊 **${modeLabel} Summary**\n\n${summary}\n\n---\n_Based on ${messages.length} message(s)_`

      await gramCtx.editMessageText(
        summaryText,
        { parse_mode: 'Markdown' },
      )
    }
    catch (error) {
      logger.withError(error).error('Summary generation failed')
      await gramCtx.reply('❌ An error occurred while generating summary. Please try again later.')
    }
  })
}

/**
 * Fetch messages based on summary mode
 */
async function fetchMessagesForSummary(
  ctx: BotCommandContext,
  accountId: string,
  mode: SummaryMode,
): Promise<Array<{ fromName?: string, fromId?: string, content: string }>> {
  const db = ctx.getDB()
  const now = Math.floor(Date.now() / 1000)

  let startTime: number
  const endTime = now

  switch (mode) {
    case 'unread': {
      // Fetch unread messages (simplified - get messages from last 7 days)
      startTime = now - 7 * 24 * 60 * 60
      break
    }
    case 'today': {
      // Today's messages (00:00 to now)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      startTime = Math.floor(todayStart.getTime() / 1000)
      break
    }
    case 'last24h': {
      // Last 24 hours
      startTime = now - 24 * 60 * 60
      break
    }
  }

  // Query messages
  const result = await ctx.models.chatMessageModels.retrieveMessages(
    db,
    ctx.logger,
    accountId,
    undefined,
    1536, // embedding dimension
    { text: '' }, // empty query to get all messages
    { limit: 1000, offset: 0 },
    {
      timeRange: {
        start: startTime,
        end: endTime,
      },
    },
  )

  const allMessages = result.expect('Failed to fetch messages')

  // Map to simple format
  return allMessages.map(msg => ({
    fromName: msg.from_name,
    fromId: msg.from_id,
    content: msg.content || '',
  }))
}

/**
 * Generate summary using OpenAI API
 */
async function generateSummary(
  messages: Array<{ fromName?: string, fromId?: string, content: string }>,
  llmConfig: { apiKey: string, apiBase?: string, model?: string, temperature?: number, maxTokens?: number },
): Promise<string> {
  // Build message content
  const content = messages
    .map((m) => {
      const name = m.fromName || (m.fromId ? `User ${m.fromId}` : 'Unknown')
      return `${name}: ${m.content}`
    })
    .join('\n')

  // Call OpenAI API
  const response = await fetch(`${llmConfig.apiBase || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: llmConfig.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Summarize the following Telegram messages concisely in Chinese. Focus on key points, important discussions, and action items.',
        },
        {
          role: 'user',
          content,
        },
      ],
      temperature: llmConfig.temperature || 0.7,
      max_tokens: llmConfig.maxTokens || 2000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
