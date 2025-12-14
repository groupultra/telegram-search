const CAMEL_CASE_REGEX = /([A-Z])/g
const HYPHEN_REGEX = /-/g

/**
 * Convert fields to snake_case before emitting
 */
export function toSnakeCaseFields(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key))
      continue
    const snakeKey = key.replace(CAMEL_CASE_REGEX, '_$1').replace(HYPHEN_REGEX, '_').toLowerCase()
    result[snakeKey] = obj[key]
  }
  return result
}
