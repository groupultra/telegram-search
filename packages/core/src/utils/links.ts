import type { ProcessedCoreMessage } from '../types/message'

import { Api } from 'telegram'

// Keep crawl cost and embedding input bounded for link-heavy messages.
export const MAX_LINKS_PER_MESSAGE = 3
export const MAX_STORED_PAGE_CONTENT_LENGTH = 20_000
export const MAX_INDEXED_LINK_TEXT_LENGTH = 2_000

// Telegram's own links point at chats and posts that Firecrawl cannot read.
const IGNORED_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.dog'])

export interface IndexableWebPage {
  title: string
  description: string
  content: string
}

/**
 * Normalize a link into a crawlable URL, or return undefined when it should be skipped.
 */
export function normalizeUrl(raw: string): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  // Url entities keep the text as typed, so `example.com/a` has no scheme.
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  }
  catch {
    return undefined
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined
  }

  if (IGNORED_HOSTS.has(url.hostname.toLowerCase())) {
    return undefined
  }

  url.hash = ''
  return url.toString()
}

/**
 * Collect the URLs a Telegram message links to, from text entities and the web page preview.
 */
export function extractMessageUrls(message: Api.Message): string[] {
  const candidates: string[] = []
  const text = message.message ?? ''

  for (const entity of message.entities ?? []) {
    if (entity instanceof Api.MessageEntityUrl) {
      // Entity offsets are UTF-16 code units, which match JavaScript string indexes.
      candidates.push(text.slice(entity.offset, entity.offset + entity.length))
    }
    else if (entity instanceof Api.MessageEntityTextUrl) {
      candidates.push(entity.url)
    }
  }

  if (message.media instanceof Api.MessageMediaWebPage && message.media.webpage instanceof Api.WebPage) {
    candidates.push(message.media.webpage.url)
  }

  const urls = new Set<string>()
  for (const candidate of candidates) {
    const url = normalizeUrl(candidate)
    if (url) {
      urls.add(url)
    }

    if (urls.size >= MAX_LINKS_PER_MESSAGE) {
      break
    }
  }

  return [...urls]
}

/**
 * Condense crawled pages into the text that is indexed alongside a message.
 */
export function buildLinkIndexText(pages: IndexableWebPage[]): string {
  return pages
    .map(page => [page.title, page.description, page.content].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_INDEXED_LINK_TEXT_LENGTH)
}

/**
 * Text used by the embedding and jieba resolvers: message content plus crawled link text.
 */
export function getIndexableContent(message: ProcessedCoreMessage): string {
  return [message.content, message.linkText].filter(Boolean).join('\n\n')
}
