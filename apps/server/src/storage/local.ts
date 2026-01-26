import type { Logger } from '@guiiai/logg'
import type { MediaConfig } from '@tg-search/common'
import type { MediaBinaryDescriptor, MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'

import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { useDataPath } from '@tg-search/common/node'
import { dirname, join, posix, resolve, sep } from 'pathe'

const DEFAULT_MEDIA_DIR = resolve(useDataPath(), 'media')

let localMediaStorage: MediaBinaryProvider | undefined

function buildRelativePath(descriptor: MediaBinaryDescriptor): string {
  return posix.join(descriptor.kind, descriptor.uuid)
}

function resolveLocationPath(baseDir: string, locationPath: string): string | null {
  const root = resolve(baseDir)
  const resolved = resolve(baseDir, locationPath)

  if (resolved === root || resolved.startsWith(`${root}${sep}`)) {
    return resolved
  }

  return null
}

export async function initLocalMediaStorage(logger: Logger, config?: MediaConfig): Promise<MediaBinaryProvider | undefined> {
  const baseDir = config?.dir ? resolve(config.dir) : DEFAULT_MEDIA_DIR

  try {
    await mkdir(baseDir, { recursive: true })
  }
  catch (error) {
    logger.withError(error).warn('Failed to ensure local media directory; falling back to database storage for media')
    return undefined
  }

  const provider: MediaBinaryProvider = {
    async save(descriptor: MediaBinaryDescriptor, bytes: Uint8Array, _mimeType?: string): Promise<MediaBinaryLocation> {
      const relativePath = buildRelativePath(descriptor)
      const absolutePath = join(baseDir, relativePath)

      await mkdir(dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, bytes)

      return {
        kind: descriptor.kind,
        path: relativePath,
      }
    },

    async load(location: MediaBinaryLocation): Promise<Uint8Array | null> {
      const resolvedPath = resolveLocationPath(baseDir, location.path)
      if (!resolvedPath) {
        logger.withFields({ path: location.path }).warn('Rejected local media path outside base directory')
        return null
      }

      try {
        const buffer = await readFile(resolvedPath)
        return new Uint8Array(buffer)
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
          return null
        }

        logger.withError(error).warn('Failed to load media from local storage; returning null')
        return null
      }
    },
  }

  localMediaStorage = provider
  logger.withFields({ baseDir }).log('Local media storage provider registered')
  return provider
}

export function getLocalMediaStorage(): MediaBinaryProvider | undefined {
  return localMediaStorage
}
