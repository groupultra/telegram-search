// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { bigint, pgTable, uuid } from 'drizzle-orm/pg-core'

import { stickersTable } from './stickers'

export const recentSentStickersTable = pgTable('recent_sent_stickers', {
  id: uuid().primaryKey().defaultRandom(),
  sticker_id: uuid().notNull().references(() => stickersTable.id, { onDelete: 'cascade' }),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
})
