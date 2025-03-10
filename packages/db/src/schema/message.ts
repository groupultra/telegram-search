import type { DatabaseMediaInfo } from './types'

import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { databaseMessageTypeEnum } from './types'
import { tsvector } from './utils/tsvector'

/**
 * Get table name for a chat partition
 * Handles negative chat IDs by prefixing with 'n'
 */
function getTableName(chatId: number | bigint): string {
  const absId = chatId < 0 ? -chatId : chatId
  const prefix = chatId < 0 ? 'n' : ''
  return `messages_${prefix}${absId}`
}

/**
 * Base schema for message tables
 * Defines common columns and their types
 */
const messageTableSchema = {
  uuid: uuid('uuid').defaultRandom().primaryKey(),
  id: bigint('id', { mode: 'number' }).notNull(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  type: databaseMessageTypeEnum('type').notNull().default('text'),
  content: text('content'),
  tsContent: tsvector('ts_content'),
  mediaInfo: jsonb('media_info').$type<DatabaseMediaInfo>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  fromId: bigint('from_id', { mode: 'number' }),
  fromName: text('from_name'),
  fromAvatar: jsonb('from_avatar').$type<{
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }>(),
  replyToId: bigint('reply_to_id', { mode: 'number' }),
  forwardFromChatId: bigint('forward_from_chat_id', { mode: 'number' }),
  forwardFromChatName: text('forward_from_chat_name'),
  forwardFromMessageId: bigint('forward_from_message_id', { mode: 'number' }),
  views: integer('views'),
  forwards: integer('forwards'),
  links: jsonb('links').$type<string[]>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}

/**
 * Get message table definition for a specific chat
 */
export function getMessageTable(chatId: number | bigint) {
  const tableName = getTableName(chatId)

  // Create base table with schema and indexes
  return pgTable(tableName, messageTableSchema, table => [
    // Composite unique index for chat_id and id
    uniqueIndex(`${tableName}_chat_id_id_unique`)
      .on(table.chatId, table.id),

    // Index for message type
    index(`${tableName}_type_idx`)
      .on(table.type),

    // Unique index for id
    uniqueIndex(`${tableName}_id_idx`)
      .on(table.id),
  ])
}

/**
 * Create message table for a specific chat with all required columns and indexes
 */
export async function useMessageTable(chatId: number | bigint) {
  const tableName = getTableName(chatId)
  const table = getMessageTable(chatId)

  // Create table and all indexes atomically
  await useDB().execute(sql`
    DO $$ 
    BEGIN
      -- Create text search configuration if not exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'telegram_search'
      ) THEN
        CREATE TEXT SEARCH CONFIGURATION telegram_search (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION telegram_search ALTER MAPPING FOR word WITH simple;
      END IF;

      -- Create base table with generated tsvector column
      CREATE TABLE IF NOT EXISTS ${sql.identifier(tableName)} (
        uuid UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        id BIGINT NOT NULL,
        chat_id BIGINT NOT NULL,
        type message_type NOT NULL DEFAULT 'text',
        content TEXT,
        embedding VECTOR(1536),
        ts_content TSVECTOR GENERATED ALWAYS AS (to_tsvector('telegram_search', coalesce(content, ''))) STORED,
        media_info JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        from_id BIGINT,
        from_name TEXT,
        from_avatar JSONB,
        reply_to_id BIGINT,
        forward_from_chat_id BIGINT,
        forward_from_chat_name TEXT,
        forward_from_message_id BIGINT,
        views INTEGER,
        forwards INTEGER,
        links JSONB,
        metadata JSONB
      );

      -- Create all indexes
      CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_chat_id_id_unique`)}
        ON ${sql.identifier(tableName)} (chat_id, id);
      CREATE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_type_idx`)}
        ON ${sql.identifier(tableName)} (type);
      CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_id_idx`)}
        ON ${sql.identifier(tableName)} (id);
      CREATE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_created_at_idx`)}
        ON ${sql.identifier(tableName)} (created_at DESC);
      CREATE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_embedding_idx`)}
        ON ${sql.identifier(tableName)}
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      CREATE INDEX IF NOT EXISTS ${sql.identifier(`${tableName}_ts_content_idx`)}
        ON ${sql.identifier(tableName)}
        USING GIN (ts_content);
    END $$;
  `)

  return table
}

/**
 * Create partition table and materialized view for message statistics
 */
export async function createMessageStatsView(chatId: number | bigint) {
  const tableName = getTableName(chatId)
  const viewName = `message_stats_${tableName}`
  const messageTable = getMessageTable(chatId)

  // Ensure table exists
  await useMessageTable(chatId)

  // Create text search configuration
  await useDB().execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'telegram_search'
      ) THEN
        CREATE TEXT SEARCH CONFIGURATION telegram_search (COPY = simple);
        ALTER TEXT SEARCH CONFIGURATION telegram_search ALTER MAPPING FOR word WITH simple;
      END IF;
    END $$;
  `)

  // Create view and index
  return await useDB().execute(sql`
    DROP MATERIALIZED VIEW IF EXISTS ${sql.identifier(viewName)};
    CREATE MATERIALIZED VIEW ${sql.identifier(viewName)} AS 
    SELECT 
      chat_id,
      count(*) as message_count,
      count(*) filter (where type = 'text') as text_count,
      count(*) filter (where type = 'photo') as photo_count,
      count(*) filter (where type = 'video') as video_count,
      count(*) filter (where type = 'document') as document_count,
      count(*) filter (where type = 'sticker') as sticker_count,
      count(*) filter (where type = 'other') as other_count,
      max(created_at) as last_message_date,
      (array_agg(content order by created_at desc))[1] as last_message
    FROM ${messageTable}
    GROUP BY chat_id;
    CREATE UNIQUE INDEX ${sql.identifier(`${viewName}_chat_id_idx`)}
    ON ${sql.identifier(viewName)} (chat_id);
  `)
}
