import type { DatabaseConfig } from './config-schema'

import { describe, expect, it } from 'vitest'

import { DatabaseType } from './config-schema'
import { getDatabaseDSN } from './dsn'

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
