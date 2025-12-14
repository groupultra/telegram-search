/* eslint-disable sonarjs/no-control-regex */
/* eslint-disable no-control-regex */

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

const ANSI_ESCAPE_REGEX = /\x1B\]8;;[^\x1B]*\x1B\\(.*?)\x1B\]8;;\x1B\\/g

/**
 * Remove ANSI OSC 8 hyperlinks, e.g. \x1B]8;;file://...<text>\x1B\\<text>\x1B]8;;\x1B\\
 * Replace all hyperlink-wrapped substrings with just their visible text
 * The regex matches: \x1B]8;;<uri>\x1B\\(.*?)\x1B]8;;\x1B\\
 */
export function removeHyperLinks(text: string): string {
  return text.replace(ANSI_ESCAPE_REGEX, '$1')
}
