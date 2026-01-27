import type { DateRange, DateValue } from 'reka-ui'

import { fromDate, getLocalTimeZone } from '@internationalized/date'
import { format } from 'date-fns'
import { toDate } from 'reka-ui/date'

// NOTE:
// reka-ui depends on @internationalized/date internally.
// Even on the same version, structural typing can fail due to private fields.
// We keep the casts inside this adapter so component code stays clean.
export const defaultTimeZone = getLocalTimeZone()

export function normalizeTimestampMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return undefined
}

export function toDateRange(start: unknown, end: unknown, timeZone: string = defaultTimeZone): DateRange {
  const startMs = normalizeTimestampMs(start)
  const endMs = normalizeTimestampMs(end)
  const startDate = startMs ? new Date(startMs) : undefined
  const endDate = endMs ? new Date(endMs) : undefined
  return {
    start: startDate ? (fromDate(startDate, timeZone) as unknown as DateValue) : undefined,
    end: endDate ? (fromDate(endDate, timeZone) as unknown as DateValue) : undefined,
  }
}

export function sameDateValue(a?: DateValue, b?: DateValue): boolean {
  if (!a && !b)
    return true
  if (!a || !b)
    return false
  return a.toString() === b.toString()
}

export function sameRange(a: DateRange, b: DateRange): boolean {
  return sameDateValue(a?.start, b?.start) && sameDateValue(a?.end, b?.end)
}

export function toTimestampMs(value: DateValue | undefined, timeZone: string = defaultTimeZone): number | undefined {
  if (!value)
    return undefined
  try {
    const parsed = toDate(value as DateValue, timeZone)
    const ms = parsed.getTime()
    return Number.isNaN(ms) ? undefined : ms
  }
  catch {
    return undefined
  }
}

export function formatRangeLabel(range: DateRange, timeZone: string = defaultTimeZone): string {
  const startMs = toTimestampMs(range.start, timeZone)
  const endMs = toTimestampMs(range.end, timeZone)
  const start = startMs ? new Date(startMs) : undefined
  const end = endMs ? new Date(endMs) : undefined
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd HH:mm')

  if (!start && !end)
    return '—'
  if (start && !end)
    return `${fmt(start)} → …`
  if (!start && end)
    return `… → ${fmt(end)}`
  return `${fmt(start!)} → ${fmt(end!)}`
}
