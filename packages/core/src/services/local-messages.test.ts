import type { Logger } from '@guiiai/logg'

import type { CoreDB } from '../db'
import type { Models } from '../models'
import type { DBSelectMessage } from '../models/utils/types'

import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { createLocalMessagesService } from './local-messages'

function message(overrides: Partial<DBSelectMessage> = {}): DBSelectMessage {
  return {
    id: overrides.id ?? 'uuid-1',
    platform: overrides.platform ?? 'telegram',
    platform_message_id: overrides.platform_message_id ?? '1',
    from_id: overrides.from_id ?? 'sender-1',
    from_name: overrides.from_name ?? 'Sender 1',
    from_user_uuid: overrides.from_user_uuid ?? null,
    owner_account_id: overrides.owner_account_id ?? null,
    in_chat_id: overrides.in_chat_id ?? 'chat-1',
    in_chat_type: overrides.in_chat_type ?? 'group',
    content: overrides.content ?? 'message',
    is_reply: overrides.is_reply ?? false,
    reply_to_name: overrides.reply_to_name ?? '',
    reply_to_id: overrides.reply_to_id ?? '',
    forward: overrides.forward ?? { isForward: false },
    media: overrides.media ?? [],
    links: overrides.links ?? [],
    platform_timestamp: overrides.platform_timestamp ?? 1,
    created_at: overrides.created_at ?? 1,
    updated_at: overrides.updated_at ?? 1,
    deleted_at: overrides.deleted_at ?? 0,
    content_vector_model: overrides.content_vector_model ?? '',
    content_vector_1536: overrides.content_vector_1536 ?? null,
    content_vector_1024: overrides.content_vector_1024 ?? null,
    content_vector_768: overrides.content_vector_768 ?? null,
    jieba_tokens: overrides.jieba_tokens ?? [],
  }
}

describe('local message query filters', () => {
  it('passes the requested sender to the database query', async () => {
    // The CLI exposed --sender, but the service previously discarded it.
    const fetchMessagesByTimeRange = vi.fn(async (_db: CoreDB, _accountId: string) => Ok([]))
    const service = createLocalMessagesService({
      db: {} as CoreDB,
      getAccountId: () => 'account-1',
      logger: {} as Logger,
      models: { chatMessageModels: { fetchMessagesByTimeRange } } as unknown as Models,
    })

    await service.query({
      chatIds: ['chat-1'],
      fromUserId: 'user-1',
      from: 10,
      to: 20,
      limit: 100,
    })

    expect(fetchMessagesByTimeRange).toHaveBeenCalledWith(
      expect.anything(),
      'account-1',
      { start: 10, end: 20 },
      ['chat-1'],
      { offset: 0, limit: 101 },
      'user-1',
    )
  })

  it('embeds one-level reply context and marks unavailable targets for export', async () => {
    // Export previously emitted only replyToId, forcing Agents to reconstruct
    // conversations with a second pass over the entire archive.
    const reply = message({
      id: 'uuid-reply',
      platform_message_id: '2',
      content: 'Reply body',
      is_reply: true,
      reply_to_id: '1',
      platform_timestamp: 20,
    })
    const unresolvedReply = message({
      id: 'uuid-unresolved',
      platform_message_id: '3',
      content: 'Reply to missing target',
      is_reply: true,
      reply_to_id: '99',
      platform_timestamp: 30,
    })
    const target = message({
      id: 'uuid-target',
      platform_message_id: '1',
      from_id: 'original-sender',
      from_name: 'Original Sender',
      content: 'Original body',
      platform_timestamp: 5,
    })
    const fetchMessagesByTimeRange = vi.fn(async () => Ok([reply, unresolvedReply]))
    const fetchMessagesByChatAndPlatformIds = vi.fn(async () => Ok([target]))
    const service = createLocalMessagesService({
      db: {} as CoreDB,
      getAccountId: () => 'account-1',
      logger: {} as Logger,
      models: {
        chatMessageModels: {
          fetchMessagesByChatAndPlatformIds,
          fetchMessagesByTimeRange,
        },
      } as unknown as Models,
    })

    const page = await service.queryForExport({ chatIds: ['chat-1'], from: 10, to: 40, limit: 100 })

    expect(fetchMessagesByChatAndPlatformIds).toHaveBeenCalledWith(
      expect.anything(),
      'account-1',
      [
        { chatId: 'chat-1', messageId: '1' },
        { chatId: 'chat-1', messageId: '99' },
      ],
    )
    expect(page.items[0]).toMatchObject({
      id: '2',
      replyToId: '1',
      replyTo: {
        id: '1',
        senderId: 'original-sender',
        senderName: 'Original Sender',
        timestamp: 5,
        text: 'Original body',
      },
    })
    expect(page.items[1]).toMatchObject({ id: '3', replyToId: '99', replyTo: null })
  })

  it('resolves the active account for every query', async () => {
    // Daemons learn the real account after their application runtime is created.
    const fetchMessagesByTimeRange = vi.fn(async (_db: CoreDB, _accountId: string) => Ok([]))
    let accountId = 'profile-placeholder'
    const service = createLocalMessagesService({
      db: {} as CoreDB,
      getAccountId: () => accountId,
      logger: {} as Logger,
      models: { chatMessageModels: { fetchMessagesByTimeRange } } as unknown as Models,
    })

    await service.query({ limit: 1 })
    accountId = 'resolved-account'
    await service.query({ limit: 1 })

    expect(fetchMessagesByTimeRange.mock.calls.map(call => call[1])).toEqual([
      'profile-placeholder',
      'resolved-account',
    ])
  })
})
