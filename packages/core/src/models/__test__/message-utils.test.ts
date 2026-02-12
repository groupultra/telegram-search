import type { CoreRetrievalMessages } from '../../types'
import type { CoreMessage } from '../../types/message'
import type { DBRetrievalMessages } from '../utils/message'
import type { DBSelectMessage } from '../utils/types'

import { describe, expect, it } from 'vitest'

import {
  convertToCoreMessageFromDB,
  convertToCoreRetrievalMessages,
  convertToDBInsertMessage,
} from '../utils/message'

function buildDBSelectMessage(overrides: Partial<DBSelectMessage> = {}): DBSelectMessage {
  return {
    id: overrides.id ?? 'uuid-1',
    platform: overrides.platform ?? 'telegram',
    platform_message_id: overrides.platform_message_id ?? '1',
    from_id: overrides.from_id ?? 'from-1',
    from_name: overrides.from_name ?? 'From 1',
    from_user_uuid: overrides.from_user_uuid ?? null,
    owner_account_id: overrides.owner_account_id ?? null,
    in_chat_id: overrides.in_chat_id ?? 'chat-1',
    in_chat_type: overrides.in_chat_type ?? 'user',
    content: overrides.content ?? 'content',
    is_reply: overrides.is_reply ?? false,
    reply_to_name: overrides.reply_to_name ?? '',
    reply_to_id: overrides.reply_to_id ?? '',
    platform_timestamp: overrides.platform_timestamp ?? 1,
    content_vector_model: overrides.content_vector_model ?? '',
    created_at: overrides.created_at ?? 1,
    updated_at: overrides.updated_at ?? 1,
    deleted_at: overrides.deleted_at ?? 0,
    content_vector_1536: overrides.content_vector_1536 ?? null,
    content_vector_1024: overrides.content_vector_1024 ?? null,
    content_vector_768: overrides.content_vector_768 ?? null,
    jieba_tokens: overrides.jieba_tokens ?? [],
  }
}

function buildCoreMessage(overrides: Partial<CoreMessage> = {}): CoreMessage {
  return {
    uuid: overrides.uuid ?? 'uuid-1',
    platform: overrides.platform ?? 'telegram',
    platformMessageId: overrides.platformMessageId ?? '1',
    chatId: overrides.chatId ?? 'chat-1',
    fromId: overrides.fromId ?? 'from-1',
    fromName: overrides.fromName ?? 'From 1',
    content: overrides.content ?? 'content',
    reply: overrides.reply ?? { isReply: false, replyToId: undefined, replyToName: undefined },
    forward: overrides.forward ?? { isForward: false },
    platformTimestamp: overrides.platformTimestamp ?? 1,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    deletedAt: overrides.deletedAt,
    media: overrides.media,
    fromUserUuid: overrides.fromUserUuid,
  }
}

describe('models/utils/message', () => {
  describe('convertToCoreMessageFromDB', () => {
    it('maps DBSelectMessage to CoreMessage and preserves all key fields', () => {
      const dbMessage = buildDBSelectMessage({
        id: 'db-uuid',
        platform: 'telegram',
        platform_message_id: '42',
        in_chat_id: 'chat-42',
        from_id: 'from-42',
        from_name: 'From 42',
        from_user_uuid: 'user-uuid',
        content: 'hello world',
        is_reply: true,
        reply_to_id: '21',
        reply_to_name: 'Reply To',
        platform_timestamp: 123456,
        created_at: 111,
        updated_at: 222,
      })

      const core = convertToCoreMessageFromDB(dbMessage)

      expect(core.uuid).toBe('db-uuid')
      expect(core.platform).toBe('telegram')
      expect(core.platformMessageId).toBe('42')
      expect(core.chatId).toBe('chat-42')
      expect(core.fromId).toBe('from-42')
      expect(core.fromName).toBe('From 42')
      expect(core.fromUserUuid).toBe('user-uuid')
      expect(core.content).toBe('hello world')
      expect(core.reply.isReply).toBe(true)
      expect(core.reply.replyToId).toBe('21')
      expect(core.reply.replyToName).toBe('Reply To')
      expect(core.forward.isForward).toBe(false)
      expect(core.createdAt).toBe(111)
      expect(core.updatedAt).toBe(222)
      expect(core.platformTimestamp).toBe(123456)
    })

    it('normalizes nullable from_user_uuid to undefined on CoreMessage', () => {
      const dbMessage = buildDBSelectMessage({
        from_user_uuid: null,
      })

      const core = convertToCoreMessageFromDB(dbMessage)

      expect(core.fromUserUuid).toBeUndefined()
    })
  })

  describe('convertToDBInsertMessage', () => {
    it('builds minimal DBInsertMessage without id so database can generate primary key', () => {
      const ownerAccountId = 'owner-uuid'
      const core = buildCoreMessage({
        uuid: 'core-uuid',
        platformMessageId: '123',
        chatId: 'chat-1',
        fromId: 'from-1',
        fromName: 'From 1',
        content: 'some-content',
        reply: { isReply: false, replyToId: undefined, replyToName: undefined },
        platformTimestamp: 999,
      })

      const dbInsert = convertToDBInsertMessage(ownerAccountId, 'user', core)

      // Do not set id: DB should generate it via default.
      expect((dbInsert as { id?: unknown }).id).toBeUndefined()

      expect(dbInsert.platform).toBe(core.platform)
      expect(dbInsert.platform_message_id).toBe(core.platformMessageId)
      expect(dbInsert.in_chat_id).toBe(core.chatId)
      expect(dbInsert.in_chat_type).toBe('user')
      expect(dbInsert.from_id).toBe(core.fromId)
      expect(dbInsert.from_name).toBe(core.fromName)
      expect(dbInsert.content).toBe(core.content)
      expect(dbInsert.is_reply).toBe(false)
      expect(dbInsert.reply_to_id).toBeUndefined()
      expect(dbInsert.reply_to_name).toBeUndefined()
      expect(dbInsert.platform_timestamp).toBe(999)
      expect(dbInsert.owner_account_id).toBe(ownerAccountId)
    })

    it('omits owner_account_id when ownerAccountId is null or undefined', () => {
      const core = buildCoreMessage()

      const dbInsertNull = convertToDBInsertMessage(null, 'user', core)
      const dbInsertUndefined = convertToDBInsertMessage(undefined, 'user', core)

      expect((dbInsertNull as { owner_account_id?: unknown }).owner_account_id).toBeUndefined()
      expect((dbInsertUndefined as { owner_account_id?: unknown }).owner_account_id).toBeUndefined()
    })

    it('fills vector and jieba fields only when provided', () => {
      const coreWithVectors: CoreMessage = {
        ...buildCoreMessage(),
        vectors: {
          vector1536: [1, 2, 3],
          vector1024: [4, 5],
          vector768: [6],
        },
        jiebaTokens: ['a', 'b'],
      } as CoreMessage

      const dbInsert = convertToDBInsertMessage('owner-uuid', 'group', coreWithVectors as CoreMessage & {
        vectors: {
          vector1536: number[]
          vector1024: number[]
          vector768: number[]
        }
        jiebaTokens: string[]
      })

      expect(dbInsert.content_vector_1536).toEqual([1, 2, 3])
      expect(dbInsert.content_vector_1024).toEqual([4, 5])
      expect(dbInsert.content_vector_768).toEqual([6])
      expect(dbInsert.jieba_tokens).toEqual(['a', 'b'])
      expect(dbInsert.in_chat_type).toBe('group')
    })
  })

  describe('convertToCoreRetrievalMessages', () => {
    it('maps DBRetrievalMessages to CoreRetrievalMessages and preserves scoring fields', () => {
      const message: DBRetrievalMessages = {
        ...buildDBSelectMessage({
          id: 'uuid-ret',
          platform_message_id: '10',
          in_chat_id: 'chat-10',
          content: 'retrieval content',
        }),
        similarity: 0.9,
        time_relevance: 0.8,
        combined_score: 0.85,
        chat_name: 'Some Chat',
      }

      const coreMessages = convertToCoreRetrievalMessages([message])

      expect(coreMessages).toHaveLength(1)
      const [core] = coreMessages as CoreRetrievalMessages[]

      expect(core.uuid).toBe('uuid-ret')
      expect(core.platformMessageId).toBe('10')
      expect(core.chatId).toBe('chat-10')
      expect(core.content).toBe('retrieval content')
      expect(core.similarity).toBe(0.9)
      expect(core.timeRelevance).toBe(0.8)
      expect(core.combinedScore).toBe(0.85)
      expect(core.chatName).toBe('Some Chat')
    })
  })
})
