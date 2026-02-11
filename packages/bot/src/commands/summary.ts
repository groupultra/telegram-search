import type { CoreContext, CoreMessage } from '@tg-search/core'
import type { Bot } from 'grammy'

import type { BotCommandContext } from '.'

import { randomUUID } from 'node:crypto'

import { CoreEventType } from '@tg-search/core'
import { InlineKeyboard } from 'grammy'
import { streamText } from 'xsai'

import { generateMessageLink } from '../utils/deep-link'
import { createChatPicker } from './chat-picker'
import { buildPaginationButtons, paginateItems, splitTextToPages } from './helpers'

type SummaryMode = 'unread' | 'today' | 'last24h'
const SUMMARY_PAGE_SIZE = 3500

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

interface SummaryState {
  pages: string[]
}

const userStates = new Map<number, UserSummaryState>()
const summaryStates = new Map<number, SummaryState>()

export function registerSummaryCommand(bot: Bot, ctx: BotCommandContext) {
  const logger = ctx.logger.withContext('bot:command:summary')

  const picker = createChatPicker(bot, ctx, {
    prefix: 'M',
    folderHeader: '📊 Select chats to summarize:',
    chatListHeader: '📊 Select a chat to summarize:',
    allOptionLabel: '🌐 Summarize All Chats',
    onSelected: async (gramCtx, userId, chatId, chatName) => {
      if (chatId === '__ALL__') {
        await gramCtx.reply('⚠️ Direct summary only supports a single chat. Please select one.')
        await picker.showFolders(gramCtx, userId, true)
        return
      }

      userStates.set(userId, { chatId, chatName })

      const keyboard = new InlineKeyboard()
        .text('📬 Unread', 'summode:unread')
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
      summaryStates.delete(userId)
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
      summaryStates.delete(userId)
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
      const summaryText = `📊 **${safeChatName} - ${modeLabel}**\n\n${summaryWithLinks}\n\n---\n_Based on ${messages.length} message(s)_`
      const pages = splitTextToPages(summaryText, SUMMARY_PAGE_SIZE)

      if (pages.length <= 1) {
        summaryStates.delete(userId)
        await gramCtx.editMessageText(summaryText, { parse_mode: 'Markdown' })
      }
      else {
        summaryStates.set(userId, { pages })
        const { pageItems, totalPages, page: safePage } = paginateItems(pages, 0, 1)
        const keyboard = new InlineKeyboard()
        const navButtons = buildPaginationButtons({
          page: safePage,
          hasMore: safePage < totalPages - 1,
          prefix: 'summarypage:',
          labels: { prev: '⬅️ Prev Page', next: '➡️ Next Page' },
        })

        if (navButtons.length > 0) {
          keyboard.row(...navButtons)
        }

        const pageText = pageItems[0] || ''
        await gramCtx.editMessageText(
          `${pageText}\n\n(Page ${safePage + 1}/${totalPages})`,
          { parse_mode: 'Markdown', reply_markup: keyboard },
        )
      }

      userStates.delete(userId)
      picker.clearState(userId)
    }
    catch (error) {
      logger.withError(error).error('Summary generation failed')
      const message = error instanceof Error ? error.message : 'An error occurred while generating summary.'
      await gramCtx.reply(`❌ ${message} Please try again later.`)
    }
  })

  // Handle summary pagination
  bot.callbackQuery(/^summarypage:/, async (gramCtx) => {
    const userId = gramCtx.from.id
    const page = Number.parseInt(gramCtx.callbackQuery.data.replace('summarypage:', ''), 10)

    const state = summaryStates.get(userId)
    if (!state) {
      await gramCtx.answerCallbackQuery('Session expired. Please /summary again.')
      return
    }

    const { pageItems, totalPages, page: safePage } = paginateItems(state.pages, page, 1)
    const keyboard = new InlineKeyboard()
    const navButtons = buildPaginationButtons({
      page: safePage,
      hasMore: safePage < totalPages - 1,
      prefix: 'summarypage:',
      labels: { prev: '⬅️ Prev Page', next: '➡️ Next Page' },
    })

    if (navButtons.length > 0) {
      keyboard.row(...navButtons)
    }

    await gramCtx.answerCallbackQuery()
    await gramCtx.editMessageText(
      `${pageItems[0] || ''}\n\n(Page ${safePage + 1}/${totalPages})`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    )
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
  if (!chatId) {
    throw new Error('Direct summary only supports a single chat')
  }

  const coreCtx = ctx.getAccountContext(accountId)
  if (!coreCtx) {
    throw new Error('Account session not ready. Please log in via the web interface first.')
  }

  const requestId = randomUUID()
  const summaryMessages = await waitForSummaryData(coreCtx, { chatId, mode, requestId })

  const db = ctx.getDB()
  const chatsResult = await ctx.models.chatModels.fetchChatsByAccountId(db, accountId)
  const chats = chatsResult.expect('Failed to get chats')
  const chatMap = new Map(chats.map(c => [c.chat_id, c]))

  return summaryMessages.map((msg) => {
    const chat = chatMap.get(msg.chatId)
    return {
      fromName: msg.fromName,
      fromId: msg.fromId,
      content: msg.content || '',
      chatId: msg.chatId,
      messageId: msg.platformMessageId,
      chatType: chat?.chat_type || 'unknown',
      chatUsername: chat?.chat_username,
    }
  })
}

const SUMMARY_FETCH_TIMEOUT_MS = 60_000

async function waitForSummaryData(
  coreCtx: CoreContext,
  request: { chatId: string, mode: SummaryMode, requestId: string },
): Promise<CoreMessage[]> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const cleanup = (listener: (data: { messages: CoreMessage[], mode: SummaryMode, requestId?: string }) => void) => {
      if (settled) {
        return
      }
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      coreCtx.emitter.off(CoreEventType.MessageSummaryData, listener)
    }

    const onSummary = (data: { messages: CoreMessage[], mode: SummaryMode, requestId?: string }) => {
      if (data.requestId !== request.requestId) {
        return
      }
      cleanup(onSummary)
      resolve(data.messages)
    }

    timeoutId = setTimeout(() => {
      cleanup(onSummary)
      reject(new Error('Summary request timed out.'))
    }, SUMMARY_FETCH_TIMEOUT_MS)

    coreCtx.emitter.on(CoreEventType.MessageSummaryData, onSummary)
    coreCtx.emitter.emit(CoreEventType.MessageFetchSummary, {
      chatId: request.chatId,
      mode: request.mode,
      limit: 1000,
      requestId: request.requestId,
    })
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
