export function deepClone<T>(data?: T): T | undefined {
  if (!data)
    return data

  try {
    return JSON.parse(JSON.stringify(data)) as T
  }
  catch (error) {
    throw new Error('Failed to deep clone data', { cause: error })
  }
}
