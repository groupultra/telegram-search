import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { DBInsertWebPage, DBSelectWebPage } from '../models/utils/types'
import type { WebPageModels } from '../models/web-pages'
import type { FirecrawlConfig } from '../types/account-settings'
import type { ProcessedCoreMessage } from '../types/message'

import { newQueue } from '@henrygd/queue'
import { Ok } from '@unbird/result'

import { scrapeUrl } from '../utils/firecrawl'
import { buildLinkIndexText, extractMessageUrls, MAX_STORED_PAGE_CONTENT_LENGTH } from '../utils/links'
import { getPeerChatId } from '../utils/message'

const LINK_SCRAPE_CONCURRENCY = 3
// Failed scrapes are cached too, so a dead link is not retried on every message.
// Successful pages are never re-scraped: Firecrawl credits are spent once per URL.
const FAILED_SCRAPE_RETRY_MS = 24 * 60 * 60 * 1000

/**
 * Crawls linked pages through Firecrawl and attaches their text to messages,
 * so the embedding and jieba resolvers index what a link is about.
 *
 * Must run before the embedding and jieba resolvers (see message-resolver service).
 */
export function createLinkResolver(ctx: CoreContext, logger: Logger, webPageModels: WebPageModels): MessageResolver {
  logger = logger.withContext('core:resolver:link')

  const scrapeQueue = newQueue(LINK_SCRAPE_CONCURRENCY)

  async function scrapePage(url: string, firecrawl: FirecrawlConfig): Promise<DBInsertWebPage> {
    const result = await scrapeUrl(url, firecrawl)
    const page = result.orUndefined()
    ctx.metrics?.firecrawlApiCall.inc({ status: page != null ? 'success' : 'error' })

    if (page) {
      return {
        url,
        title: page.title,
        description: page.description,
        content: page.markdown.slice(0, MAX_STORED_PAGE_CONTENT_LENGTH),
        status_code: page.statusCode,
        error: '',
        fetched_at: Date.now(),
      }
    }

    let error: unknown
    try {
      result.unwrap()
    }
    catch (err) {
      error = err
    }
    logger.withFields({ url }).withError(error).warn('Failed to scrape link')

    return {
      url,
      error: error instanceof Error ? error.message : String(error),
      fetched_at: Date.now(),
    }
  }

  return {
    run: async (opts: MessageResolverOpts) => {
      const { firecrawl } = await ctx.getAccountSettings()

      // Link indexing is opt-in: it starts once a Firecrawl API key is configured.
      if (!firecrawl.apiKey.trim()) {
        return Ok([])
      }

      const rawMessages = new Map(opts.rawMessages.map(raw => [`${getPeerChatId(raw.peerId)}:${raw.id}`, raw]))
      const urlsByMessage = new Map<ProcessedCoreMessage, string[]>()
      for (const message of opts.messages) {
        const raw = rawMessages.get(`${message.chatId}:${message.platformMessageId}`)
        const urls = raw ? extractMessageUrls(raw) : []
        if (urls.length > 0) {
          urlsByMessage.set(message, urls)
        }
      }

      if (urlsByMessage.size === 0) {
        return Ok([])
      }

      const db = ctx.getDB()
      const urls = [...new Set([...urlsByMessage.values()].flat())]
      const pages = new Map(
        (await webPageModels.findWebPagesByUrls(db, urls)).expect('Failed to load cached web pages').map(page => [page.url, page]),
      )

      const now = Date.now()
      const urlsToScrape = urls.filter((url) => {
        const page = pages.get(url)
        return !page || (page.error !== '' && (opts.forceRefetch || now - page.fetched_at > FAILED_SCRAPE_RETRY_MS))
      })

      logger.withFields({ messages: urlsByMessage.size, urls: urls.length, scrape: urlsToScrape.length }).verbose('Resolving links')

      const scraped = await Promise.all(urlsToScrape.map(url => scrapeQueue.add(() => scrapePage(url, firecrawl))))
      for (const page of (await webPageModels.recordWebPages(db, scraped)).expect('Failed to record web pages')) {
        pages.set(page.url, page)
      }

      for (const [message, messageUrls] of urlsByMessage) {
        message.links = messageUrls.map(url => ({ url, title: pages.get(url)?.title || undefined }))
        message.linkText = buildLinkIndexText(
          messageUrls
            .map(url => pages.get(url))
            .filter((page): page is DBSelectWebPage => page != null && page.error === ''),
        )
      }

      return Ok([...urlsByMessage.keys()])
    },
  }
}
