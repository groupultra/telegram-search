export function must0<T>(result: T[]): T {
  if (result.length === 0) {
    throw new Error('Result is empty')
  }

  return result[0]
}

export function may0<T>(result: T[]): T | undefined {
  if (result.length === 0) {
    return undefined
  }

  return result[0]
}
