export function parseDate(date: Date | undefined): number {
  if (!date) {
    return 0
  }
  // Validate it's actually a Date object
  if (!(date instanceof Date)) {
    return 0
  }
  const timestamp = date.getTime()
  // Validate the timestamp is a valid number
  if (Number.isNaN(timestamp) || !Number.isFinite(timestamp)) {
    return 0
  }
  return timestamp
}
