import type { MediaBinaryDescriptor, MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'

import { setMediaBinaryProvider } from '@tg-search/core'

let rootHandlePromise: Promise<FileSystemDirectoryHandle> | undefined

async function getRootDirectoryHandle() {
  if (!rootHandlePromise) {
    if (typeof navigator === 'undefined' || !('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
      throw new Error('OPFS is not available in this environment')
    }

    rootHandlePromise = navigator.storage.getDirectory()
  }

  return rootHandlePromise
}

async function ensureFileHandle(path: string) {
  const root = await getRootDirectoryHandle()

  const segments = path.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) {
    throw new Error('Invalid OPFS path')
  }

  let dir: FileSystemDirectoryHandle = root
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true })
  }

  return dir.getFileHandle(fileName, { create: true })
}

async function getFileHandle(path: string) {
  const root = await getRootDirectoryHandle()

  const segments = path.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) {
    throw new Error('Invalid OPFS path')
  }

  let dir: FileSystemDirectoryHandle = root
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: false })
  }

  return dir.getFileHandle(fileName, { create: false })
}

function buildOpfsPath(descriptor: MediaBinaryDescriptor): string {
  const segments = [
    descriptor.kind,
    descriptor.uuid,
  ]

  return segments
    .map(part => String(part).trim())
    .filter(Boolean)
    .join('/')
}

export async function registerOpfsMediaStorage() {
  const provider: MediaBinaryProvider = {
    async save(descriptor: MediaBinaryDescriptor, bytes: Uint8Array, _mimeType?: string): Promise<MediaBinaryLocation> {
      const path = buildOpfsPath(descriptor)
      const fileHandle = await ensureFileHandle(path)
      const writable = await fileHandle.createWritable()

      try {
        await writable.write(bytes as Uint8Array<ArrayBuffer>)
      }
      finally {
        await writable.close()
      }

      return {
        kind: descriptor.kind,
        path,
      }
    },

    async load(location: MediaBinaryLocation): Promise<Uint8Array | null> {
      try {
        const fileHandle = await getFileHandle(location.path)
        const file = await fileHandle.getFile()
        const buffer = await file.arrayBuffer()
        return new Uint8Array(buffer)
      }
      catch {
        return null
      }
    },
  }

  setMediaBinaryProvider(provider)
}
