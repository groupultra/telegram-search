import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { webPagesTable } from '../../schemas/web-pages'
import { webPageModels } from '../web-pages'

describe('models/web-pages', () => {
  it('records pages once per URL and refreshes them on conflict', async () => {
    const db = await mockDB({ webPagesTable })

    await webPageModels.recordWebPages(db, [{ url: 'https://example.com/a', error: 'timeout', fetched_at: 1 }])
    await webPageModels.recordWebPages(db, [{ url: 'https://example.com/a', title: 'A', content: 'body', fetched_at: 2 }])

    const pages = (await webPageModels.findWebPagesByUrls(db, ['https://example.com/a', 'https://example.com/missing'])).unwrap()
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({ url: 'https://example.com/a', title: 'A', content: 'body', error: '', fetched_at: 2 })

    expect((await webPageModels.findWebPagesByUrls(db, [])).unwrap()).toEqual([])
  })
})
