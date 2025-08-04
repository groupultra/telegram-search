// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { bigint, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const stickerPacksTable = pgTable('sticker_packs', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default(''),
  platform_id: text().notNull().default(''),
  name: text().notNull().default(''),
  description: text().notNull().default(''),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('sticker_packs_platform_platform_id_unique_index').on(table.platform, table.platform_id),
])
