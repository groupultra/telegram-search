import type { CoreContext } from '../../context'
import type { DBSelectWebPage } from '../../models/utils/types'
import type { WebPageModels } from '../../models/web-pages'
import type { ProcessedCoreMessage } from '../../types/message'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { Api } from 'telegram'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLinkResolver } from '../link-resolver'

function createRawMessage(id: number, text: string, url: string) {
  return new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(100) }),
    date: 0,
    message: text,
    entities: [new Api.MessageEntityUrl({ offset: text.indexOf(url), length: url.length })],
  })
}

function createCoreMessage(id: number, content: string): ProcessedCoreMessage {
  return { uuid: `msg-${id}`, platformMessageId: String(id), chatId: '100', content } as ProcessedCoreMessage
}

function createWebPageModels(cached: Partial<DBSelectWebPage>[] = []) {
  const recorded: Partial<DBSelectWebPage>[] = []
  const models = {
    findWebPagesByUrls: vi.fn(async () => Ok(cached as DBSelectWebPage[])),
    recordWebPages: vi.fn(async (_db, pages) => {
      recorded.push(...pages)
      return Ok(pages.map((page: Partial<DBSelectWebPage>) => ({ title: '', description: '', content: '', error: '', ...page })) as DBSelectWebPage[])
    }),
  } satisfies WebPageModels
  return { models, recorded }
}

function createCtx(apiKey: string) {
  return {
    getDB: () => ({}),
    getAccountSettings: async () => ({ firecrawl: { apiKey, apiBase: 'https://firecrawl.local' } }),
  } as unknown as CoreContext
}

describe('link resolver', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing without a Firecrawl API key', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { models } = createWebPageModels()
    const resolver = createLinkResolver(createCtx(''), useLogger(), models)

    const result = (await resolver.run!({
      messages: [createCoreMessage(1, 'see example.com')],
      rawMessages: [createRawMessage(1, 'see example.com', 'example.com')],
    })).unwrap()

    expect(result).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('scrapes each URL once and attaches the page text to every message linking it', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { markdown: 'Rust async runtimes compared', metadata: { title: 'Runtimes', statusCode: 200 } },
    })))
    vi.stubGlobal('fetch', fetchMock)
    const { models } = createWebPageModels()
    const resolver = createLinkResolver(createCtx('fc-test'), useLogger(), models)

    const messages = [createCoreMessage(1, 'read example.com/post'), createCoreMessage(2, 'again example.com/post'), createCoreMessage(3, 'no links')]
    const result = (await resolver.run!({
      messages,
      // Raw messages arrive in a different order than core messages.
      rawMessages: [
        createRawMessage(2, 'again example.com/post', 'example.com/post'),
        createRawMessage(1, 'read example.com/post', 'example.com/post'),
        new Api.Message({ id: 3, peerId: new Api.PeerChannel({ channelId: bigInt(100) }), date: 0, message: 'no links' }),
      ],
    })).unwrap()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.map(message => message.uuid)).toEqual(['msg-1', 'msg-2'])
    for (const message of result as ProcessedCoreMessage[]) {
      expect(message.links).toEqual([{ url: 'https://example.com/post', title: 'Runtimes' }])
      expect(message.linkText).toBe('Runtimes\nRust async runtimes compared')
    }
  })

  it('reuses cached pages and retries only failed ones', async () => {
    const now = Date.now()
    const cachedPages = [
      { url: 'https://example.com/good', title: 'Cached', description: '', content: 'cached body', error: '', fetched_at: now },
      { url: 'https://example.com/dead', title: '', description: '', content: '', error: 'timeout', fetched_at: now },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: false, error: 'rate limited' }), { status: 429 })))

    const { models, recorded } = createWebPageModels(cachedPages)
    const resolver = createLinkResolver(createCtx('fc-test'), useLogger(), models)
    const opts = {
      messages: [createCoreMessage(1, 'read example.com/good'), createCoreMessage(2, 'read example.com/dead')],
      rawMessages: [createRawMessage(1, 'read example.com/good', 'example.com/good'), createRawMessage(2, 'read example.com/dead', 'example.com/dead')],
    }

    // A recent failure is not retried, and a cached page is used as is.
    const [good, dead] = (await resolver.run!(opts)).unwrap() as ProcessedCoreMessage[]
    expect(fetch).not.toHaveBeenCalled()
    expect(good.linkText).toBe('Cached\ncached body')
    expect(dead.linkText).toBe('')
    expect(dead.links).toEqual([{ url: 'https://example.com/dead', title: undefined }])

    // forceRefetch retries the failed page early but never re-scrapes the good one.
    await resolver.run!({ ...opts, forceRefetch: true })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(recorded).toEqual([expect.objectContaining({ url: 'https://example.com/dead', error: expect.stringContaining('rate limited') })])
  })
})
