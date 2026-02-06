import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'

import { generateMessageLink } from '../utils/deep-link'

type SummaryMode = 'unread' | 'today' | 'last24h'

interface MessageWithMeta {
  fromName?: string
  fromId?: string
  content: string
  chatId: string
  messageId: string
  chatType: string
  chatUsername?: string | null
}

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

      // 3. Generate summary with streaming
      const modeLabel = {
        unread: 'Unread Messages',
        today: 'Today\'s Messages',
        last24h: 'Last 24 Hours',
      }[mode]

      let accumulatedText = ''
      let lastUpdateTime = 0
      const UPDATE_INTERVAL = 500 // Update every 500ms

      await generateSummary(messages, llmConfig, async (delta) => {
        accumulatedText += delta
        const now = Date.now()

        // Update message periodically to show streaming progress
        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          lastUpdateTime = now
          const summaryText = `📊 **${modeLabel} Summary**\n\n${accumulatedText}\n\n---\n_Generating... (${messages.length} messages)_`

          try {
            await gramCtx.editMessageText(summaryText, { parse_mode: 'Markdown' })
          }
          catch (err) {
            // Ignore rate limit errors during streaming
            if (!(err instanceof Error) || !err.message.includes('Too Many Requests')) {
              throw err
            }
          }
        }
      })

      // 4. Final update with complete summary and source links
      const summaryWithLinks = addSourceLinks(accumulatedText, messages)
      const summaryText = `📊 **${modeLabel} Summary**\n\n${summaryWithLinks}\n\n---\n_Based on ${messages.length} message(s)_`

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
): Promise<MessageWithMeta[]> {
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

  // Get chat info for link generation
  const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, accountId)
  const chats = chatsResult.expect('Failed to get chats')
  const chatMap = new Map(chats.map(c => [c.chat_id, c]))

  // Map to format with metadata
  return allMessages.map((msg) => {
    const chat = chatMap.get(msg.in_chat_id)
    return {
      fromName: msg.from_name,
      fromId: msg.from_id,
      content: msg.content || '',
      chatId: msg.in_chat_id,
      messageId: msg.platform_message_id,
      chatType: chat?.chat_type || 'unknown',
      chatUsername: chat?.chat_username,
    }
  })
}

/**
 * Generate summary using xsai streaming
 */
async function generateSummary(
  messages: MessageWithMeta[],
  llmConfig: { apiKey: string, apiBase?: string, model?: string, temperature?: number, maxTokens?: number },
  onDelta: (delta: string) => void | Promise<void>,
): Promise<void> {
  const { streamText } = await import('xsai')

  // Build message content with reference markers
  const content = messages
    .map((m, idx) => {
      const name = m.fromName || (m.fromId ? `User ${m.fromId}` : 'Unknown')
      return `[${idx + 1}] ${name}: ${m.content}`
    })
    .join('\n')

  // Stream from LLM
  const { textStream } = streamText({
    baseURL: llmConfig.apiBase || 'https://api.openai.com/v1',
    model: llmConfig.model || 'gpt-4o-mini',
    apiKey: llmConfig.apiKey,
    messages: [
      {
        role: 'system',
        content: `You are a helpful assistant. Summarize the following Telegram messages concisely in Chinese.
Focus on key topics, important information, and main discussion points.
Each message has a reference number [n] at the beginning. When mentioning specific information, include the reference number in your summary like this: "某某讨论了新功能 [3]".
Format your summary as bullet points, each point should reference at least one source message.`,
      },
      {
        role: 'user',
        content,
      },
    ],
    temperature: llmConfig.temperature ?? 0.7,
    maxTokens: llmConfig.maxTokens ?? 2000,
  })

  const iterable = textStream as unknown as AsyncIterable<string>
  for await (const text of iterable) {
    await onDelta(text)
  }
}

/**
 * Replace reference markers [n] with clickable links
 */
function addSourceLinks(summaryText: string, messages: MessageWithMeta[]): string {
  // Replace [n] references with links where possible
  return summaryText.replace(/\[(\d+)\]/g, (match, num) => {
    const idx = Number.parseInt(num, 10) - 1
    if (idx < 0 || idx >= messages.length) {
      return match // Keep original if out of range
    }

    const msg = messages[idx]
    const linkResult = generateMessageLink(
      { chatId: msg.chatId, chatType: msg.chatType, chatUsername: msg.chatUsername },
      msg.messageId,
    )

    if (linkResult.url) {
      return `[→](${linkResult.url})`
    }
    return match // Keep original if no link available
  })
}
