import { Api } from 'telegram'
import { describe, expect, it } from 'vitest'

import { buildLinkIndexText, extractMessageUrls, getIndexableContent, MAX_INDEXED_LINK_TEXT_LENGTH, normalizeUrl } from '../links'

describe('utils/links', () => {
  it('normalizes links into crawlable URLs', () => {
    expect(normalizeUrl('example.com/post')).toBe('https://example.com/post')
    expect(normalizeUrl('http://example.com/a#section')).toBe('http://example.com/a')
    expect(normalizeUrl('mailto:me@example.com')).toBeUndefined()
    expect(normalizeUrl('https://t.me/somechannel/42')).toBeUndefined()
    expect(normalizeUrl('   ')).toBeUndefined()
  })

  it('collects URLs from entities and the web page preview, deduplicated', () => {
    const text = '看看 example.com/a 和 这个'
    const message = new Api.Message({
      id: 1,
      peerId: new Api.PeerUser({ userId: 1 as any }),
      date: 0,
      message: text,
      entities: [
        new Api.MessageEntityUrl({ offset: text.indexOf('example.com/a'), length: 'example.com/a'.length }),
        new Api.MessageEntityTextUrl({ offset: text.indexOf('这个'), length: 2, url: 'https://blog.example.com/b' }),
      ],
      media: new Api.MessageMediaWebPage({
        webpage: new Api.WebPage({ id: 1 as any, url: 'https://example.com/a', displayUrl: 'example.com/a', hash: 0, attributes: [] }),
      }),
    })

    expect(extractMessageUrls(message)).toEqual(['https://example.com/a', 'https://blog.example.com/b'])
  })

  it('caps the indexed link text and appends it to message content', () => {
    const linkText = buildLinkIndexText([
      { title: 'Title', description: 'Desc', content: 'x'.repeat(MAX_INDEXED_LINK_TEXT_LENGTH * 2) },
    ])

    expect(linkText.startsWith('Title\nDesc\n')).toBe(true)
    expect(linkText).toHaveLength(MAX_INDEXED_LINK_TEXT_LENGTH)
    expect(getIndexableContent({ content: 'hello', linkText: 'page' } as any)).toBe('hello\n\npage')
    expect(getIndexableContent({ content: 'hello' } as any)).toBe('hello')
  })
})
