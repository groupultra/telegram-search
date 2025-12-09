import { describe, expect, it } from 'vitest'

import { deepClone } from './deep-clone'

describe('deepClone', () => {
  it('returns undefined when input is undefined', () => {
    expect(deepClone()).toBeUndefined()
  })

  it('produces a new object with identical data', () => {
    const source = { foo: 'bar', nested: { value: 42 } }
    const cloned = deepClone(source)

    expect(cloned).not.toBe(source)
    expect(cloned).toEqual(source)
    expect(cloned?.nested).not.toBe(source.nested)
  })

  // it('wraps JSON serialization errors with a descriptive message', () => {
  //   expect(() => deepClone(1n as unknown as Record<string, unknown>)).toThrowError('Failed to deep clone data')
  // })
})
