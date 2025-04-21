import { Api } from 'telegram'

export interface CoreMessage {
  uuid: string

  platform: string // Telegram
  platformMessageId: string
  chatId: string

  fromId: string
  fromName: string

  content: string

  reply: CoreMessageReply
  forward: CoreMessageForward
  vectors: CoreMessageVector

  createdAt: number
  updatedAt: number
  deletedAt?: number
}

// export interface CoreMessageMedia {
//   type: 'photo' | 'sticker' | 'file' | 'other'
//   uuid:
// }

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

export function convertToCoreMessage(message: Api.Message): CoreMessage {
  // Get sender info
  let fromId = ''
  const fromName = '' // TODO: user resolver
  if (message.fromId instanceof Api.PeerUser) {
    fromId = message.fromId.userId.toString()
    // Note: fromName will need to be resolved separately since it requires async user lookup
  }

  // Get forward info
  const forward: CoreMessageForward = {
    isForward: !!message.fwdFrom,
    forwardFromChatId: message.fwdFrom?.fromId instanceof Api.PeerChannel
      ? message.fwdFrom.fromId.channelId.toString()
      : undefined,
    forwardFromChatName: undefined, // Needs async channel lookup
    forwardFromMessageId: message.fwdFrom?.channelPost?.toString(),
  }

  // Get reply info
  const reply: CoreMessageReply = {
    isReply: !!message.replyTo,
    replyToId: message.replyTo?.replyToMsgId?.toString(),
    replyToName: undefined, // Needs async user lookup
  }

  // Get vectors info
  const vectors: CoreMessageVector = {
    vector1536: [],
    vector1024: [],
    vector768: [],
  }

  return {
    uuid: crypto.randomUUID(),
    platform: 'telegram',
    platformMessageId: message.id.toString(),
    chatId: message.peerId.toString(),
    fromId,
    fromName,
    content: message.message || '',
    reply,
    forward,
    vectors,
    createdAt: message.date * 1000,
    updatedAt: Date.now(),
  }
}
