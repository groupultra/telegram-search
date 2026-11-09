import { afterEach, describe, expect, it, vi } from 'vitest'

import { scrapeUrl } from '../firecrawl'

const config = { apiKey: 'fc-test', apiBase: 'https://firecrawl.local/' }

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('utils/firecrawl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the v2 scrape endpoint and maps the page', async () => {
    const fetchMock = mockFetch(200, {
      success: true,
      data: {
        markdown: '# Hello\n',
        metadata: { title: ['Hello', 'Other'], description: 'A page', statusCode: 200 },
      },
    })

    const page = (await scrapeUrl('https://example.com', config)).unwrap()

    expect(page).toEqual({ title: 'Hello', description: 'A page', markdown: '# Hello', statusCode: 200 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://firecrawl.local/v2/scrape')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer fc-test')
    expect(JSON.parse(init.body as string)).toMatchObject({ url: 'https://example.com', onlyMainContent: true })
  })

  it('returns an error for API failures and failed target pages', async () => {
    mockFetch(402, { success: false, error: 'Payment required' })
    expect((await scrapeUrl('https://example.com', config)).orUndefined()).toBeUndefined()

    mockFetch(200, { success: true, data: { markdown: '', metadata: { statusCode: 404, error: 'Not Found' } } })
    await expect(scrapeUrl('https://example.com', config).then(result => result.unwrap())).rejects.toThrow('Not Found')
  })
})
