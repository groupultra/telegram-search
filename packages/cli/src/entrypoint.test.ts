import process from 'node:process'

import { execFileSync } from 'node:child_process'
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
    const output = execFileSync(process.execPath, [executable, 'profile', 'create', 'brew-test'], {
      env: { ...process.env, TG_SEARCH_HOME: join(root, 'data') },
      encoding: 'utf8',
    })
    expect(JSON.parse(output)).toMatchObject({ ok: true, data: { profile: 'brew-test' } })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
