import process from 'node:process'

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname } from 'node:path'

import { normalizeRemoteUrl } from '@tg-search/protocol'
import { vi } from 'vitest'

import { resolveProfilePaths } from './profile'

/**
 * Test-only: stores a non-expiring access token for `endpoint` in the profile,
 * as `tgs remote login` would. Creates an isolated TG_SEARCH_HOME when the test
 * has not set one.
 */
export async function useRemoteToken(endpoint: string, accessToken: string, profile = 'default'): Promise<string> {
  let home = process.env.TG_SEARCH_HOME
  if (home === undefined) {
    home = await mkdtemp(`${tmpdir()}/tg-remote-token-`)
    vi.stubEnv('TG_SEARCH_HOME', home)
  }
  const paths = resolveProfilePaths(profile)
  await mkdir(dirname(paths.remoteToken), { recursive: true, mode: 0o700 })
  await writeFile(paths.remoteToken, JSON.stringify({ endpoint: normalizeRemoteUrl(endpoint), accessToken, expiresAt: Number.MAX_SAFE_INTEGER, scopes: [] }), { mode: 0o600 })
  return home
}
