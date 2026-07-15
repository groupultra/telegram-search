#!/usr/bin/env node

import process from 'node:process'

import { spawnSync } from 'node:child_process'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../../../..')
const cliPath = join(repoRoot, 'packages/cli/dist/index.mjs')

class CanaryBlockedError extends Error {}

function parseArgs(raw) {
  const values = { discover: false, takeout: false }
  const remaining = [...raw]
  while (remaining.length > 0) {
    const argument = remaining.shift()
    if (argument === '--discover' || argument === '--takeout') {
      values[argument.slice(2)] = true
      continue
    }
    const value = remaining.shift()
    if (!argument?.startsWith('--') || !value)
      throw new Error(`Invalid argument: ${argument}`)
    values[argument.slice(2)] = value
  }
  return values
}

function timestampSlug() {
  return new Date().toISOString().replaceAll(':', '').replaceAll('.', '-')
}

async function writePrivate(path, content) {
  await writeFile(path, content, { mode: 0o600 })
  await chmod(path, 0o600)
}

function parseEnvelope(stdout, stage) {
  const lines = stdout.trim().split('\n').filter(Boolean)
  if (lines.length !== 1)
    throw new Error(`${stage} emitted ${lines.length} stdout lines; expected one JSON envelope`)
  const envelope = JSON.parse(lines[0])
  if (envelope?.ok !== true)
    throw new Error(`${stage} returned a non-success envelope`)
  return envelope.data
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.profile)
    throw new Error('--profile is required')

  const evidenceDir = resolve(args.output ?? join('/tmp', `telegram-search-cli-e2e-${timestampSlug()}`))
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 })
  await chmod(evidenceDir, 0o700)

  const summary = {
    version: 2,
    status: 'running',
    profile: args.profile,
    chatId: args.chat,
    from: args.from,
    to: args.to,
    evidenceDir,
    stages: {},
  }

  const persistSummary = () => writePrivate(join(evidenceDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)

  async function run(stage, commandArgs) {
    const result = spawnSync(process.execPath, [cliPath, `--profile=${args.profile}`, ...commandArgs], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 32 * 1024 * 1024,
    })
    await writePrivate(join(evidenceDir, `${stage}.stdout.json`), result.stdout || '')
    await writePrivate(join(evidenceDir, `${stage}.stderr.log`), result.stderr || '')
    if (result.error)
      throw new Error(`${stage} could not start: ${result.error.message}`)
    if (result.status !== 0) {
      if (/credentials are missing|session is missing|session is no longer authorized/u.test(result.stderr))
        throw new CanaryBlockedError(`${stage} requires a configured and authorized local Telegram profile`)
      throw new Error(`${stage} exited with status ${result.status}; inspect its local stderr evidence`)
    }
    const data = parseEnvelope(result.stdout, stage)
    summary.stages[stage] = { passed: true }
    await persistSummary()
    return data
  }

  try {
    if (!args.discover && args.chat) {
      if (!args.from || !args.to)
        throw new Error('--from and --to are required for a bounded canary')
      if (!args.takeout)
        throw new CanaryBlockedError('Explicit user-approved --takeout is required before the canary may persist messages')
    }

    const chats = await run('chats', ['chats', 'list', '--limit', '100'])
    summary.stages.chats.count = chats.items?.length ?? 0
    if (summary.stages.chats.count === 0)
      throw new CanaryBlockedError('No remote chats were returned')

    if (args.discover || !args.chat) {
      summary.status = 'discovery-complete'
      await persistSummary()
      process.stdout.write(`${JSON.stringify({ status: summary.status, chatCount: summary.stages.chats.count, evidenceDir })}\n`)
      return
    }

    const rangeArgs = ['--chat', args.chat, '--from', args.from, '--to', args.to]
    const remote = await run('remote-messages', ['messages', 'list', ...rangeArgs, '--limit', '20'])
    summary.stages['remote-messages'].count = remote.items?.length ?? 0
    if (summary.stages['remote-messages'].count === 0)
      throw new CanaryBlockedError('The selected remote chat/time range contained no messages')

    const sync = await run('sync', ['sync', '--takeout', ...rangeArgs, '--limit', '200'])
    summary.stages.sync.processed = sync.processed ?? 0
    if (sync.type !== 'completed' || sync.processed < 1)
      throw new Error(`Sync did not complete with persisted messages (type=${sync.type}, processed=${sync.processed ?? 0})`)

    const local = await run('local-query', ['messages', 'query', ...rangeArgs, '--limit', '20'])
    summary.stages['local-query'].count = local.items?.length ?? 0
    if (summary.stages['local-query'].count === 0)
      throw new Error('Local query did not return the synced messages')

    const target = local.items.find(item => typeof item.id === 'string')
    if (!target)
      throw new Error('Local query returned no usable message ID')
    const context = await run('context', ['context', '--chat', args.chat, '--message', target.id, '--before', '2', '--after', '2'])
    summary.stages.context.count = context.messages?.length ?? 0
    summary.stages.context.targetFound = Number.isInteger(context.targetIndex) && context.targetIndex >= 0
    if (!summary.stages.context.targetFound)
      throw new Error('Local context did not contain its requested target')

    const searchable = local.items.find(item => typeof item.text === 'string' && item.text.trim().length > 0)
    if (!searchable)
      throw new Error('No synced text message was available for local search')
    const query = searchable.text.trim().slice(0, 256)
    const search = await run('search', ['search', query, '--chat', args.chat, '--from', args.from, '--to', args.to, '--limit', '20'])
    summary.stages.search.count = search.items?.length ?? 0
    if (summary.stages.search.count === 0)
      throw new Error('Local search did not find text copied from a synced message')

    const stats = await run('stats', ['stats', '--groupBy', 'month', ...rangeArgs])
    summary.stages.stats.total = stats.total ?? 0
    if (stats.total < 1)
      throw new Error('Local stats reported zero synced messages')

    const exportDir = join(evidenceDir, 'export')
    const exported = await run('export', ['export', ...rangeArgs, '--format', 'jsonl', '--output', exportDir])
    summary.stages.export.exported = exported.exported ?? 0
    if (exported.type !== 'completed' || exported.exported < 1)
      throw new Error('Export did not complete with at least one message')
    const manifest = JSON.parse(await readFile(join(exportDir, 'manifest.json'), 'utf8'))
    summary.stages.export.manifestExported = manifest.exported
    summary.stages.export.files = manifest.files?.length ?? 0
    if (manifest.exported !== exported.exported || summary.stages.export.files < 1)
      throw new Error('Export manifest is inconsistent with the completed event')

    summary.status = 'passed'
    await persistSummary()
    process.stdout.write(`${JSON.stringify({ status: summary.status, evidenceDir, stages: summary.stages })}\n`)
  }
  catch (error) {
    summary.status = error instanceof CanaryBlockedError ? 'blocked' : 'failed'
    summary.error = error instanceof Error ? error.message : String(error)
    await persistSummary()
    process.stderr.write(`${summary.error}\n`)
    process.stderr.write(`Evidence: ${evidenceDir}\n`)
    process.exitCode = 1
  }
}

await main()
