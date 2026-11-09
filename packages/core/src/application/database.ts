import type { Logger } from '@guiiai/logg'
import type {
  AppResult,
  DatabaseIndexList,
  DropDatabaseIndexesInput,
  DropDatabaseIndexesResult,
  GetVectorSettingsInput,
  ListDatabaseIndexesInput,
  RebuildDatabaseIndexesInput,
  RebuildDatabaseIndexesResult,
  SetVectorSettingsInput,
  SetVectorSettingsResult,
  VectorSettings,
} from '@tg-search/protocol'

import type { CoreDB } from '../db'
import type { ManagedIndex } from '../services/database-indexes'
import type { ReadOperationOptions } from './read-operation'

import { useLogger } from '@guiiai/logg'

import { systemSettingsModels } from '../models/system-settings'
import { createIndexStatements, describeIndexes, listManagedIndexes, readExistingIndexes } from '../services/database-indexes'
import { ApplicationError, appResult } from './errors'
import { ReadOperationError, withReadOperation } from './read-operation'

/** Database-wide maintenance. Every operation affects all accounts stored in the database. */
export interface DatabaseAdministration {
  listIndexes: (input: ListDatabaseIndexesInput, options?: ReadOperationOptions) => Promise<AppResult<DatabaseIndexList>>
  dropIndexes: (input: DropDatabaseIndexesInput, options?: ReadOperationOptions) => Promise<AppResult<DropDatabaseIndexesResult>>
  rebuildIndexes: (input: RebuildDatabaseIndexesInput, options?: ReadOperationOptions) => Promise<AppResult<RebuildDatabaseIndexesResult>>
  getVector: (input: GetVectorSettingsInput, options?: ReadOperationOptions) => Promise<AppResult<VectorSettings>>
  setVector: (input: SetVectorSettingsInput, options?: ReadOperationOptions) => Promise<AppResult<SetVectorSettingsResult>>
}

export interface DatabaseAdministrationOptions {
  db: CoreDB
  logger?: Logger
  /**
   * Use CONCURRENTLY so reads and sync writes continue during index DDL.
   * Only Postgres needs it; PGlite has a single connection.
   */
  concurrently?: boolean
}

function matchesKind(index: ManagedIndex, kind: ListDatabaseIndexesInput['kind']): boolean {
  return kind === 'all' || index.kind === kind
}

/**
 * DDL cannot be cancelled once Postgres starts it, so cancellation and deadlines are only
 * honored between statements. A caller that stops early can list indexes to see what ran.
 */
function createCheckpoint(input: { operation?: { deadlineAt: number } }, options?: ReadOperationOptions): () => void {
  const deadlineAt = options?.deadlineAt ?? input.operation?.deadlineAt
  return () => {
    if (options?.signal?.aborted)
      throw new ReadOperationError('REQUEST_CANCELLED', 'Index maintenance cancelled before the next statement')
    if (deadlineAt !== undefined && Date.now() >= deadlineAt)
      throw new ReadOperationError('REQUEST_DEADLINE_EXCEEDED', 'Index maintenance deadline exceeded before the next statement')
  }
}

/** Drop every existing vector index; used when vector search is disabled. */
export async function dropVectorIndexes(db: CoreDB, logger: Logger, options: { concurrently: boolean }, checkpoint: () => void = () => {}): Promise<string[]> {
  const existing = await readExistingIndexes(db)
  const statements = createIndexStatements(db, logger, options)
  const dropped: string[] = []
  for (const index of listManagedIndexes()) {
    if (index.kind !== 'vector' || !existing.has(index.name))
      continue
    checkpoint()
    await statements.drop(index)
    dropped.push(index.name)
  }
  return dropped
}

/**
 * Keep the database in line with the stored vector switch after migrations run,
 * because a fresh database or a future migration can create vector indexes again.
 */
export async function enforceVectorSettings(db: CoreDB, logger: Logger, options: { concurrently: boolean }): Promise<void> {
  const settings = (await systemSettingsModels.getVectorSettings(db)).expect('Failed to read vector settings')
  if (settings.enabled)
    return
  const dropped = await dropVectorIndexes(db, logger, options)
  if (dropped.length > 0)
    logger.withFields({ dropped }).log('Dropped vector indexes because vector search is disabled')
}

export function createDatabaseAdministration(options: DatabaseAdministrationOptions): DatabaseAdministration {
  const { db } = options
  const logger = (options.logger ?? useLogger('application')).withContext('core:database-admin')
  const concurrently = options.concurrently ?? false
  const statements = createIndexStatements(db, logger, { concurrently })

  const readVector = async () => (await systemSettingsModels.getVectorSettings(db)).expect('Failed to read vector settings')

  return {
    listIndexes: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, async (scope) => {
      const [vector, existing] = await scope.wait(Promise.all([readVector(), readExistingIndexes(db)]))
      const indexes = listManagedIndexes().filter(index => matchesKind(index, input.kind))
      return { vector, indexes: describeIndexes(indexes, existing) }
    })),

    dropIndexes: (input, readOptions) => appResult(async () => {
      const checkpoint = createCheckpoint(input, readOptions)
      checkpoint()
      const existing = await readExistingIndexes(db)
      const result: DropDatabaseIndexesResult = { dropped: [], skipped: [] }
      // Unique indexes back ON CONFLICT upserts during sync, so they are never dropped.
      for (const index of listManagedIndexes()) {
        if (index.kind === 'unique' || !matchesKind(index, input.kind))
          continue
        if (!existing.has(index.name)) {
          result.skipped.push({ name: index.name, reason: 'missing' })
          continue
        }
        checkpoint()
        await statements.drop(index)
        result.dropped.push(index.name)
      }
      return result
    }),

    rebuildIndexes: (input, readOptions) => appResult(async () => {
      const checkpoint = createCheckpoint(input, readOptions)
      checkpoint()
      const vector = await readVector()
      if (input.kind === 'vector' && !vector.enabled)
        throw new ApplicationError({ code: 'VECTOR_DISABLED', message: 'Vector search is disabled; enable it before rebuilding vector indexes', retryable: false })

      const existing = await readExistingIndexes(db)
      const result: RebuildDatabaseIndexesResult = { created: [], reindexed: [], skipped: [] }
      for (const index of listManagedIndexes()) {
        if (!matchesKind(index, input.kind))
          continue
        if (index.kind === 'vector' && !vector.enabled) {
          result.skipped.push({ name: index.name, reason: 'vector-disabled' })
          continue
        }
        const state = existing.get(index.name)
        checkpoint()
        if (state?.valid) {
          if (input.missingOnly)
            continue
          await statements.reindex(index)
          result.reindexed.push(index.name)
          continue
        }
        // An interrupted CREATE INDEX CONCURRENTLY leaves an invalid index that IF NOT EXISTS would keep.
        if (state)
          await statements.drop(index)
        await statements.create(index)
        result.created.push(index.name)
      }
      return result
    }),

    getVector: (input, readOptions) => appResult(() => withReadOperation({ ...readOptions, deadlineAt: readOptions?.deadlineAt ?? input.operation?.deadlineAt }, scope => scope.wait(readVector()))),

    setVector: (input, readOptions) => appResult(async () => {
      const checkpoint = createCheckpoint(input, readOptions)
      checkpoint()
      // Store the switch first so embedding stops before the indexes go away.
      const vector = (await systemSettingsModels.setVectorSettings(db, { enabled: input.enabled })).expect('Failed to store vector settings')
      if (!input.enabled)
        return { vector, dropped: await dropVectorIndexes(db, logger, { concurrently }, checkpoint), missing: [] }

      const existing = await readExistingIndexes(db)
      const missing = listManagedIndexes()
        .filter(index => index.kind === 'vector' && !existing.get(index.name)?.valid)
        .map(index => index.name)
      return { vector, dropped: [], missing }
    }),
  }
}
