import { bigint, pgTable, text } from 'drizzle-orm/pg-core'

/**
 * Named leases that let one server instance at a time own a shared runtime
 * resource. A holder renews its lease before `expires_at`; another instance
 * may take it over only after it expires or is released.
 */
export const runtimeLeasesTable = pgTable('runtime_leases', {
  name: text().primaryKey(),
  holder: text().notNull(),
  expires_at: bigint({ mode: 'number' }).notNull(),
})
