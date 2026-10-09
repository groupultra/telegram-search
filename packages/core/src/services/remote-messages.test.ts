import type { TelegramClient } from 'telegram'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { createRemoteMessagesService } from './remote-messages'

const inputPeer = new Api.InputPeerChannel({ channelId: bigInt(42), accessHash: bigInt(99) })
const peerId = new Api.PeerChannel({ channelId: bigInt(42) })

function textMessage(id: number, date = id): Api.Message {
  return new Api.Message({ id, peerId, fromId: new Api.PeerUser({ userId: bigInt(8) }), date, message: `message ${id}` })
}

function serviceMessage(id: number, date = id): Api.MessageService {
  return new Api.MessageService({ id, peerId, date, action: new Api.MessageActionPinMessage() })
}

interface HistoryRequest {
  limit: number
  offsetId: number
  offsetDate?: number
  minId?: number
}

/** Serves one Telegram-sized chunk per call, newest first, the way GetHistory answers a single request. */
function createHistory(messages: (Api.Message | Api.MessageService)[]) {
  const newestFirst = [...messages].sort((a, b) => b.id - a.id)
  const getMessages = vi.fn(async (_peer: unknown, request: HistoryRequest) => {
    const chunk = newestFirst
      .filter(message => request.offsetId === 0 || message.id < request.offsetId)
      .filter(message => request.offsetDate === undefined || message.date < request.offsetDate)
      .filter(message => request.minId === undefined || message.id > request.minId)
      .slice(0, Math.min(request.limit, 100))
    return Object.assign(chunk, { total: newestFirst.length })
  })
  const listRemoteMessages = createRemoteMessagesService(
    { getMessages } as unknown as TelegramClient,
    async () => inputPeer,
  )

  async function readAll(input: Omit<Parameters<typeof listRemoteMessages>[0], 'cursor'>) {
    const ids: number[] = []
    let cursor: string | undefined
    do {
      const page = await listRemoteMessages({ ...input, cursor })
      ids.push(...page.items.map(item => Number(item.id)))
      cursor = page.nextCursor ?? undefined
    } while (cursor !== undefined)
    return ids
  }

  return { getMessages, listRemoteMessages, readAll }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index)
}

describe('remote messages', () => {
  it('keeps paging when a full page contains messages that produce no record', async () => {
    // Regression: hasMore was computed after service messages were dropped, so one
    // pinned-message notice inside a page ended pagination with messages still unread.
    const history = createHistory(range(1, 300).map(id => id % 50 === 0 ? serviceMessage(id) : textMessage(id)))

    const firstPage = await history.listRemoteMessages({ chatId: '42', limit: 100 })
    const ids = await history.readAll({ chatId: '42', limit: 100 })

    expect(firstPage.nextCursor).not.toBeNull()
    expect(ids).toEqual(range(1, 300).filter(id => id % 50 !== 0).reverse())
  })

  it('reads every message once when pages span several Telegram chunks', async () => {
    // Regression: the cursor was an addOffset, which GramJS reapplies to every
    // 100-message chunk, so the second 1000-message page skipped most of its range.
    const history = createHistory(range(1, 2196).map(id => textMessage(id)))

    const ids = await history.readAll({ chatId: '42', limit: 1000 })

    expect(ids).toEqual(range(1, 2196).reverse())
    expect(history.getMessages.mock.calls.every(([, request]) => request.limit <= 100)).toBe(true)
  })

  it('stops at the inclusive time window without reading older history', async () => {
    const history = createHistory(range(1, 500).map(id => textMessage(id)))

    const page = await history.listRemoteMessages({ chatId: '42', limit: 1000, from: 450, to: 460 })

    expect(page.items.map(item => Number(item.id))).toEqual(range(450, 460).reverse())
    expect(page.nextCursor).toBeNull()
    expect(history.getMessages).toHaveBeenCalledTimes(1)
    expect(history.getMessages.mock.calls[0][1]).toMatchObject({ offsetId: 0, offsetDate: 461 })
  })

  it('returns an honest cursor instead of scanning a whole chat for one page', async () => {
    const history = createHistory([
      textMessage(1),
      ...range(2, 1000).map(id => serviceMessage(id)),
    ])

    const firstPage = await history.listRemoteMessages({ chatId: '42', limit: 100 })
    const ids = await history.readAll({ chatId: '42', limit: 100 })

    expect(firstPage.items).toEqual([])
    expect(firstPage.nextCursor).toBe('701')
    expect(ids).toEqual([1])
  })

  it('searches and filters on Telegram and anchors newer reads', async () => {
    const history = createHistory(range(1, 10).map(id => textMessage(id)))

    const page = await history.listRemoteMessages({
      chatId: '42',
      limit: 100,
      query: 'release',
      fromUserId: 'me',
      minMessageId: 7,
    })

    expect(history.getMessages.mock.calls[0][1]).toMatchObject({ search: 'release', fromUser: 'me', minId: 7 })
    expect(page.items.map(item => Number(item.id))).toEqual([10, 9, 8])
    expect(page.total).toBe(10)
  })
})
