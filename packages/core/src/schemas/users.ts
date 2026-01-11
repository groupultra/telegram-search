import { bigint, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text().notNull().default('telegram'),
  platform_user_id: text().notNull().default(''),
  name: text().notNull().default(''),
  username: text().notNull().default(''),
  access_hash: text(),
  type: text().notNull().default('user').$type<'user' | 'chat' | 'channel'>(),
  created_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
  updated_at: bigint({ mode: 'number' }).notNull().default(0).$defaultFn(() => Date.now()),
}, table => [
  uniqueIndex('users_platform_platform_user_id_unique_index').on(table.platform, table.platform_user_id),
  index('users_platform_user_id_index').on(table.platform_user_id),
])
