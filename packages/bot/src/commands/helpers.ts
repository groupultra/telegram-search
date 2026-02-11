import type { CoreDB } from '@tg-search/core'

import { models } from '@tg-search/core'

export interface ChatOption {
  id: string
  name: string
  type: string
  folderIds?: number[]
}

export interface PaginationResult<T> {
  pageItems: T[]
  page: number
  totalPages: number
  startIndex: number
  endIndex: number
}

export interface PaginationButtonLabels {
  prev?: string
  next?: string
}

export interface PaginationButtonOptions {
  page: number
  hasMore: boolean
  prefix: string
  labels?: PaginationButtonLabels
}

export interface TelegramMessageLinkOptions {
  chatId: string
  messageId: string
  chatType?: string | null
}

/**
 * Get list of chats for an account (for inline keyboard options)
 */
export async function getAccountChats(db: CoreDB, accountId: string): Promise<ChatOption[]> {
  const result = await models.chatModels.fetchChatsByAccountId(db, accountId)
  const chats = result.expect('Failed to get chats')

  return chats.map(chat => ({
    id: chat.chat_id,
    name: chat.chat_name || chat.chat_id,
    type: chat.chat_type || 'unknown',
    folderIds: chat.folder_ids || [],
  }))
}

/**
 * Remove control characters and lone surrogates from text
 */
export function sanitizeText(text: string): string {
  return text
    // eslint-disable-next-line sonarjs/no-control-regex, no-control-regex
    .replace(/[\u0000-\u0008\v\f\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .trim()
}

/**
 * Map chat type to display icon
 */
export function getChatTypeIcon(type: string): string {
  switch (type) {
    case 'group':
    case 'supergroup':
      return '👥'
    case 'channel':
      return '📢'
    default:
      return '💬'
  }
}

export function paginateItems<T>(items: T[], page: number, perPage: number): PaginationResult<T> {
  const safePerPage = Math.max(1, Math.floor(perPage))
  const totalPages = Math.max(1, Math.ceil(items.length / safePerPage))
  const safePage = Math.min(Math.max(0, page), totalPages - 1)
  const startIndex = safePage * safePerPage
  const endIndex = Math.min(items.length, startIndex + safePerPage)
  return {
    pageItems: items.slice(startIndex, endIndex),
    page: safePage,
    totalPages,
    startIndex,
    endIndex,
  }
}

export function buildPaginationButtons(options: PaginationButtonOptions): Array<{ text: string, callback_data: string }> {
  const labels = options.labels || {}
  const buttons: Array<{ text: string, callback_data: string }> = []
  if (options.page > 0) {
    buttons.push({
      text: labels.prev || '⬅️ Prev',
      callback_data: `${options.prefix}${options.page - 1}`,
    })
  }
  if (options.hasMore) {
    buttons.push({
      text: labels.next || '➡️ Next',
      callback_data: `${options.prefix}${options.page + 1}`,
    })
  }
  return buttons
}

export function buildTelegramMessageLinks(options: TelegramMessageLinkOptions): string[] {
  const links: string[] = []
  const chatType = options.chatType || 'unknown'
  const chatId = options.chatId
  const messageId = options.messageId

  if (chatType === 'group' || chatType === 'supergroup' || chatType === 'channel') {
    links.push(`https://t.me/c/${chatId}/${messageId}`)
    links.push(`tg://privatepost?channel=${chatId}&post=${messageId}`)
  }
  else if (chatType === 'user' || chatType === 'bot') {
    links.push(`tg://user?id=${chatId}`)
  }

  return links
}

export function splitTextToPages(text: string, pageSize: number): string[] {
  const safeSize = Math.max(1, Math.floor(pageSize))
  const pages: string[] = []
  for (let i = 0; i < text.length; i += safeSize) {
    pages.push(text.slice(i, i + safeSize))
  }
  return pages.length ? pages : ['']
}
