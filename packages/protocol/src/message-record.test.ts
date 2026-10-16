import { parse } from 'valibot'
import { describe, expect, it } from 'vitest'

import { remoteMethods } from './remote'

describe('message facts across remote transport', () => {
  it('requires an explicit source and bounds point reads', () => {
    const schema = remoteMethods['messages.get'].input
    expect(() => parse(schema, { chatId: '42', messageIds: ['1'] })).toThrow()
    expect(() => parse(schema, { source: 'local', chatId: '42', messageIds: Array.from({ length: 101 }, (_, index) => String(index + 1)) })).toThrow()
    expect(() => parse(schema, { source: 'telegram', chatId: '42', messageIds: ['0'] })).toThrow()
  })

  it('validates source-specific cursors, windows and integral budgets', () => {
    expect(() => parse(remoteMethods['messages.read'].input, { source: 'telegram', chatId: '42', cursor: '0' })).toThrow()
    expect(() => parse(remoteMethods['messages.read'].input, { source: 'local', chatId: '42', cursor: '0' })).not.toThrow()
    expect(() => parse(remoteMethods['messages.read'].input, { source: 'local', chatId: '42', from: 20, to: 10 })).toThrow()
    expect(() => parse(remoteMethods['messages.replies'].input, { source: 'local', chatId: '42', messageIds: ['1'], maxDepth: 0.5 })).toThrow()
  })

  it('preserves reply, topic, quote, album and forward facts instead of stripping them', () => {
    // Issue #682: a duplicate remote schema silently stripped new relationship metadata.
    const record = {
      id: '4',
      chatId: '42',
      senderId: '8',
      senderName: 'Sender',
      timestamp: 10,
      text: 'reply',
      replyToId: '2',
      replyToChatId: '43',
      replyToTopId: '1',
      forumTopic: true,
      quote: { text: 'quoted excerpt', offset: 3, manual: true },
      groupedId: '99',
      forward: { isForward: true, fromSenderId: '9', fromName: 'Origin', date: 9 },
      media: [],
      links: [],
    }
    const result = parse(remoteMethods['messages.list'].output, { items: [record], nextCursor: null })
    expect(result.items).toEqual([record])
  })
})
