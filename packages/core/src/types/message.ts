import type { CoreMessageMediaFromServer } from './media'

export interface CoreMessage {
  uuid: string

  platform: 'telegram'
  platformMessageId: string
  chatId: string

  fromId: string
  fromName: string
  fromUserUuid?: string

  content: string
  media?: CoreMessageMediaFromServer[]

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
}

export interface CoreMessageVector {
  vector1536?: number[]
  vector1024?: number[]
  vector768?: number[]
}
