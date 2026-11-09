import type { EventContext } from '@moeru/eventa'

import type { DatabaseAdministration } from '../application/database'

import { defineInvokeHandlers } from '@moeru/eventa'
import {
  databaseContracts,
  dropDatabaseIndexesInputSchema,
  getVectorSettingsInputSchema,
  listDatabaseIndexesInputSchema,
  rebuildDatabaseIndexesInputSchema,
  setVectorSettingsInputSchema,
} from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'
import { readOperationOptions } from './read-options'

function validated<TInput, TOutput>(schema: Parameters<typeof safeParse>[0], input: unknown, operation: (input: TInput) => Promise<TOutput>) {
  const parsed = safeParse(schema, input)
  return parsed.success
    ? operation(parsed.output as TInput)
    : invalidArgument('Invalid database input', { issues: parsed.issues })
}

export function registerDatabaseHandlers(context: EventContext<any, any>, database: DatabaseAdministration) {
  const disposers = defineInvokeHandlers(context, databaseContracts, {
    listIndexes: (input, options) => validated(listDatabaseIndexesInputSchema, input, parsed => database.listIndexes(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    dropIndexes: (input, options) => validated(dropDatabaseIndexesInputSchema, input, parsed => database.dropIndexes(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    rebuildIndexes: (input, options) => validated(rebuildDatabaseIndexesInputSchema, input, parsed => database.rebuildIndexes(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    getVector: (input, options) => validated(getVectorSettingsInputSchema, input, parsed => database.getVector(parsed as typeof input, readOperationOptions(context.signal, input, options))),
    setVector: (input, options) => validated(setVectorSettingsInputSchema, input, parsed => database.setVector(parsed as typeof input, readOperationOptions(context.signal, input, options))),
  })
  return () => {
    for (const dispose of Object.values(disposers))
      dispose()
  }
}
