import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'
import type { DBInsertWebPage, DBSelectWebPage } from './utils/types'

import { inArray, sql } from 'drizzle-orm'

import { webPagesTable } from '../schemas/web-pages'
import { withResult } from '../utils/result'

async function findWebPagesByUrls(db: CoreDB, urls: string[]): PromiseResult<DBSelectWebPage[]> {
  return withResult(async () => {
    if (urls.length === 0) {
      return []
    }

    return db
      .select()
      .from(webPagesTable)
      .where(inArray(webPagesTable.url, urls))
  })
}

/**
 * Insert or refresh crawled pages by URL.
 */
async function recordWebPages(db: CoreDB, pages: DBInsertWebPage[]): PromiseResult<DBSelectWebPage[]> {
  return withResult(async () => {
    if (pages.length === 0) {
      return []
    }

    return db
      .insert(webPagesTable)
      .values(pages)
      .onConflictDoUpdate({
        target: webPagesTable.url,
        set: {
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          content: sql`excluded.content`,
          status_code: sql`excluded.status_code`,
          error: sql`excluded.error`,
          fetched_at: sql`excluded.fetched_at`,
          updated_at: Date.now(),
        },
      })
      .returning()
  })
}

export const webPageModels = {
  findWebPagesByUrls,
  recordWebPages,
}

export type WebPageModels = typeof webPageModels
