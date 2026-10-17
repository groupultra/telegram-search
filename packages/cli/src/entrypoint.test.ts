import process from 'node:process'

import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

it('runs the installed CLI through a symlink with spaces in its path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tg-search entrypoint '))
  try {
    const executable = join(root, 'tg-search')
    await symlink(fileURLToPath(new URL('../dist/index.mjs', import.meta.url)), executable)
    // npm and Homebrew expose symlinks; comparing the raw argv path skips main.
    const result = spawnSync(process.execPath, [executable, 'profile', 'create', 'brew-test', '--json'], {
      env: { ...process.env, TG_SEARCH_HOME: join(root, 'data') },
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, data: { profile: 'brew-test' } })
    // GramJS bundles browser storage helpers that must stay inert in Node.
    expect(result.stderr).not.toContain('localStorage')

    const invalid = spawnSync(process.execPath, [executable, 'profile', 'create', '--json'], {
      env: { ...process.env, TG_SEARCH_HOME: join(root, 'data') },
      encoding: 'utf8',
    })
    expect(invalid.status).toBe(1)
    expect(JSON.parse(invalid.stdout)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT', message: 'Missing required positional argument: NAME' },
    })

    const version = spawnSync(process.execPath, [executable, '--version', '--json'], {
      env: { ...process.env, TG_SEARCH_HOME: join(root, 'data') },
      encoding: 'utf8',
    })
    expect(version.status).toBe(0)
    expect(version.stderr).not.toContain('No command specified')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
