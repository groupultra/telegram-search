import type { CoreDB } from '../db'

import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { useLogger } from '@guiiai/logg'
import { migrate } from '@proj-airi/drizzle-orm-browser-migrator/pglite'
import { migrations } from '@tg-search/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { systemSettingsModels } from '../models/system-settings'
import { listManagedIndexes } from '../services/database-indexes'
import { createDatabaseAdministration, enforceVectorSettings } from './database'

const logger = useLogger('test:database-admin')

let client: PGlite
let db: CoreDB

async function indexDefinitions(): Promise<Map<string, string>> {
  const result = await db.execute(sql`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema()`)
  return new Map((result.rows as Array<{ indexname: string, indexdef: string }>).map(row => [row.indexname, row.indexdef]))
}

const vectorIndexNames = () => listManagedIndexes().filter(index => index.kind === 'vector').map(index => index.name).sort()

beforeEach(async () => {
  client = new PGlite({ extensions: { vector } })
  db = drizzle(client) as unknown as CoreDB
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`)
  await migrate(db as Parameters<typeof migrate>[0], migrations)
})

afterEach(async () => {
  await client.close()
})

describe('database index administration', () => {
  it('manages exactly the indexes the migrations create, excluding constraint indexes', async () => {
    const result = await db.execute(sql`
      SELECT c.relname AS name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema()
        AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid)
    `)
    const migrated = (result.rows as Array<{ name: string }>).map(row => row.name).sort()
    expect(listManagedIndexes().map(index => index.name).sort()).toEqual(migrated)
  })

  it('rebuilds dropped indexes with the same definitions the migrations produced', async () => {
    const admin = createDatabaseAdministration({ db, logger })
    const before = await indexDefinitions()

    const dropped = await admin.dropIndexes({ kind: 'all' })
    expect(dropped.ok).toBe(true)
    const after = await indexDefinitions()
    // Unique indexes back sync upserts and must survive `drop --kind all`.
    for (const index of listManagedIndexes())
      expect(after.has(index.name), index.name).toBe(index.kind === 'unique')

    const rebuilt = await admin.rebuildIndexes({ kind: 'all', missingOnly: true })
    expect(rebuilt).toMatchObject({ ok: true, data: { reindexed: [], skipped: [] } })
    expect(await indexDefinitions()).toEqual(before)

    const repeated = await admin.dropIndexes({ kind: 'standard' })
    expect(repeated.ok && repeated.data.dropped.length).toBeGreaterThan(0)
    const again = await admin.dropIndexes({ kind: 'standard' })
    expect(again.ok && again.data).toMatchObject({ dropped: [] })
    expect(again.ok && again.data.skipped.every(skip => skip.reason === 'missing')).toBe(true)
  })

  it('reindexes healthy indexes unless only missing ones are requested', async () => {
    const admin = createDatabaseAdministration({ db, logger })
    const result = await admin.rebuildIndexes({ kind: 'standard', missingOnly: false })
    expect(result.ok && result.data.created).toEqual([])
    expect(result.ok && result.data.reindexed.sort()).toEqual(listManagedIndexes().filter(index => index.kind === 'standard').map(index => index.name).sort())
  })

  it('reports existence and size for each requested kind', async () => {
    const admin = createDatabaseAdministration({ db, logger })
    const listed = await admin.listIndexes({ kind: 'vector' })
    expect(listed.ok).toBe(true)
    if (!listed.ok)
      return
    expect(listed.data.vector).toEqual({ enabled: true })
    expect(listed.data.indexes.map(index => index.name).sort()).toEqual(vectorIndexNames())
    expect(listed.data.indexes.every(index => index.exists && index.valid && index.sizeBytes > 0)).toBe(true)
  })

  it('disabling vector search drops vector indexes and keeps them dropped', async () => {
    const admin = createDatabaseAdministration({ db, logger })

    const disabled = await admin.setVector({ enabled: false })
    expect(disabled).toEqual({ ok: true, data: { vector: { enabled: false }, dropped: expect.any(Array), missing: [] } })
    expect(disabled.ok && disabled.data.dropped.sort()).toEqual(vectorIndexNames())
    expect((await systemSettingsModels.getVectorSettings(db)).expect('read settings')).toEqual({ enabled: false })

    const definitions = await indexDefinitions()
    expect(vectorIndexNames().some(name => definitions.has(name))).toBe(false)

    expect(await admin.rebuildIndexes({ kind: 'vector', missingOnly: false })).toMatchObject({ ok: false, error: { code: 'VECTOR_DISABLED' } })
    const all = await admin.rebuildIndexes({ kind: 'all', missingOnly: true })
    expect(all.ok && all.data.skipped.map(skip => skip.reason)).toEqual(vectorIndexNames().map(() => 'vector-disabled'))
    expect(all.ok && all.data.created).toEqual([])

    // A later migration could create a vector index again; startup enforcement removes it.
    const recreated = listManagedIndexes().find(index => index.kind === 'vector')!
    await db.execute(sql.raw(recreated.createStatement({ concurrently: false })))
    await enforceVectorSettings(db, logger, { concurrently: false })
    expect((await indexDefinitions()).has(recreated.name)).toBe(false)
  })

  it('enabling vector search reports the indexes to rebuild', async () => {
    const admin = createDatabaseAdministration({ db, logger })
    await admin.setVector({ enabled: false })

    const enabled = await admin.setVector({ enabled: true })
    expect(enabled.ok && enabled.data.missing.sort()).toEqual(vectorIndexNames())

    const rebuilt = await admin.rebuildIndexes({ kind: 'vector', missingOnly: true })
    expect(rebuilt.ok && rebuilt.data.created.sort()).toEqual(vectorIndexNames())
    const listed = await admin.listIndexes({ kind: 'vector' })
    expect(listed.ok && listed.data.indexes.every(index => index.exists && index.valid)).toBe(true)
  })

  it('stops before running DDL once the deadline has passed', async () => {
    const admin = createDatabaseAdministration({ db, logger })
    const result = await admin.dropIndexes({ kind: 'all', operation: { deadlineAt: Date.now() - 1 } })
    expect(result).toMatchObject({ ok: false, error: { code: 'REQUEST_DEADLINE_EXCEEDED' } })
    const definitions = await indexDefinitions()
    expect(listManagedIndexes().every(index => definitions.has(index.name))).toBe(true)
  })
})
