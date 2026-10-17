import process from 'node:process'

import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function invoke(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const home = await mkdtemp(join(tmpdir(), 'tg-output-contract-'))
  directories.push(home)
  const environment: NodeJS.ProcessEnv = { ...process.env, TG_SEARCH_HOME: home }
  delete environment.TG_SEARCH_REMOTE_URL
  delete environment.TG_SEARCH_REMOTE_TOKEN
  Object.assign(environment, overrides)
  return spawnSync(process.execPath, [fileURLToPath(new URL('../dist/index.mjs', import.meta.url)), ...args], {
    encoding: 'utf8',
    env: environment,
    timeout: 10_000,
  })
}

describe('installed CLI output contract', () => {
  it('rejects an unknown subcommand even when help is requested (issue #682)', async () => {
    // Citty previously handled --help first and returned the parent help with exit 0.
    const result = await invoke(['auth', 'status', '--help', '--json'])
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_COMMAND', details: { availableCommands: ['login'] } } })
    expect(result.stderr).not.toContain(' at ')
  })

  it('reports missing remote credentials as a structured actionable failure', async () => {
    // Creating the remote runtime used to throw an unclassified CLI_ERROR.
    const result = await invoke(['--remote', 'https://example.invalid', 'messages', 'query', '--json'])
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'REMOTE_CREDENTIALS_MISSING', retryable: false } })
    expect(result.stderr).toBe('')
  })

  it('does not treat literal help or JSON flags as CLI controls after --', async () => {
    for (const query of ['--help', '--json=false', '--profile=literal']) {
      const result = await invoke(['--json', 'search', '--', query], { TG_SEARCH_REMOTE_URL: 'https://example.invalid' })
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'REMOTE_CREDENTIALS_MISSING' }, meta: { profile: 'default' } })
      expect(result.stderr).toBe('')
    }
  })

  it('uses a valid explicit machine format for failures before file arguments are validated', async () => {
    // Output option validation previously failed before --format could select the error envelope.
    for (const format of ['json', 'jsonl', 'compact']) {
      const result = await invoke(['messages', 'query', '--format', format, '--output-file'])
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
      expect(result.stderr).toBe('')
    }
  })

  it('uses --json as the fallback for an invalid format and ignores format literals after --', async () => {
    const invalid = await invoke(['--json', 'messages', 'query', '--format=invalid', '--output-file'])
    expect(invalid.status).toBe(1)
    expect(JSON.parse(invalid.stdout)).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(invalid.stderr).toBe('')
    const literal = await invoke(['search', '--', '--format=jsonl'], { TG_SEARCH_REMOTE_URL: 'https://example.invalid' })
    expect(literal.status).toBe(1)
    expect(literal.stdout).toBe('')
    expect(literal.stderr).toBe('REMOTE_CREDENTIALS_MISSING: Set TG_SEARCH_REMOTE_TOKEN to the server access token\n')
  })

  it('uses INVALID_ARGUMENT for parser failures', async () => {
    const result = await invoke(['profile', 'create', '--json'])
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(result.stderr).toBe('')
  })
})
