import type { MessageRecord } from '@tg-search/protocol'

import type { CoreMessageMedia } from './media'

export interface CoreMessage {
  uuid: string

  platform: 'telegram'
  platformMessageId: string
  chatId: string

  fromId: string
  fromName: string
  fromUserUuid?: string

  content: string
  media?: CoreMessageMedia[]
  links?: CoreMessageLink[]

  telegramMetadata?: Pick<MessageRecord, 'replyToChatId' | 'replyToTopId' | 'forumTopic' | 'quote' | 'groupedId' | 'editedAt'>

  reply: CoreMessageReply
  forward: CoreMessageForward

  platformTimestamp: number
  createdAt?: number
  updatedAt?: number
  deletedAt?: number
}

export type ProcessedCoreMessage = CoreMessage & {
  vectors?: CoreMessageVector
  jiebaTokens?: string[]
}

export interface CoreMessageReply {
  isReply: boolean
  replyToId?: string
  replyToName?: string
}

export interface CoreMessageForward {
  isForward: boolean
  forwardFromChatId?: string
  forwardFromChatName?: string
  forwardFromMessageId?: string
  fromSenderId?: string
  fromName?: string
  date?: number
  postAuthor?: string
}

export interface CoreMessageLink {
  url: string
  title?: string
}

export interface CoreMessageVector {
  model?: string
  vector1536?: number[]
  vector1024?: number[]
  vector768?: number[]
}
