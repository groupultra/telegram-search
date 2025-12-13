import type { MediaBinaryProvider } from '../types/storage'

let mediaBinaryProvider: MediaBinaryProvider | undefined

export function setMediaBinaryProvider(provider: MediaBinaryProvider | undefined) {
  mediaBinaryProvider = provider
}

export function getMediaBinaryProvider(): MediaBinaryProvider | undefined {
  return mediaBinaryProvider
}
