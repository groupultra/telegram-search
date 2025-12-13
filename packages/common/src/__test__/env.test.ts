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
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'access',
      MINIO_SECRET_KEY: 'secret',
      MINIO_USE_SSL: 'false',
      MINIO_BUCKET: 'telegram-media',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4317',
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const config = parseEnvToConfig(env)

    expect(config.database?.url).toBe('postgres://user:pass@host:5432/db')
    expect(config.api?.telegram?.apiId).toBe('12345')
    expect(config.api?.telegram?.apiHash).toBe('hash')
    expect(config.api?.telegram?.proxy?.MTProxy).toBe(true)
    expect(config.api?.telegram?.proxy?.proxyUrl).toBe('socks5://proxy')
    expect(config.minio?.endpoint).toBe('localhost')
    expect(config.minio?.port).toBe(9000)
    expect(config.minio?.accessKey).toBe('access')
    expect(config.minio?.secretKey).toBe('secret')
    expect(config.minio?.useSSL).toBe(false)
    expect(config.minio?.bucket).toBe('telegram-media')
    expect(config.otel?.endpoint).toBe('http://localhost:4317')

    consoleSpy.mockRestore()
  })
})

describe('mergeConfigWithEnv', () => {
  it('prefers existing config values and fills missing ones from env-derived config', () => {
    const existingConfig: Config = {
      database: { url: 'postgres://override', type: DatabaseType.POSTGRES },
      minio: {
        endpoint: 'localhost',
        port: 9000,
        accessKey: 'access',
        secretKey: 'secret',
        useSSL: false,
        bucket: 'telegram-media',
      },
      api: {
        telegram: {
          apiId: 'from-config',
        },
      },
      otel: {},
    }

    const env = createEnv({
      DATABASE_URL: 'postgres://env',
      TELEGRAM_API_HASH: 'hash-from-env',
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const merged = mergeConfigWithEnv(env, existingConfig)

    expect(merged.database?.url).toBe('postgres://override')
    expect(merged.minio?.endpoint).toBe('localhost')
    expect(merged.minio?.port).toBe(9000)
    expect(merged.minio?.accessKey).toBe('access')
    expect(merged.minio?.secretKey).toBe('secret')
    expect(merged.minio?.useSSL).toBe(false)
    expect(merged.minio?.bucket).toBe('telegram-media')
    expect(merged.api?.telegram?.apiId).toBe('from-config')
    expect(merged.api?.telegram?.apiHash).toBe('hash-from-env')

    consoleSpy.mockRestore()
  })
})
