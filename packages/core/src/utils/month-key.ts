const monthFormatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = monthFormatters.get(timeZone)
  if (cached)
    return cached

  const formatter = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  })
  monthFormatters.set(timeZone, formatter)
  return formatter
}

export function monthKey(timestamp: number, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(new Date(timestamp * 1000))
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value

  if (!year || !month)
    throw new Error(`Failed to format month in time zone ${timeZone}`)

  return `${year}-${month}`
}
