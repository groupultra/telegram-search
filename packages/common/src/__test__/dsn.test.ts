import type { DatabaseConfig } from '../config-schema'

import { describe, expect, it } from 'vitest'

import { DatabaseType } from '../config-schema'
import { getDatabaseDSN, parseMinioDSN } from '../dsn'

describe('getDatabaseDSN', () => {
  it('returns the provided url when available', () => {
    const config: DatabaseConfig = {
      type: DatabaseType.POSTGRES,
      url: 'postgres://example',
    }

    expect(getDatabaseDSN(config)).toBe('postgres://example')
  })

  it('constructs a DSN string from individual fields when url is missing', () => {
    const config: DatabaseConfig = {
      type: DatabaseType.POSTGRES,
      user: 'user',
      // eslint-disable-next-line sonarjs/no-hardcoded-passwords
      password: 'pass',
      host: 'localhost',
      port: 5432,
      database: 'telegram',
    }

    expect(getDatabaseDSN(config)).toBe('postgres://user:pass@localhost:5432/telegram')
  })
})

describe('parseMinioDSN', () => {
  it('correctly parses a minio DSN with http', () => {
    const dsn = parseMinioDSN('http://localhost:9000')

    expect(dsn).toEqual({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
    })
  })

  it('correctly parses a minio DSN with https', () => {
    const dsn = parseMinioDSN('https://my-minio.example.com:443')

    expect(dsn).toEqual({
      endPoint: 'my-minio.example.com',
      port: 443,
      useSSL: true,
    })
  })

  it('correctly parses a minio DSN with https and standard port', () => {
    const dsn = parseMinioDSN('https://my-minio.example.com')

    expect(dsn).toEqual({
      endPoint: 'my-minio.example.com',
      port: 443,
      useSSL: true,
    })
  })

  it('correctly parses a minio DSN with http and standard port', () => {
    const dsn = parseMinioDSN('http://my-minio.example.com')

    expect(dsn).toEqual({
      endPoint: 'my-minio.example.com',
      port: 80,
      useSSL: false,
    })
  })

  it('throws an error if hostname is missing', () => {
    expect(() => parseMinioDSN('https://:9000')).toThrow('Invalid URL')
  })
})
