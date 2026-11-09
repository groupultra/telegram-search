import type { Result } from '@unbird/result'

import type { FirecrawlConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'

// Firecrawl stops scraping after this long; the client gives it extra room to respond.
const SCRAPE_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 45_000

export interface ScrapedPage {
  title: string
  description: string
  markdown: string
  statusCode: number
}

interface FirecrawlScrapeResponse {
  success?: boolean
  error?: string
  data?: {
    markdown?: string
    metadata?: {
      // Firecrawl returns arrays when a page declares the tag more than once.
      title?: string | string[]
      description?: string | string[]
      statusCode?: number
      error?: string | null
    }
  }
}

function firstString(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

/**
 * Scrape the main content of a page as Markdown through the Firecrawl v2 API.
 *
 * @see https://docs.firecrawl.dev/api-reference/endpoint/scrape
 */
export async function scrapeUrl(url: string, config: FirecrawlConfig): Promise<Result<ScrapedPage>> {
  try {
    // Resolve relative to the base so a self-hosted path prefix is kept.
    const apiBase = config.apiBase.endsWith('/') ? config.apiBase : `${config.apiBase}/`
    const response = await fetch(new URL('v2/scrape', apiBase), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: [{ type: 'markdown' }],
        onlyMainContent: true,
        timeout: SCRAPE_TIMEOUT_MS,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    const body = await response.json().catch(() => ({})) as FirecrawlScrapeResponse
    if (!response.ok || !body.success || !body.data) {
      return Err(new Error(`Firecrawl scrape failed (${response.status}): ${body.error ?? response.statusText}`))
    }

    const metadata = body.data.metadata ?? {}
    if (metadata.error) {
      return Err(new Error(`Firecrawl scrape failed (${metadata.statusCode ?? response.status}): ${metadata.error}`))
    }

    return Ok({
      title: firstString(metadata.title),
      description: firstString(metadata.description),
      markdown: body.data.markdown?.trim() ?? '',
      statusCode: metadata.statusCode ?? 0,
    })
  }
  catch (error) {
    return Err(error)
  }
}
