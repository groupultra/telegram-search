import type { CoreContext, CoreEmitter } from '../../context'
import type { CoreDB } from '../../db'
import type { CoreUserEntity, FromCoreEvent, ToCoreEvent } from '../../types/events'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { createDialogService } from '../dialog'

const logger = useLogger()

const mockUserModels = {
  findUsersByPlatformIds: vi.fn(async () => Ok([])),
  recordUser: vi.fn(),
} as any

function createMockCtx(client: any) {
  const withError = vi.fn((error: unknown) => (error instanceof Error ? error : new Error(String(error))))

  const ctx: CoreContext = {
    emitter: { emit: vi.fn(), on: vi.fn(), once: vi.fn(), off: vi.fn() } as unknown as CoreEmitter,
    toCoreEvents: new Set<keyof ToCoreEvent>(),
    fromCoreEvents: new Set<keyof FromCoreEvent>(),
    wrapEmitterEmit: () => {},
    wrapEmitterOn: () => {},
    setClient: () => {},
    getClient: () => client,
    setCurrentAccountId: () => {},
    getCurrentAccountId: () => 'acc-1',
    getDB: () => ({} as unknown as CoreDB),
    withError,
    cleanup: () => {},
    setMyUser: () => {},
    getMyUser: () => ({}) as unknown as CoreUserEntity,
    getAccountSettings: async () => ({}) as any,
    setAccountSettings: async () => {},
    metrics: undefined,
  }

  return { ctx }
}

function makeUser(id: number) {
  return new Api.User({ id: bigInt(id), accessHash: bigInt(id * 10), firstName: `U${id}` })
}

function makeMessage(userId: number, msgId: number) {
  return new Api.Message({
    id: msgId,
    peerId: new Api.PeerUser({ userId: bigInt(userId) }),
    date: 1_700_000_000 + msgId,
    message: `m${msgId}`,
  })
}

function makeDialog(userId: number, msgId: number) {
  return new Api.Dialog({
    peer: new Api.PeerUser({ userId: bigInt(userId) }),
    topMessage: msgId,
    readInboxMaxId: 0,
    readOutboxMaxId: 0,
    unreadCount: 0,
    unreadMentionsCount: 0,
    unreadReactionsCount: 0,
    notifySettings: new Api.PeerNotifySettings({}),
  })
}

function makeDialogsResponse(userId: number, msgId: number) {
  return new Api.messages.Dialogs({
    dialogs: [makeDialog(userId, msgId)],
    messages: [makeMessage(userId, msgId)],
    chats: [],
    users: [makeUser(userId)],
  })
}

// A DialogsSlice for one dialog per user id. msgId == userId keeps offsets distinct.
function makeDialogsSlice(userIds: number[], count: number) {
  return new Api.messages.DialogsSlice({
    count,
    dialogs: userIds.map(id => makeDialog(id, id)),
    messages: userIds.map(id => makeMessage(id, id)),
    chats: [],
    users: userIds.map(makeUser),
  })
}

function clientWith(invoke: (query: any) => any) {
  return {
    _entityCache: { get: () => undefined },
    invoke: vi.fn(async (query: any) => invoke(query)),
    getEntity: vi.fn(),
  }
}

describe('services/dialog fetchDialogs split ranges (issue #575)', () => {
  // https://github.com/groupultra/telegram-search/issues/575
  it('fetches dialogs from every split range so none are missed', async () => {
    // ROOT CAUSE:
    // before-patch: fetchDialogs called client.getDialogs(), which paginates a
    //   single message box. Accounts whose total message volume crosses the
    //   500K/1M boundary expose dialogs across multiple boxes; the dialogs whose
    //   top message lives in an older box (second split range here) were silently
    //   dropped from the chat list and never synced.
    // root cause: dialog pagination was not wrapped in InvokeWithMessagesRange
    //   per messages.getSplitRanges, unlike message fetch (PR #576) and tdesktop.
    // after-patch: each split range is iterated separately, so dialogs from every
    //   box are returned.
    const rangeA = new Api.MessageRange({ minId: 1, maxId: 1_000_000 })
    const rangeB = new Api.MessageRange({ minId: 1_000_001, maxId: 2_000_000 })

    const wrappedRanges: Array<{ minId: number, maxId: number }> = []

    const client = clientWith((query) => {
      if (query instanceof Api.messages.GetSplitRanges) {
        return [rangeA, rangeB]
      }
      if (query instanceof Api.InvokeWithMessagesRange) {
        const range = query.range as Api.MessageRange
        wrappedRanges.push({ minId: range.minId, maxId: range.maxId })
        // range A -> user 100, range B -> user 200
        return range.minId === 1
          ? makeDialogsResponse(100, 50)
          : makeDialogsResponse(200, 1_500_000)
      }
      throw new Error(`unexpected query ${query?.className}`)
    })

    const { ctx } = createMockCtx(client)
    const service = createDialogService(ctx, logger, mockUserModels)

    const dialogs = (await service.fetchDialogs()).expect('fetchDialogs failed')
    const ids = dialogs.map(d => d.id).sort((a, b) => a - b)

    expect(ids).toEqual([100, 200])
    expect(wrappedRanges).toEqual([
      { minId: 1, maxId: 1_000_000 },
      { minId: 1_000_001, maxId: 2_000_000 },
    ])
  })

  it('dedups dialogs that appear in more than one split range', async () => {
    const rangeA = new Api.MessageRange({ minId: 1, maxId: 1_000_000 })
    const rangeB = new Api.MessageRange({ minId: 1_000_001, maxId: 2_000_000 })

    const client = clientWith((query) => {
      if (query instanceof Api.messages.GetSplitRanges) {
        return [rangeA, rangeB]
      }
      if (query instanceof Api.InvokeWithMessagesRange) {
        // same user 100 surfaces in both ranges
        return makeDialogsResponse(100, 50)
      }
      throw new Error(`unexpected query ${query?.className}`)
    })

    const { ctx } = createMockCtx(client)
    const service = createDialogService(ctx, logger, mockUserModels)

    const dialogs = (await service.fetchDialogs()).expect('fetchDialogs failed')
    expect(dialogs.map(d => d.id)).toEqual([100])
  })

  it('falls back to unwrapped GetDialogs when there are no split ranges', async () => {
    let wrappedSeen = false
    let bareGetDialogsSeen = false

    const client = clientWith((query) => {
      if (query instanceof Api.messages.GetSplitRanges) {
        return []
      }
      if (query instanceof Api.InvokeWithMessagesRange) {
        wrappedSeen = true
        throw new Error('should not wrap when no split ranges')
      }
      if (query instanceof Api.messages.GetDialogs) {
        bareGetDialogsSeen = true
        return makeDialogsResponse(100, 50)
      }
      throw new Error(`unexpected query ${query?.className}`)
    })

    const { ctx } = createMockCtx(client)
    const service = createDialogService(ctx, logger, mockUserModels)

    const dialogs = (await service.fetchDialogs()).expect('fetchDialogs failed')

    expect(wrappedSeen).toBe(false)
    expect(bareGetDialogsSeen).toBe(true)
    expect(dialogs.map(d => d.id)).toEqual([100])
  })

  it('paginates multiple pages within a range, advancing offset from the last dialog', async () => {
    // A full page (== CHATS_SLICE_LIMIT) of DialogsSlice must trigger a second
    // request; the offset must advance to the last dialog of page 1.
    const PAGE = 100
    const page1Ids = Array.from({ length: PAGE }, (_, i) => i + 1) // 1..100
    const page2Ids = [101, 102] // short page -> terminate

    const getDialogsCalls: Array<{ offsetId: number, excludePinned: boolean }> = []

    const client = clientWith((query) => {
      if (query instanceof Api.messages.GetSplitRanges) {
        return []
      }
      if (query instanceof Api.messages.GetDialogs) {
        getDialogsCalls.push({ offsetId: query.offsetId, excludePinned: !!query.excludePinned })
        return query.offsetId === 0
          ? makeDialogsSlice(page1Ids, PAGE + page2Ids.length)
          : makeDialogsSlice(page2Ids, PAGE + page2Ids.length)
      }
      throw new Error(`unexpected query ${query?.className}`)
    })

    const { ctx } = createMockCtx(client)
    const service = createDialogService(ctx, logger, mockUserModels)

    const dialogs = (await service.fetchDialogs()).expect('fetchDialogs failed')

    expect(dialogs).toHaveLength(PAGE + page2Ids.length)
    expect(getDialogsCalls).toHaveLength(2)
    // page 2 advanced past page 1's last dialog (msgId == userId == 100) and set excludePinned
    expect(getDialogsCalls[0]).toEqual({ offsetId: 0, excludePinned: false })
    expect(getDialogsCalls[1]).toEqual({ offsetId: 100, excludePinned: true })
  })

  it('recovers a dialog that lacked an entity in an earlier range from a later range', async () => {
    // ROOT CAUSE:
    // before-patch: seen.add(peerId) ran before the entity/message guard, so a
    //   dialog missing its entity in range A was marked seen and then blocked in
    //   range B even when range B carried full data -- the dialog vanished.
    // after-patch: peerId enters seen only after a Dialog is successfully built,
    //   so range B recovers it.
    const rangeA = new Api.MessageRange({ minId: 1, maxId: 1_000_000 })
    const rangeB = new Api.MessageRange({ minId: 1_000_001, maxId: 2_000_000 })

    const client = clientWith((query) => {
      if (query instanceof Api.messages.GetSplitRanges) {
        return [rangeA, rangeB]
      }
      if (query instanceof Api.InvokeWithMessagesRange) {
        const range = query.range as Api.MessageRange
        if (range.minId === 1) {
          // range A: dialog for user 100 but its entity is absent from users[]
          return new Api.messages.Dialogs({
            dialogs: [makeDialog(100, 50)],
            messages: [makeMessage(100, 50)],
            chats: [],
            users: [],
          })
        }
        // range B: same user 100 with full entity
        return makeDialogsResponse(100, 1_500_000)
      }
      throw new Error(`unexpected query ${query?.className}`)
    })

    const { ctx } = createMockCtx(client)
    const service = createDialogService(ctx, logger, mockUserModels)

    const dialogs = (await service.fetchDialogs()).expect('fetchDialogs failed')
    expect(dialogs.map(d => d.id)).toEqual([100])
  })
})
