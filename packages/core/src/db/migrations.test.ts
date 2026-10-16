import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { migrate } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { migrations } from '@tg-search/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { describe, expect, it } from 'vitest'

import { chatMessagesTable } from '../schemas/chat-messages'

describe('bundled database migrations', () => {
  it('includes native message metadata and round trips it through a fresh migrated database', async () => {
    // Issue #682: schema build cache omitted root migration files, restoring stale bundles.
    expect(JSON.stringify(migrations)).toContain('telegram_metadata')
    const client = new PGlite({ extensions: { vector } })
    try {
      const db = drizzle(client)
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
      await migrate(db, migrations)
      const metadata = { replyToTopId: '1', groupedId: '99', quote: { text: 'synthetic excerpt', offset: 0 } }
      const rows = await db.insert(chatMessagesTable).values({ platform: 'telegram', platform_message_id: '7', in_chat_id: '42', in_chat_type: 'group', telegram_metadata: metadata }).returning()
      expect(rows).toHaveLength(1)
      expect(rows[0].telegram_metadata).toEqual(metadata)
    }
    finally {
      await client.close()
    }
  })
})
