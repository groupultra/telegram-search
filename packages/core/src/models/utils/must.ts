export function must0<T>(result: T[]): T | undefined {
  if (result.length === 0) {
    return undefined
  }

  return result[0]
}
