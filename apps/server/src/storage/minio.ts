import type { Logger } from '@guiiai/logg'
import type { MinioConfig } from '@tg-search/common'
import type { MediaBinaryDescriptor, MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'
import type { Result } from '@unbird/result'
import type { ClientOptions } from 'minio'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { Err, Ok } from '@unbird/result'
import { Client as MinioClient } from 'minio'

let minioClient: MinioClient | undefined
let minioMediaStorage: MediaBinaryProvider | undefined

function getMinioClient(options: ClientOptions): Result<MinioClient> {
  if (minioClient) {
    return Ok(minioClient)
  }

  if (!options?.endPoint || !options?.accessKey || !options?.secretKey) {
    return Err(new Error('MinIO configuration is incomplete; MINIO_ENDPOINT, MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required'))
  }

  const port = options.port ? options.port : undefined

  minioClient = new MinioClient({
    endPoint: options.endPoint,
    port,
    useSSL: options.useSSL,
    accessKey: options.accessKey,
    secretKey: options.secretKey,
  })

  return Ok(minioClient)
}

function buildObjectKey(descriptor: MediaBinaryDescriptor): string {
  const segments = [
    descriptor.kind,
    descriptor.uuid,
  ]

  return segments
    .map(part => String(part).trim())
    .filter(Boolean)
    .join('/')
}

export async function registerMinioMediaStorage(logger: Logger, options: ClientOptions, bucket: string) {
  const client = getMinioClient(options).expect('Failed to get MinIO client')

  try {
    const exists = await client.bucketExists(bucket)
    if (!exists) {
      logger.withFields({ bucket }).log('Creating MinIO bucket for media storage')
      await client.makeBucket(bucket)
    }
  }
  catch (error) {
    logger.withError(error).warn('Failed to ensure MinIO bucket; falling back to DB bytea for media')
    return
  }

  const provider: MediaBinaryProvider = {
    async save(descriptor: MediaBinaryDescriptor, bytes: Uint8Array, mimeType?: string): Promise<MediaBinaryLocation> {
      const objectName = buildObjectKey(descriptor)

      const buffer = Buffer.from(bytes)

      await client.putObject(bucket, objectName, buffer, undefined, {
        'Content-Type': mimeType || 'application/octet-stream',
      })

      return {
        kind: descriptor.kind,
        path: objectName,
      }
    },

    async load(location: MediaBinaryLocation): Promise<Uint8Array | null> {
      try {
        const stream = await client.getObject(bucket, location.path)
        const chunks: Buffer[] = []

        for await (const chunk of stream as AsyncIterable<Buffer>) {
          chunks.push(chunk)
        }

        if (chunks.length === 0) {
          return null
        }

        const buffer = Buffer.concat(chunks)
        return new Uint8Array(buffer)
      }
      catch (error) {
        logger.withError(error).warn('Failed to load media from MinIO; returning null')
        return null
      }
    },
  }

  logger.withFields({ bucket }).log('MinIO media storage provider registered')
  return provider
}

/**
 * Attempt to register MinIO-based media storage. When configuration is
 * incomplete or MinIO is unavailable we log a warning and gracefully
 * fall back to storing media bytes in the database.
 */
export async function initMinioMediaStorage(logger: Logger, config: MinioConfig): Promise<MediaBinaryProvider | undefined> {
  try {
    if (!config.endpoint || !config.accessKey || !config.secretKey) {
      return undefined
    }

    const options: ClientOptions = {
      endPoint: config.endpoint,
      port: config.port,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      useSSL: config.useSSL,
    }

    minioMediaStorage = await registerMinioMediaStorage(logger, options, config.bucket)
    return minioMediaStorage
  }
  catch (error) {
    logger.withError(error).warn('Failed to register MinIO media storage; falling back to DB bytea')
  }
}

export function getMinioMediaStorage(): MediaBinaryProvider | undefined {
  return minioMediaStorage
}
