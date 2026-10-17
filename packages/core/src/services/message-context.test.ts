import type { GetMessagesInput, GetMessagesResult, MessageRecord } from '@tg-search/protocol'

import { describe, expect, it, vi } from 'vitest'

import { createReplyContextService, createWindowReadService } from './message-context'

function message(id: string, replyToId?: string, chatId = '42'): MessageRecord {
  return { id, chatId, senderId: '8', senderName: 'Sender', timestamp: Number(id), text: id, replyToId, forward: { isForward: false }, media: [], links: [] }
}

function lookup(records: MessageRecord[]) {
  return vi.fn(async (input: GetMessagesInput): Promise<GetMessagesResult> => ({ source: input.source, items: records.filter(record => record.chatId === input.chatId && input.messageIds.includes(record.id)), missingIds: input.messageIds.filter(id => !records.some(record => record.chatId === input.chatId && record.id === id)) }))
}

describe('reply context coverage', () => {
  it('expands one reply level and reports depth stops separately from unavailable targets', async () => {
    const get = lookup([message('4', '2'), message('2', '1'), message('5', '99')])
    const result = await createReplyContextService(get)({ source: 'local', chatId: '42', messageIds: ['4', '5'], maxDepth: 1, maxNodes: 100 })
    expect(result.items.map(item => item.id)).toEqual(['4', '5', '2'])
    expect(result.links.map(link => [link.from.messageId, link.to.messageId, link.status])).toEqual([['4', '2', 'resolved'], ['5', '99', 'missing'], ['2', '1', 'depth_budget']])
    expect(result.coverage).toMatchObject({ complete: false, resolvedReplies: 1, missingReplies: 1, depthStopped: 1 })
  })

  it('does not turn zero-depth or cross-chat references into missing messages', async () => {
    const get = lookup([{ ...message('4', '2'), replyToChatId: '43' }])
    const result = await createReplyContextService(get)({ source: 'telegram', chatId: '42', messageIds: ['4'], maxDepth: 1, maxNodes: 10 })
    expect(result.links).toMatchObject([{ status: 'not_requested', reason: 'cross_chat' }])
    expect(get).toHaveBeenCalledTimes(1)
    const zero = await createReplyContextService(lookup([message('4', '2')]))({ source: 'local', chatId: '42', messageIds: ['4'], maxDepth: 0, maxNodes: 10 })
    expect(zero.links).toMatchObject([{ status: 'not_requested', reason: 'depth_zero' }])
  })

  it('bounds point reads by node budget and stops cycles without repeated requests', async () => {
    const get = lookup([message('4', '2'), message('2', '4')])
    const result = await createReplyContextService(get)({ source: 'local', chatId: '42', messageIds: ['4'], maxDepth: 10, maxNodes: 10 })
    expect(result.links.map(link => link.status)).toEqual(['resolved', 'cycle'])
    expect(get).toHaveBeenCalledTimes(2)
    const budget = await createReplyContextService(lookup([message('4', '2')]))({ source: 'local', chatId: '42', messageIds: ['4'], maxDepth: 2, maxNodes: 1 })
    expect(budget.links).toMatchObject([{ status: 'node_budget' }])
  })
})

describe('budgeted window reads', () => {
  it('continues past empty pages, reports exhaustion only after the cursor ends', async () => {
    const page = vi.fn().mockResolvedValueOnce({ items: [], nextCursor: '3' }).mockResolvedValueOnce({ items: [message('2')], nextCursor: null })
    const result = await createWindowReadService(page)({ source: 'telegram', chatId: '42', pageSize: 100, maxPages: 3, maxMessages: 100 })
    expect(result).toMatchObject({ source: 'telegram', stopReason: 'exhausted', pagesRead: 2, nextCursor: null, window: {} })
    expect(result.items.map(item => item.id)).toEqual(['2'])
    expect(result.coverage).toMatchObject({ windowExhausted: true, replyContext: 'not_requested', mediaContent: 'not_requested' })
  })

  it('keeps a resumable cursor at message and page limits without claiming complete context', async () => {
    const page = vi.fn(async (input: { limit: number }) => ({ items: [message('5'), message('4')].slice(0, input.limit), nextCursor: '4' }))
    const result = await createWindowReadService(page)({ source: 'telegram', chatId: '42', pageSize: 100, maxPages: 10, maxMessages: 2 })
    expect(page.mock.calls[0][0].limit).toBe(2)
    expect(result).toMatchObject({ stopReason: 'message_budget', nextCursor: '4', pagesRead: 1, coverage: { windowExhausted: false } })
    const pages = await createWindowReadService(page)({ source: 'local', chatId: '42', pageSize: 2, maxPages: 1, maxMessages: 10 })
    expect(pages.stopReason).toBe('page_budget')
  })

  it('reports a nonadvancing cursor and deduplicates identities by chat and message', async () => {
    const page = vi.fn(async () => ({ items: [message('2')], nextCursor: '2' }))
    const result = await createWindowReadService(page)({ source: 'telegram', chatId: '42', cursor: '2', pageSize: 100, maxPages: 10, maxMessages: 100 })
    expect(result.stopReason).toBe('cursor_stalled')
    expect(page).toHaveBeenCalledTimes(1)
  })
})
