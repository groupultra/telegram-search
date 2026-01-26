import type { Config } from '../config-schema'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatabaseType } from '../config-schema'
import {
  mergeConfigWithEnv,
  parseEnvToConfig,
  readBooleanEnv,
  readEnvValue,
  readIntegerEnv,
  readStringEnv,
} from '../env'

const createEnv = (entries: Record<string, string | undefined>) => entries

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readEnvValue helpers', () => {
  it('normalizes casing and trims whitespace', () => {
    const env = createEnv({
      TELEGRAM_API_ID: ' 12345 ',
      telegram_api_hash: 'abc',
      VITE_TELEGRAM_API_ID: '   ',
    })

    expect(readEnvValue('telegram_api_id', env)).toBe('12345')
    expect(readEnvValue('TELEGRAM_API_HASH', env)).toBe('abc')
    expect(readEnvValue('VITE_TELEGRAM_API_ID', env)).toBeUndefined()
    expect(readEnvValue('MISSING_KEY', env)).toBeUndefined()
  })

  it('interprets boolean strings against a known allow list', () => {
    expect(readBooleanEnv('PROXY_MT_PROXY', createEnv({ PROXY_MT_PROXY: 'Yes' }))).toBe(true)
    expect(readBooleanEnv('PROXY_MT_PROXY', createEnv({ PROXY_MT_PROXY: '0' }))).toBe(false)
    expect(readBooleanEnv('MISSING', createEnv({}))).toBe(false)
  })

  it('parses integers using base10 semantics and ignores invalid values', () => {
    expect(readIntegerEnv('LIMIT', createEnv({ LIMIT: '10' }))).toBe(10)
    expect(readIntegerEnv('LIMIT', createEnv({ LIMIT: '10.5' }))).toBe(10)
    expect(readIntegerEnv('LIMIT', createEnv({ LIMIT: 'abc' }))).toBeUndefined()
    expect(readIntegerEnv('LIMIT', createEnv({}))).toBeUndefined()
  })

  it('returns the first matching string key across candidates', () => {
    const env = createEnv({ PRIMARY: undefined, SECONDARY: 'value' })
    expect(readStringEnv(['PRIMARY', 'SECONDARY'], env)).toBe('value')
    expect(readStringEnv(['UNKNOWN'], env)).toBeUndefined()
  })
})

describe('parseEnvToConfig', () => {
  it('builds a Config object from relevant environment variables', () => {
    const env = createEnv({
      DATABASE_URL: 'postgres://user:pass@host:5432/db',
      TELEGRAM_API_ID: '12345',
      TELEGRAM_API_HASH: 'hash',
      PROXY_MT_PROXY: 'true',
      PROXY_URL: 'socks5://proxy',
      MINIO_URL: 'access',
      MINIO_ACCESS_KEY: 'access',
      MINIO_SECRET_KEY: 'secret',
      MINIO_BUCKET: 'telegram-media',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
    })
    // Suppress console.warn for deprecated MINIO keys, if any
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const config = parseEnvToConfig(env)
    warnSpy.mockRestore()

    expect(config.database?.url).toBe('postgres://user:pass@host:5432/db')
    expect(config.api?.telegram?.apiId).toBe('12345')
    expect(config.api?.telegram?.apiHash).toBe('hash')
    expect(config.api?.telegram?.proxy?.MTProxy).toBe(true)
    expect(config.api?.telegram?.proxy?.proxyUrl).toBe('socks5://proxy')
    expect(config.minio?.url).toBe('access')
    expect(config.minio?.accessKey).toBe('access')
    expect(config.minio?.secretKey).toBe('secret')
    expect(config.minio?.bucket).toBe('telegram-media')
  })

  it('sets minio.url using deprecated endPoint and port if provided, and logs a warning', () => {
    const env = createEnv({
      MINIO_ENDPOINT: 'minio.example.com',
      MINIO_PORT: '1234',
      MINIO_USE_SSL: 'true',
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Patch a logger to capture warn
    const logger = {
      withFields: vi.fn(() => ({
        warn: warnSpy,
        log: vi.fn(),
      })),
    }

    const config = parseEnvToConfig(env, logger as any)

    // It should prefer https in url because useSSL is true in this case.
    expect(config.minio?.url).toBe('https://minio.example.com:1234')

    // Confirm warn was called for deprecation. (cannot access log text, but warn must be called)
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})

describe('mergeConfigWithEnv', () => {
  it('prefers existing config values and fills missing ones from env-derived config', () => {
    const existingConfig: Config = {
      database: { url: 'postgres://override', type: DatabaseType.POSTGRES },
      minio: {
        url: 'http://localhost:9000',
        accessKey: 'access',
        secretKey: 'secret',
        bucket: 'telegram-media',

        port: 9000,
        useSSL: false,
        endPoint: 'http://localhost:9000',
      },
      api: {
        telegram: {
          apiId: 'from-config',
        },
      },
      media: {
        dir: 'data/media',
      },
    }

    const env = createEnv({
      DATABASE_URL: 'postgres://env',
      TELEGRAM_API_HASH: 'hash-from-env',
    })
    // Suppress console.warn for deprecated MINIO keys, if any
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const merged = mergeConfigWithEnv(env, existingConfig)

    warnSpy.mockRestore()

    expect(merged.database?.url).toBe('postgres://override')
    expect(merged.minio?.url).toBe('http://localhost:9000')
    expect(merged.minio?.accessKey).toBe('access')
    expect(merged.minio?.secretKey).toBe('secret')
    expect(merged.minio?.bucket).toBe('telegram-media')
    expect(merged.api?.telegram?.apiId).toBe('from-config')
    expect(merged.api?.telegram?.apiHash).toBe('hash-from-env')
  })
})
