import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import envPaths from 'env-paths'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureProfile, profilesRoot, readProfileConfig, resolveProfilePaths, updateProfileConfig, writeSession } from './profile'

afterEach(() => {
  delete process.env.TG_SEARCH_HOME
})

describe('named profiles', () => {
  it('uses the operating system application data directory by default', () => {
    delete process.env.TG_SEARCH_HOME

    expect(profilesRoot()).toBe(envPaths('telegram-search', { suffix: '' }).data)
  })

  it('uses default and isolates named profile paths', () => {
    process.env.TG_SEARCH_HOME = join(tmpdir(), 'tg-search-profile-test')
    const defaultProfile = resolveProfilePaths()
    const workProfile = resolveProfilePaths('work')

    expect(defaultProfile.root).toContain('/default')
    expect(workProfile.database).not.toBe(defaultProfile.database)
    expect(workProfile.daemon).not.toBe(defaultProfile.daemon)
    expect(workProfile.daemonLock).toContain('/work/')
  })

  it('rejects path traversal names', () => {
    expect(() => resolveProfilePaths('../other')).toThrow()
  })

  it('stores sessions with mode 0600', async () => {
    process.env.TG_SEARCH_HOME = join(tmpdir(), `tg-search-profile-${Date.now()}`)
    const paths = await ensureProfile('secure')
    await writeSession(paths, 'secret')

    expect((await stat(paths.session)).mode & 0o777).toBe(0o600)
  })

  it('keeps every field when config updates overlap', async () => {
    // Cause: each writer spread a snapshot it read earlier, so the later write
    // dropped the field the earlier one had just stored.
    process.env.TG_SEARCH_HOME = await mkdtemp(join(tmpdir(), 'tg-search-profile-update-'))
    try {
      const paths = await ensureProfile('work')

      await Promise.all([
        updateProfileConfig(paths, latest => ({ ...latest, accountId: 'account-1' })),
        updateProfileConfig(paths, latest => ({ ...latest, apiId: '1', apiHash: 'hash' })),
        updateProfileConfig(paths, latest => ({ ...latest, remoteUrl: 'https://tgs.example.test' })),
      ])

      await expect(readProfileConfig(paths)).resolves.toEqual({ accountId: 'account-1', apiId: '1', apiHash: 'hash', remoteUrl: 'https://tgs.example.test' })
      expect((await stat(paths.config)).mode & 0o777).toBe(0o600)
      // Atomic writes leave no temporary files in the profile.
      expect((await readdir(paths.root)).sort()).toEqual(['config.json', 'exports'])
    }
    finally {
      await rm(process.env.TG_SEARCH_HOME, { recursive: true, force: true })
    }
  })
})
