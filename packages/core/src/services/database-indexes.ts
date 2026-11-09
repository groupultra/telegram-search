import type { Logger } from '@guiiai/logg'
import type { DatabaseIndexKind, DatabaseIndexStatus } from '@tg-search/protocol'
import type { IndexedColumn, PgTable } from 'drizzle-orm/pg-core'

import type { CoreDB } from '../db'

import { is, sql, SQL } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'

import { accountChatFoldersTable } from '../schemas/account-chat-folders'
import { accountJoinedChatsTable } from '../schemas/account-joined-chats'
import { accountsTable } from '../schemas/accounts'
import { botScheduledTasksTable } from '../schemas/bot-scheduled-tasks'
import { chatMessagesTable } from '../schemas/chat-messages'
import { joinedChatsTable } from '../schemas/joined-chats'
import { photosTable } from '../schemas/photos'
import { remoteAuditEventsTable } from '../schemas/remote-audit-events'
import { stickerPacksTable } from '../schemas/sticker-packs'
import { stickersTable } from '../schemas/stickers'
import { systemSettingsTable } from '../schemas/system-settings'
import { usersTable } from '../schemas/users'

// Every table whose drizzle-declared indexes can be listed, dropped and rebuilt.
// Primary keys and table-level `unique()` constraints are not indexes here: they belong to constraints.
const MANAGED_TABLES: PgTable[] = [
  accountChatFoldersTable,
  accountJoinedChatsTable,
  accountsTable,
  botScheduledTasksTable,
  chatMessagesTable,
  joinedChatsTable,
  photosTable,
  remoteAuditEventsTable,
  stickerPacksTable,
  stickersTable,
  systemSettingsTable,
  usersTable,
]

const VECTOR_INDEX_METHODS = new Set(['hnsw', 'ivfflat'])

export interface ManagedIndex {
  name: string
  table: string
  kind: DatabaseIndexKind
  method: string
  /** CREATE statement equivalent to the one drizzle-kit generates for this index. */
  createStatement: (options: { concurrently: boolean }) => string
}

export interface ExistingIndex {
  valid: boolean
  sizeBytes: number
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

function renderIndexedColumn(column: Partial<IndexedColumn | SQL>, indexName: string): string {
  // Expression indexes would need the SQL dialect to inline parameters; no schema declares one yet.
  if (is(column, SQL) || !(column as IndexedColumn).name)
    throw new Error(`Index ${indexName} uses an expression column, which index rebuild does not support`)
  const indexed = column as IndexedColumn
  const parts = [quoteIdentifier(indexed.name!)]
  if (indexed.indexConfig?.opClass)
    parts.push(indexed.indexConfig.opClass)
  // drizzle fills in `asc nulls last` on every column; like drizzle-kit, emit only non-defaults,
  // because hnsw and gin reject ordering options.
  if (indexed.indexConfig?.order && indexed.indexConfig.order !== 'asc')
    parts.push(indexed.indexConfig.order)
  if (indexed.indexConfig?.nulls && indexed.indexConfig.nulls !== 'last')
    parts.push(`nulls ${indexed.indexConfig.nulls}`)
  return parts.join(' ')
}

let managedIndexesCache: ManagedIndex[] | undefined

export function listManagedIndexes(): ManagedIndex[] {
  if (managedIndexesCache)
    return managedIndexesCache

  const indexes: ManagedIndex[] = []
  for (const table of MANAGED_TABLES) {
    const config = getTableConfig(table)
    for (const index of config.indexes) {
      const { name, unique, only, where, with: withOptions } = index.config
      const method = index.config.method ?? 'btree'
      if (!name)
        throw new Error(`An index on ${config.name} has no explicit name`)
      if (where || (withOptions && Object.keys(withOptions).length > 0))
        throw new Error(`Index ${name} uses WHERE or WITH, which index rebuild does not support`)
      const columns = index.config.columns.map(column => renderIndexedColumn(column, name)).join(',')
      indexes.push({
        name,
        table: config.name,
        kind: VECTOR_INDEX_METHODS.has(method) ? 'vector' : unique ? 'unique' : 'standard',
        method,
        createStatement: ({ concurrently }) => [
          unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX',
          concurrently ? 'CONCURRENTLY' : undefined,
          'IF NOT EXISTS',
          quoteIdentifier(name),
          'ON',
          only ? 'ONLY' : undefined,
          quoteIdentifier(config.name),
          `USING ${method}`,
          `(${columns})`,
        ].filter(Boolean).join(' '),
      })
    }
  }

  managedIndexesCache = indexes
  return indexes
}

export async function readExistingIndexes(db: CoreDB): Promise<Map<string, ExistingIndex>> {
  const result = await db.execute(sql`
    SELECT c.relname AS name, i.indisvalid AS valid, pg_relation_size(c.oid)::bigint AS size_bytes
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
  `)
  const rows = result.rows as Array<{ name: string, valid: boolean, size_bytes: string | number }>
  return new Map(rows.map(row => [row.name, { valid: row.valid, sizeBytes: Number(row.size_bytes) }]))
}

export function describeIndexes(indexes: ManagedIndex[], existing: Map<string, ExistingIndex>): DatabaseIndexStatus[] {
  return indexes.map((index) => {
    const state = existing.get(index.name)
    return {
      name: index.name,
      table: index.table,
      kind: index.kind,
      method: index.method,
      exists: state !== undefined,
      valid: state?.valid ?? false,
      sizeBytes: state?.sizeBytes ?? 0,
    }
  })
}

export function createIndexStatements(db: CoreDB, logger: Logger, options: { concurrently: boolean }) {
  const concurrently = options.concurrently ? ' CONCURRENTLY' : ''
  const run = async (statement: string) => {
    logger.withFields({ statement }).log('Running index maintenance statement')
    await db.execute(sql.raw(statement))
  }
  return {
    drop: (index: ManagedIndex) => run(`DROP INDEX${concurrently} IF EXISTS ${quoteIdentifier(index.name)}`),
    create: (index: ManagedIndex) => run(index.createStatement({ concurrently: options.concurrently })),
    reindex: (index: ManagedIndex) => run(`REINDEX INDEX${concurrently} ${quoteIdentifier(index.name)}`),
  }
}
