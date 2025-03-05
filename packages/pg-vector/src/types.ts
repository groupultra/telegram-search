import type { ColumnBaseConfig, ColumnDataType } from 'drizzle-orm'
import type { PgColumn, PgColumnBuilderBase } from 'drizzle-orm/pg-core'

// Vector column data
export interface VectorColumnData extends PgColumn<ColumnBaseConfig<ColumnDataType, string>, object, object> {
  dataType: ColumnDataType
  dimensions: number
  baseType: number[]
}

// Vector column builder options
export interface VectorColumnBuilderOptions {
  dimensions: number
}

// Vector column builder
export type VectorColumnBuilder = PgColumnBuilderBase<{
  name: string
  dataType: ColumnDataType
  enumValues: string[]
  data: VectorColumnData
  driverParam: number[]
  columnType: 'vector'
}>

// Vector index options
export interface VectorIndexOptions {
  lists?: number
  probes?: number
  distance?: 'l2' | 'ip' | 'cosine'
}
