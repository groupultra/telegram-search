import { bigint, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// Crawled link pages, keyed by URL so a link shared across many messages is fetched once.
export const webPagesTable = pgTable('web_pages', {
  id: uuid().primaryKey().defaultRandom(),
  url: text().notNull(),
  title: text().notNull().default(''),
  description: text().notNull().default(''),
  // Main page content as Markdown, truncated before storage.
  content: text().notNull().default(''),
  status_code: integer().notNull().default(0),
  // Empty when the last fetch succeeded.
  error: text().notNull().default(''),
  fetched_at: bigint({ mode: 'number' }).notNull().default(0),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('web_pages_url_unique_index').on(table.url),
])
