import type { ColumnBaseConfig, ColumnDataType } from 'drizzle-orm'
import type { PgColumn, PgColumnBuilderBase } from 'drizzle-orm/pg-core'

import { customType } from 'drizzle-orm/pg-core'

/**
 * TSVector column type definitions
 */
export interface TSVectorColumnData extends PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object> {
  dataType: ColumnDataType
  baseType: string
}

export type TSVectorColumnBuilder = PgColumnBuilderBase<{
  name: string
  dataType: ColumnDataType
  enumValues: string[]
  data: TSVectorColumnData
  driverParam: string
  columnType: 'tsvector'
}>

/**
 * Create a tsvector column for full text search
 */
export function tsvector(name: string) {
  return customType<{ data: string }>({
    dataType: () => 'tsvector',
  })(name)
}
