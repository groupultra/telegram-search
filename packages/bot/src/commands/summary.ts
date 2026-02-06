import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { InlineKeyboard } from 'grammy'
import { streamText } from 'xsai'

import { generateMessageLink } from '../utils/deep-link'
import { createChatPicker } from './chat-picker'

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

interface UserSummaryState {
  chatId: string
  chatName: string
}

const userStates = new Map<number, UserSummaryState>()

export function registerSummaryCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:summary')

  const picker = createChatPicker(bot, ctx, {
    prefix: 'M',
    folderHeader: '📊 Select chats to summarize:',
    chatListHeader: '📊 Select a chat to summarize:',
    allOptionLabel: '🌐 Summarize All Chats',
    onSelected: async (gramCtx, userId, chatId, chatName) => {
      userStates.set(userId, { chatId, chatName })

      const keyboard = new InlineKeyboard()
        .text('📬 Unread (7 days)', 'summode:unread')
        .row()
        .text('📅 Today', 'summode:today')
        .text('🕐 Last 24h', 'summode:last24h')
        .row()
        .text('🔙 Back', picker.backCallbackData)

      await gramCtx.editMessageText(
        `📊 Summarize: ${chatName}\n\nChoose time range:`,
        { reply_markup: keyboard },
      )
    },
    onReset: (userId) => {
      userStates.delete(userId)
    },
  })

  // /summary - kick off the picker flow
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
      await picker.showFolders(gramCtx, userId)
    }
    catch (error) {
      logger.withError(error).error('Summary command failed')
      await gramCtx.reply('An error occurred. Please try again later.')
    }
  })

  // Handle time range selection → generate summary
  bot.callbackQuery(/^summode:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const mode = gramCtx.callbackQuery.data.replace('summode:', '') as SummaryMode

    const account = await ctx.resolveAccountByTelegramUserId(userId)
    if (!account) {
      await gramCtx.answerCallbackQuery('Account not linked.')
      return
    }

    const state = userStates.get(userId)
    if (!state) {
      await gramCtx.answerCallbackQuery('Session expired. Please /summary again.')
      return
    }

    try {
      await gramCtx.answerCallbackQuery()
      await gramCtx.editMessageText('📝 Fetching messages...')

      const db = ctx.getDB()
      const chatId = state.chatId === '__ALL__' ? undefined : state.chatId
      const messages = await fetchMessagesForSummary(ctx, account.id, mode, chatId)

      if (messages.length === 0) {
        await gramCtx.editMessageText(`No ${mode} messages to summarize in ${state.chatName}.`)
        return
      }

      // Get LLM config
      const accountResult = await ctx.models.accountModels.findAccountByUUID(db, account.id)
      const accountData = accountResult.expect('Account not found')
      const llmConfig = accountData.settings?.llm

      if (!llmConfig?.apiKey) {
        await gramCtx.editMessageText(
          '⚠️ Please configure your OpenAI API key in the web interface first.\n\nGo to Settings → LLM Configuration',
        )
        return
      }

      const modeLabel = {
        unread: 'Unread Messages',
        today: 'Today\'s Messages',
        last24h: 'Last 24 Hours',
      }[mode]

      // Stream summary generation
      let accumulatedText = ''
      let lastUpdateTime = 0
      const UPDATE_INTERVAL = 500

      await generateSummary(messages, llmConfig, async (delta) => {
        accumulatedText += delta
        const now = Date.now()

        if (now - lastUpdateTime > UPDATE_INTERVAL) {
          lastUpdateTime = now
          try {
            const safeChatName = escapeMarkdown(state.chatName)
            const safeProgressText = escapeMarkdown(accumulatedText)
            await gramCtx.editMessageText(
              `📊 **${safeChatName} - ${modeLabel}**\n\n${safeProgressText}\n\n---\n_Generating... (${messages.length} messages)_`,
              { parse_mode: 'Markdown' },
            )
          }
          catch (err) {
            // Ignore Telegram rate limit during streaming
            if (!(err instanceof Error) || !err.message.includes('Too Many Requests'))
              throw err
          }
        }
      })

      // Final update with source links
      const summaryWithLinks = addSourceLinks(accumulatedText, messages)
      const safeChatName = escapeMarkdown(state.chatName)
      await gramCtx.editMessageText(
        `📊 **${safeChatName} - ${modeLabel}**\n\n${summaryWithLinks}\n\n---\n_Based on ${messages.length} message(s)_`,
        { parse_mode: 'Markdown' },
      )

      userStates.delete(userId)
      picker.clearState(userId)
    }
    catch (error) {
      logger.withError(error).error('Summary generation failed')
      await gramCtx.reply('❌ An error occurred while generating summary. Please try again later.')
    }
  })
}

/**
 * Fetch messages for the given time range and optional chat filter
 */
async function fetchMessagesForSummary(
  ctx: BotCommandContext,
  accountId: string,
  mode: SummaryMode,
  chatId?: string,
): Promise<MessageWithMeta[]> {
  const db = ctx.getDB()
  const now = Math.floor(Date.now() / 1000)

  let startTime: number
  switch (mode) {
    case 'unread':
      startTime = now - 7 * 24 * 60 * 60
      break
    case 'today': {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      startTime = Math.floor(todayStart.getTime() / 1000)
      break
    }
    case 'last24h':
      startTime = now - 24 * 60 * 60
      break
  }

  const chatIds = chatId ? [chatId] : undefined

  const result = await ctx.models.chatMessageModels.fetchMessagesByTimeRange(
    db,
    accountId,
    { start: startTime, end: now },
    chatIds,
    { limit: 1000, offset: 0 },
  )

  const allMessages = result.expect('Failed to fetch messages')

  // Build chat lookup for link generation
  const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, accountId)
  const chats = chatsResult.expect('Failed to get chats')
  const chatMap = new Map(chats.map(c => [c.chat_id, c]))

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
 * Stream LLM summary generation
 */
async function generateSummary(
  messages: MessageWithMeta[],
  llmConfig: { apiKey: string, apiBase?: string, model?: string, temperature?: number, maxTokens?: number },
  onDelta: (delta: string) => void | Promise<void>,
): Promise<void> {
  const content = messages
    .map((m, idx) => {
      const name = m.fromName || (m.fromId ? `User ${m.fromId}` : 'Unknown')
      return `[${idx + 1}] ${name}: ${m.content}`
    })
    .join('\n')

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
      { role: 'user', content },
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
 * Replace [n] reference markers with clickable deep links
 */
function addSourceLinks(summaryText: string, messages: MessageWithMeta[]): string {
  const refToken = 'REFMARKER'
  const withTokens = summaryText.replace(/\[(\d+)\]/g, (_match, num) => `${refToken}${num}${refToken}`)
  const escaped = escapeMarkdown(withTokens)

  return escaped.replace(new RegExp(`${refToken}(\\d+)${refToken}`, 'g'), (match, num) => {
    const idx = Number.parseInt(num, 10) - 1
    if (idx < 0 || idx >= messages.length)
      return match

    const msg = messages[idx]
    const linkResult = generateMessageLink(
      { chatId: msg.chatId, chatType: msg.chatType, chatUsername: msg.chatUsername },
      msg.messageId,
    )

    return linkResult.url ? `[→](${linkResult.url})` : match
  })
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()])/g, '\\$1')
}
