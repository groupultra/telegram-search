import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, boolean, number, object, optional, picklist, string } from 'valibot'

import { readOperationFields } from './operation'

/**
 * `vector` indexes serve embedding similarity search, `standard` indexes speed up other reads,
 * and `unique` indexes enforce integrity (sync upserts depend on them).
 */
export const databaseIndexKinds = ['vector', 'standard', 'unique'] as const
export type DatabaseIndexKind = (typeof databaseIndexKinds)[number]

export const listDatabaseIndexesInputSchema = object({
  ...readOperationFields,
  kind: optional(picklist([...databaseIndexKinds, 'all']), 'all'),
})

/** Unique indexes cannot be dropped, so `all` drops every vector and standard index. */
export const dropDatabaseIndexesInputSchema = object({
  ...readOperationFields,
  kind: picklist(['vector', 'standard', 'all']),
})

export const rebuildDatabaseIndexesInputSchema = object({
  ...readOperationFields,
  kind: picklist([...databaseIndexKinds, 'all']),
  /** Create missing or invalid indexes only; skip REINDEX of healthy ones. */
  missingOnly: optional(boolean(), false),
})

export const getVectorSettingsInputSchema = object({
  ...readOperationFields,
})

export const setVectorSettingsInputSchema = object({
  ...readOperationFields,
  enabled: boolean(),
})

export const databaseIndexStatusSchema = object({
  name: string(),
  table: string(),
  kind: picklist(databaseIndexKinds),
  method: string(),
  exists: boolean(),
  valid: boolean(),
  sizeBytes: number(),
})

export const vectorSettingsSchema = object({
  enabled: boolean(),
})

export const databaseIndexListSchema = object({
  vector: vectorSettingsSchema,
  indexes: array(databaseIndexStatusSchema),
})

const skippedIndexSchema = object({
  name: string(),
  reason: picklist(['missing', 'vector-disabled']),
})

export const dropDatabaseIndexesResultSchema = object({
  dropped: array(string()),
  skipped: array(skippedIndexSchema),
})

export const rebuildDatabaseIndexesResultSchema = object({
  created: array(string()),
  reindexed: array(string()),
  skipped: array(skippedIndexSchema),
})

export const setVectorSettingsResultSchema = object({
  vector: vectorSettingsSchema,
  /** Vector indexes dropped while disabling. */
  dropped: array(string()),
  /** Vector indexes to build with `indexes rebuild --kind vector` after enabling. */
  missing: array(string()),
})

export type ListDatabaseIndexesInput = InferOutput<typeof listDatabaseIndexesInputSchema>
export type DropDatabaseIndexesInput = InferOutput<typeof dropDatabaseIndexesInputSchema>
export type RebuildDatabaseIndexesInput = InferOutput<typeof rebuildDatabaseIndexesInputSchema>
export type GetVectorSettingsInput = InferOutput<typeof getVectorSettingsInputSchema>
export type SetVectorSettingsInput = InferOutput<typeof setVectorSettingsInputSchema>
export type DatabaseIndexStatus = InferOutput<typeof databaseIndexStatusSchema>
export type VectorSettings = InferOutput<typeof vectorSettingsSchema>
export type DatabaseIndexList = InferOutput<typeof databaseIndexListSchema>
export type DropDatabaseIndexesResult = InferOutput<typeof dropDatabaseIndexesResultSchema>
export type RebuildDatabaseIndexesResult = InferOutput<typeof rebuildDatabaseIndexesResultSchema>
export type SetVectorSettingsResult = InferOutput<typeof setVectorSettingsResultSchema>

export const databaseContracts = {
  listIndexes: defineInvokeEventa<AppResult<DatabaseIndexList>, ListDatabaseIndexesInput>('tg.v1.database.indexes.list'),
  dropIndexes: defineInvokeEventa<AppResult<DropDatabaseIndexesResult>, DropDatabaseIndexesInput>('tg.v1.database.indexes.drop'),
  rebuildIndexes: defineInvokeEventa<AppResult<RebuildDatabaseIndexesResult>, RebuildDatabaseIndexesInput>('tg.v1.database.indexes.rebuild'),
  getVector: defineInvokeEventa<AppResult<VectorSettings>, GetVectorSettingsInput>('tg.v1.database.vector.get'),
  setVector: defineInvokeEventa<AppResult<SetVectorSettingsResult>, SetVectorSettingsInput>('tg.v1.database.vector.set'),
}
