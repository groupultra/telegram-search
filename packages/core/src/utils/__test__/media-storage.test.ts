import type { MediaBinaryProvider } from '../../types/storage'

import { describe, expect, it } from 'vitest'

import { getMediaBinaryProvider, setMediaBinaryProvider } from '../media-storage'

describe('utils/media-storage', () => {
  it('setMediaBinaryProvider and getMediaBinaryProvider should store and return the same instance', () => {
    const mockProvider = {} as unknown as MediaBinaryProvider

    setMediaBinaryProvider(mockProvider)

    expect(getMediaBinaryProvider()).toBe(mockProvider)
  })

  it('setMediaBinaryProvider should support resetting to undefined', () => {
    setMediaBinaryProvider(undefined)
    expect(getMediaBinaryProvider()).toBeUndefined()
  })
})
