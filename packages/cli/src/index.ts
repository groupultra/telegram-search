import type { AppError, AppResult } from '@tg-search/protocol'
import type { CommandDef } from 'citty'

import type { OutputMeta } from './output'

import process from 'node:process'

import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'

import { toAppError } from '@tg-search/core'
import { normalizeRemoteUrl } from '@tg-search/protocol'
import { defineCommand, runCommand, runMain } from 'citty'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

import { closeOwnedTelegramClient, createAuthPrompts, shouldStopAuthFlow } from './auth-support'
import { CLI_VERSION, runtimeBuildInfo } from './build-info'
import { cliError, toCliError } from './cli-errors'
import { connectDaemon, runDaemon, stopDaemon } from './daemon'
import { createGramJsStderrLogger } from './gramjs-logger'
import { hasWrittenOutput, isJsonOutput, resetOutputState, writeFailure, writeOutput, writeProgress } from './output'
import {
  ensureProfile,
  listProfiles,
  readProfileConfig,
  resolveProfilePaths,
  writeProfileConfig,
  writeSession,
} from './profile'
import { inspectProfile } from './profile-inspection'
import { bindReadOperations } from './read-runtime'
import { initialOutputFormat, readOutputArgs, readOutputOptions } from './read-output'
import { createRemoteRuntime } from './remote'
import { createCliRuntime } from './runtime'
import { CLI_TELEGRAM_CLIENT_OPTIONS } from './telegram-client-options'

const profileArg = {
  'timeout-ms': { type: 'string' as const, default: '60000', description: 'Read deadline in milliseconds' },
  'profile': { type: 'string' as const, default: 'default' },
  'remote': { type: 'string' as const, description: 'Remote TGS URL (HTTPS)' },
  'json': { type: 'boolean' as const, default: false, description: 'Write a machine-readable JSON envelope' },
}

function profileFrom(context: { args: object }): string {
  const profile = (context.args as { profile?: unknown }).profile
  return typeof profile === 'string' ? profile : 'default'
}

function stringArg(value: string | boolean | string[] | undefined): string {
  if (typeof value === 'string')
    return value
  if (Array.isArray(value))
    return value.at(-1) ?? ''
  return ''
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value)
    return undefined
  const numeric = Number(value)
  if (Number.isFinite(numeric))
    return numeric
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds))
    throw cliError({ code: 'INVALID_ARGUMENT', message: `Invalid date: ${value}`, retryable: false })
  return Math.floor(milliseconds / 1000)
}

function parseChatIds(value: string | undefined): string[] | undefined {
  const ids = value?.split(',').map(item => item.trim()).filter(Boolean)
  return ids?.length ? ids : undefined
}

export function resolveExportOutputPath(output: string | undefined, defaultPath: string): string {
  return output ? resolve(output) : defaultPath
}

type CommandRuntime = ReturnType<typeof createRemoteRuntime> | Awaited<ReturnType<typeof createCliRuntime>> | NonNullable<Awaited<ReturnType<typeof connectDaemon>>>

async function withRuntime<T>(command: { args: object }, remote: boolean, operation: (runtime: CommandRuntime) => Promise<T>): Promise<T | undefined> {
  const profile = profileFrom(command)
  const args = command.args as { 'remote'?: string, 'timeout-ms'?: string }
  const timeoutMs = Number(args['timeout-ms'] ?? 60_000)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647)
    throw new Error('--timeout-ms must be an integer between 1 and 2147483647')
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.once('SIGINT', cancel)
  process.once('SIGTERM', cancel)
  const options = { signal: controller.signal, deadlineAt: Date.now() + timeoutMs }
  const run = (runtime: CommandRuntime) => operation(bindReadOperations(runtime, options))
  const cleanup = () => {
    process.off('SIGINT', cancel)
    process.off('SIGTERM', cancel)
  }
  try {
    const paths = resolveProfilePaths(profile)
    const config = await readProfileConfig(paths)
    const endpoint = args.remote ?? process.env.TG_SEARCH_REMOTE_URL ?? config.remoteUrl
    if (endpoint !== undefined) {
      const runtime = createRemoteRuntime(endpoint, process.env.TG_SEARCH_REMOTE_TOKEN ?? '')
      try {
        return await run(runtime)
      }
      finally {
        await runtime.close()
      }
    }
    await ensureProfile(profile)
    let runtime: CommandRuntime
    try {
      runtime = await connectDaemon(paths) ?? await createCliRuntime(paths, { remote })
    }
    catch (error) {
      if (!remote)
        throw error
      emitResult({ ok: false, error: toAppError(error) }, outputMeta(profile, 'telegram'))
      return undefined
    }
    try {
      return await run(runtime)
    }
    finally {
      await runtime.close()
    }
  }
  finally {
    cleanup()
  }
}

function outputMeta(profile: string, source: OutputMeta['source'], runtime?: CommandRuntime): OutputMeta {
  return { profile, source: runtime && 'remote' in runtime ? 'remote' : source, execution: runtime?.execution ?? { mode: 'cli', cli: runtimeBuildInfo(import.meta.url) } }
}

function nextCursorOf(value: unknown): string | null | undefined {
  if (!value || typeof value !== 'object' || !('nextCursor' in value))
    return undefined
  const nextCursor = (value as { nextCursor?: unknown }).nextCursor
  return typeof nextCursor === 'string' || nextCursor === null ? nextCursor : undefined
}

export function emitResult<T>(result: AppResult<T>, meta: OutputMeta): void {
  if (!result.ok) {
    writeFailure(result.error, meta)
    process.exitCode = 1
    return
  }
  const data = result.data
  writeOutput(data, meta, nextCursorOf(data))
}

async function emitRetryingTelegramResult<T>(operation: () => Promise<AppResult<T>>, meta: OutputMeta): Promise<void> {
  const result = await operation()
  emitResult(result, meta)
}

interface StreamUpdate { type: string, error?: AppError }

export async function emitStreamResult<T extends StreamUpdate>(stream: AsyncIterable<T>, meta: OutputMeta): Promise<void> {
  let terminal: T | undefined
  for await (const update of stream) {
    if (terminal)
      throw new Error(`Stream emitted ${update.type} after terminal state ${terminal.type}`)
    if (update.type === 'completed' || update.type === 'failed')
      terminal = update
    else
      writeProgress(update)
  }

  if (!terminal)
    throw new Error('Stream ended without a terminal completed or failed update')
  if (terminal.type === 'failed') {
    writeFailure(terminal.error ?? {
      code: 'STREAM_FAILED',
      message: 'Stream failed without a structured error',
      retryable: false,
    }, meta)
    process.exitCode = 1
    return
  }
  writeOutput(terminal, meta)
}

const profileCommand = defineCommand({
  meta: { name: 'profile', description: 'Manage isolated local profiles' },
  subCommands: {
    remote: defineCommand({
      meta: { name: 'remote', description: 'Configure a remote TGS URL for this profile' },
      args: { url: { type: 'positional', required: true }, ...profileArg },
      async run(context) {
        const remoteUrl = normalizeRemoteUrl(stringArg(context.args.url))
        const profile = profileFrom(context)
        const paths = await ensureProfile(profile)
        await writeProfileConfig(paths, { ...await readProfileConfig(paths), remoteUrl })
        writeOutput({ profile, remoteUrl }, outputMeta(profile, 'local'))
      },
    }),
    list: defineCommand({
      meta: { name: 'list', description: 'List profiles' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        writeOutput({ profiles: await listProfiles() }, outputMeta(profile, 'local'))
      },
    }),
    inspect: defineCommand({
      meta: { name: 'inspect', description: 'Show configuration presence and sources without secret values' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        writeOutput(await inspectProfile(resolveProfilePaths(profile), process.env, context.args.remote), outputMeta(profile, 'local'))
      },
    }),
    doctor: defineCommand({
      meta: { name: 'doctor', description: 'Inspect configuration and the current local daemon without a Telegram network probe' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        const paths = resolveProfilePaths(profile)
        const inspection = await inspectProfile(paths, process.env, context.args.remote)
        if (inspection.mode === 'remote') {
          writeOutput({ ...inspection, daemon: { state: 'not-applicable' } }, outputMeta(profile, 'local'))
          return
        }
        const daemon = await connectDaemon(paths)
        try {
          writeOutput({ ...inspection, daemon: daemon ? await daemon.invokes.daemon.status({}, { signal: AbortSignal.timeout(5_000) }) : { state: 'stopped' } }, outputMeta(profile, 'local'))
        }
        finally {
          daemon?.close()
        }
      },
    }),
    create: defineCommand({
      meta: { name: 'create', description: 'Create a profile' },
      args: { name: { type: 'positional', required: true }, ...profileArg },
      async run({ args }) {
        const name = stringArg(args.name)
        await ensureProfile(name)
        writeOutput({ profile: name }, outputMeta(name, 'local'))
      },
    }),
    configure: defineCommand({
      meta: { name: 'configure', description: 'Set Telegram API credentials for the selected profile' },
      args: {
        apiId: { type: 'string', required: true },
        apiHash: { type: 'string', required: true },
        ...profileArg,
      },
      async run(context) {
        const profile = profileFrom(context)
        const paths = await ensureProfile(profile)
        const existing = await readProfileConfig(paths)
        await writeProfileConfig(paths, { ...existing, apiId: stringArg(context.args.apiId), apiHash: stringArg(context.args.apiHash) })
        writeOutput({ profile, configured: true }, outputMeta(profile, 'local'))
      },
    }),
  },
})

const authCommand = defineCommand({
  meta: { name: 'auth', description: 'Authenticate a Telegram profile locally' },
  subCommands: {
    login: defineCommand({
      meta: { name: 'login', description: 'Interactive Telegram login' },
      args: { phone: { type: 'string' }, ...profileArg },
      async run(context) {
        const profile = profileFrom(context)
        const paths = await ensureProfile(profile)
        const config = await readProfileConfig(paths)
        const apiId = config.apiId ?? process.env.TELEGRAM_API_ID
        const apiHash = config.apiHash ?? process.env.TELEGRAM_API_HASH
        if (!apiId || !apiHash)
          throw cliError({ code: 'TELEGRAM_CREDENTIALS_REQUIRED', message: 'Configure Telegram API credentials first', retryable: false })

        const client = new TelegramClient(new StringSession(''), Number(apiId), apiHash, {
          ...CLI_TELEGRAM_CLIENT_OPTIONS,
          baseLogger: createGramJsStderrLogger(),
        })
        try {
          const prompts = createAuthPrompts({
            phone: stringArg(context.args.phone),
            question: async (message) => {
              const readline = createInterface({ input: process.stdin, output: process.stderr })
              try {
                return await readline.question(message)
              }
              finally {
                readline.close()
              }
            },
          })
          let authFailureCount = 0
          let lastAuthError: Error | undefined
          try {
            await client.start({
              ...prompts,
              onError: async (error) => {
                authFailureCount += 1
                lastAuthError = error
                writeProgress({ type: 'auth-error', message: error.message })

                const classified = toAppError(error)
                return shouldStopAuthFlow(classified, authFailureCount)
              },
            })
          }
          catch (error) {
            emitResult({ ok: false, error: toAppError(lastAuthError ?? error) }, outputMeta(profile, 'telegram'))
            return
          }
          const me = await client.getMe()
          await writeSession(paths, String(client.session.save()))
          const daemon = await connectDaemon(paths)
          if (daemon) {
            try {
              const daemonStatus = await daemon.invokes.daemon.reload({})
              if (daemonStatus.state !== 'ready')
                throw new Error(daemonStatus.error ?? `Daemon reload ended in state ${daemonStatus.state}`)
            }
            finally {
              daemon.close()
            }
          }
          writeOutput({ profile, userId: String(me.id), username: me.username }, outputMeta(profile, 'telegram'))
        }
        finally {
          await closeOwnedTelegramClient(client)
        }
      },
    }),
  },
})

const chatsCommand = defineCommand({
  meta: { name: 'chats', description: 'Discover Telegram chats without persisting messages' },
  subCommands: {
    list: defineCommand({
      meta: { name: 'list', description: 'List remote chats' },
      args: { limit: { type: 'string', default: '100' }, cursor: { type: 'string' }, ...profileArg, ...readOutputArgs },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, true, async runtime => emitRetryingTelegramResult(
          () => runtime.invokes.chats.list({
            limit: Number(context.args.limit),
            cursor: stringArg(context.args.cursor) || undefined,
          }),
          outputMeta(profile, 'telegram', runtime),
        ))
      },
    }),
  },
})

const mediaCommand = defineCommand({
  meta: { name: 'media', description: 'Explicit bounded reads of message attachments' },
  subCommands: {
    read: defineCommand({
      meta: { name: 'read', description: 'Read one attachment byte range; local never falls back to Telegram' },
      args: {
        'chat': { type: 'string', required: true },
        'message': { type: 'string', required: true },
        'source': { type: 'string', required: true, description: 'local or telegram' },
        'index': { type: 'string', default: '0' },
        'offset': { type: 'string', default: '0' },
        'length': { type: 'string', default: '65536' },
        'max-bytes': { type: 'string', default: '10485760' },
        ...profileArg,
        ...readOutputArgs,
      },
      async run(context) {
        const profile = profileFrom(context)
        const source = stringArg(context.args.source)
        if (source !== 'local' && source !== 'telegram')
          throw new Error('Media source must be local or telegram')
        await withRuntime(context, source === 'telegram', async runtime => emitResult(
          await runtime.invokes.media.read({
            source,
            chatId: stringArg(context.args.chat),
            messageId: stringArg(context.args.message),
            mediaIndex: Number(context.args.index),
            offset: Number(context.args.offset),
            length: Number(context.args.length),
            maxBytes: Number(context.args['max-bytes']),
          }),
          outputMeta(profile, source === 'telegram' ? 'telegram' : 'local', runtime),
        ))
      },
    }),
  },
})

const messagesCommand = defineCommand({
  meta: { name: 'messages', description: 'Read remote or persisted local messages' },
  subCommands: {
    replies: defineCommand({
      meta: { name: 'replies', description: 'Expand reply relationships with depth and node budgets' },
      args: { chat: { type: 'string', required: true }, ids: { type: 'string', required: true }, source: { type: 'string', required: true }, depth: { type: 'string', default: '1' }, nodes: { type: 'string', default: '100' }, ...profileArg, ...readOutputArgs },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, context.args.source === 'telegram', async runtime => emitResult(await runtime.invokes.messages.replies({
          source: context.args.source as 'local' | 'telegram',
          chatId: stringArg(context.args.chat),
          messageIds: stringArg(context.args.ids).split(',').map(id => id.trim()),
          maxDepth: Number(context.args.depth),
          maxNodes: Number(context.args.nodes),
        }), outputMeta(profile, context.args.source as 'local' | 'telegram', runtime)))
      },
    }),
    read: defineCommand({
      meta: { name: 'read', description: 'Read a time window through bounded pages and report coverage' },
      args: { 'chat': { type: 'string', required: true }, 'source': { type: 'string', required: true }, 'cursor': { type: 'string' }, 'from': { type: 'string' }, 'to': { type: 'string' }, 'page-size': { type: 'string', default: '100' }, 'max-pages': { type: 'string', default: '10' }, 'max-messages': { type: 'string', default: '1000' }, ...profileArg, ...readOutputArgs },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, context.args.source === 'telegram', async runtime => emitResult(await runtime.invokes.messages.read({
          source: context.args.source as 'local' | 'telegram',
          chatId: stringArg(context.args.chat),
          cursor: stringArg(context.args.cursor) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
          pageSize: Number(context.args['page-size']),
          maxPages: Number(context.args['max-pages']),
          maxMessages: Number(context.args['max-messages']),
        }), outputMeta(profile, context.args.source as 'local' | 'telegram', runtime)))
      },
    }),
    get: defineCommand({
      meta: { name: 'get', description: 'Get up to 100 messages by ID from an explicit source' },
      args: { chat: { type: 'string', required: true }, ids: { type: 'string', required: true }, source: { type: 'string', required: true }, ...profileArg, ...readOutputArgs },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, context.args.source === 'telegram', async runtime => emitResult(await runtime.invokes.messages.get({
          source: context.args.source as 'local' | 'telegram',
          chatId: stringArg(context.args.chat),
          messageIds: stringArg(context.args.ids).split(',').map(id => id.trim()),
        }), outputMeta(profile, context.args.source as 'local' | 'telegram', runtime)))
      },
    }),
    list: defineCommand({
      meta: { name: 'list', description: 'Read remote messages without persistence' },
      args: {
        chat: { type: 'string', required: true },
        limit: { type: 'string', default: '100' },
        cursor: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        sender: { type: 'string' },
        query: { type: 'string', description: 'Search message text on Telegram' },
        ...profileArg,
        ...readOutputArgs,
      },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, true, async runtime => emitRetryingTelegramResult(
          () => runtime.invokes.messages.listRemote({
            chatId: stringArg(context.args.chat),
            limit: Number(context.args.limit),
            cursor: stringArg(context.args.cursor) || undefined,
            query: stringArg(context.args.query) || undefined,
            fromUserId: stringArg(context.args.sender) || undefined,
            from: parseTimestamp(stringArg(context.args.from)),
            to: parseTimestamp(stringArg(context.args.to)),
          }),
          outputMeta(profile, 'telegram', runtime),
        ))
      },
    }),
    query: defineCommand({
      meta: { name: 'query', description: 'Query persisted local messages' },
      args: {
        chat: { type: 'string' },
        limit: { type: 'string', default: '100' },
        cursor: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        sender: { type: 'string' },
        ...profileArg,
        ...readOutputArgs,
      },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(context, false, async runtime => emitResult(await runtime.invokes.messages.queryLocal({
          chatIds: parseChatIds(stringArg(context.args.chat)),
          fromUserId: stringArg(context.args.sender) || undefined,
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
        }), outputMeta(profile, 'local', runtime)))
      },
    }),
  },
})

const searchCommand = defineCommand({
  meta: { name: 'search', description: 'Search persisted local messages' },
  args: {
    query: { type: 'positional', required: true },
    chat: { type: 'string' },
    limit: { type: 'string', default: '100' },
    from: { type: 'string' },
    to: { type: 'string' },
    ...profileArg,
    ...readOutputArgs,
  },
  async run(context) {
    const profile = profileFrom(context)
    await withRuntime(context, false, async runtime => emitResult(await runtime.invokes.messages.searchLocal({
      query: context.args.query,
      chatIds: parseChatIds(context.args.chat),
      limit: Number(context.args.limit),
      useVector: false,
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    }), outputMeta(profile, 'local', runtime)))
  },
})

const contextCommand = defineCommand({
  meta: { name: 'context', description: 'Read local time neighbors of a target; does not expand reply relationships' },
  args: {
    chat: { type: 'string', required: true },
    message: { type: 'string', required: true },
    before: { type: 'string', default: '20' },
    after: { type: 'string', default: '20' },
    ...profileArg,
    ...readOutputArgs,
  },
  async run(context) {
    const profile = profileFrom(context)
    await withRuntime(context, false, async runtime => emitResult(await runtime.invokes.messages.contextLocal({
      chatId: context.args.chat,
      messageId: context.args.message,
      before: Number(context.args.before),
      after: Number(context.args.after),
    }), outputMeta(profile, 'local', runtime)))
  },
})

const statsCommand = defineCommand({
  meta: { name: 'stats', description: 'Aggregate persisted local messages' },
  args: {
    groupBy: { type: 'string', default: 'month' },
    timezone: { type: 'string', default: 'UTC' },
    chat: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    ...profileArg,
    ...readOutputArgs,
  },
  async run(context) {
    const groupBy = context.args.groupBy as 'month' | 'chat' | 'sender'
    const profile = profileFrom(context)
    await withRuntime(context, false, async runtime => emitResult(await runtime.invokes.stats.get({
      groupBy,
      timeZone: context.args.timezone,
      chatIds: parseChatIds(context.args.chat),
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    }), outputMeta(profile, 'local', runtime)))
  },
})

const syncCommand = defineCommand({
  meta: { name: 'sync', description: 'Persist messages with explicitly authorized Telegram Takeout' },
  args: {
    chat: { type: 'string' },
    all: { type: 'boolean', default: false },
    takeout: { type: 'boolean', default: false },
    limit: { type: 'string', default: '100000' },
    from: { type: 'string' },
    to: { type: 'string' },
    ...profileArg,
  },
  async run(context) {
    const chatIds = parseChatIds(context.args.chat) ?? []
    if (!context.args.all && chatIds.length === 0)
      throw cliError({ code: 'INVALID_ARGUMENT', message: 'sync requires --chat <id[,id]> or --all', retryable: false })
    const profile = profileFrom(context)
    await withRuntime(context, true, async (runtime) => {
      await emitStreamResult(runtime.streams.sync({
        chatIds,
        all: context.args.all,
        takeout: context.args.takeout,
        limit: Number(context.args.limit),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      }), outputMeta(profile, 'telegram', runtime))
    })
  },
})

const daemonCommand = defineCommand({
  meta: { name: 'daemon', description: 'Run and control the local Telegram daemon' },
  subCommands: {
    run: defineCommand({
      meta: { name: 'run', description: 'Run the daemon in the foreground' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        await runDaemon(await ensureProfile(profile), profile)
      },
    }),
    status: defineCommand({
      meta: { name: 'status', description: 'Show the daemon status for this profile' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        const daemon = await connectDaemon(await ensureProfile(profile))
        if (!daemon) {
          writeOutput({ profile, state: 'stopped' }, outputMeta(profile, 'local'))
          return
        }
        try {
          writeOutput(await daemon.invokes.daemon.status({}, { signal: AbortSignal.timeout(5_000) }), outputMeta(profile, 'local', daemon))
        }
        finally {
          daemon.close()
        }
      },
    }),
    reload: defineCommand({
      meta: { name: 'reload', description: 'Reload the saved session when daemon configuration has changed' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        const daemon = await connectDaemon(resolveProfilePaths(profile))
        if (!daemon)
          throw new Error('Daemon is stopped; run daemon run first')
        try {
          const result = await daemon.invokes.daemon.reload({}, { signal: AbortSignal.timeout(65_000) })
          writeOutput(result, outputMeta(profile, 'local', daemon))
          if (result.state !== 'ready')
            process.exitCode = 1
        }
        finally {
          daemon.close()
        }
      },
    }),
    recover: defineCommand({
      meta: { name: 'recover', description: 'Rebuild the daemon-owned Telegram runtime from saved credentials and session' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        const daemon = await connectDaemon(resolveProfilePaths(profile))
        if (!daemon)
          throw new Error('Daemon is stopped; run daemon run first')
        try {
          const before = await daemon.invokes.daemon.status({}, { signal: AbortSignal.timeout(5_000) })
          const recovery = await daemon.invokes.daemon.recover({}, { signal: AbortSignal.timeout(65_000) })
          if (!recovery.ok) {
            emitResult(recovery, outputMeta(profile, 'local', daemon))
            return
          }
          const after = recovery.data
          writeOutput({ before, after }, outputMeta(profile, 'local', daemon))
          if (after.state !== 'ready')
            process.exitCode = 1
        }
        finally {
          daemon.close()
        }
      },
    }),
    stop: defineCommand({
      meta: { name: 'stop', description: 'Stop the daemon for this profile' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        const result = await stopDaemon(resolveProfilePaths(profile))
        writeOutput(result ?? { profile, state: 'stopped' }, outputMeta(profile, 'local'))
      },
    }),
  },
})

const exportCommand = defineCommand({
  meta: { name: 'export', description: 'Export persisted messages as deterministic monthly JSONL' },
  args: {
    output: { type: 'string' },
    chat: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    format: { type: 'string', default: 'jsonl' },
    timezone: { type: 'string', default: 'UTC' },
    ...profileArg,
  },
  async run(context) {
    const profile = profileFrom(context)
    const paths = resolveProfilePaths(profile)
    await withRuntime(context, false, async (runtime) => {
      await emitStreamResult(runtime.streams.export({
        outputDir: resolveExportOutputPath(context.args.output, paths.exports),
        format: context.args.format as 'jsonl',
        timeZone: context.args.timezone,
        chatIds: parseChatIds(context.args.chat),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      }), outputMeta(profile, 'local', runtime))
    })
  },
})

export const main = defineCommand({
  meta: { name: 'tg-search', version: CLI_VERSION, description: 'Agent-friendly local Telegram search and export CLI' },
  args: profileArg,
  subCommands: {
    profile: profileCommand,
    daemon: daemonCommand,
    auth: authCommand,
    chats: chatsCommand,
    messages: messagesCommand,
    media: mediaCommand,
    search: searchCommand,
    context: contextCommand,
    stats: statsCommand,
    sync: syncCommand,
    export: exportCommand,
  },
})

export function normalizeRawArgs(args: string[]): string[] {
  const normalized: string[] = []
  let profile: string | undefined
  let remote: string | undefined
  let json: boolean | undefined
  let index = 0
  while (index < args.length) {
    if (args[index] === '--')
      break
    if (args[index] === '--no-json') {
      json = false
      index += 1
      continue
    }
    if (args[index] === '--json') {
      const value = args[index + 1]
      json = value !== 'false'
      index += value === 'true' || value === 'false' ? 2 : 1
      continue
    }
    if (args[index].startsWith('--json=')) {
      json = args[index].slice('--json='.length) !== 'false'
      index += 1
      continue
    }
    if (args[index] === '--remote' && args[index + 1] && !args[index + 1].startsWith('-')) {
      remote = args[index + 1]
      index += 2
    }
    else if (args[index].startsWith('--remote=')) {
      remote = args[index].slice('--remote='.length)
      index += 1
    }
    else if (args[index] === '--profile' && args[index + 1] && !args[index + 1].startsWith('-')) {
      profile = args[index + 1]
      index += 2
    }
    else if (args[index].startsWith('--profile=')) {
      profile = args[index].slice('--profile='.length)
      index += 1
    }
    else {
      normalized.push(args[index])
      index += 1
    }
  }
  if (profile !== undefined)
    normalized.push(`--profile=${profile}`)
  if (remote !== undefined)
    normalized.push(`--remote=${remote}`)
  if (json !== undefined)
    normalized.push(json ? '--json' : '--json=false')
  normalized.push(...args.slice(index))
  return normalized
}

function profileFromRawArgs(args: string[]): string {
  return args.find(arg => arg.startsWith('--profile='))?.slice('--profile='.length) || 'default'
}

async function validateCommandPath(command: Pick<CommandDef, 'subCommands'>, args: string[]): Promise<void> {
  const children = await (typeof command.subCommands === 'function' ? command.subCommands() : command.subCommands)
  if (!children)
    return
  const index = args.findIndex(arg => !arg.startsWith('-'))
  if (index < 0)
    return
  const name = args[index]
  const child = children[name]
  if (!child) {
    throw cliError({
      code: 'UNKNOWN_COMMAND',
      message: `Unknown command: ${name}`,
      retryable: false,
      details: { availableCommands: Object.keys(children).sort() },
    })
  }
  await validateCommandPath(await (typeof child === 'function' ? child() : child), args.slice(index + 1))
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const normalizedArgs = normalizeRawArgs(args)
  const terminator = normalizedArgs.indexOf('--')
  const optionArgs = terminator < 0 ? normalizedArgs : normalizedArgs.slice(0, terminator)
  resetOutputState(initialOutputFormat(optionArgs))
  const profile = profileFromRawArgs(optionArgs)
  const frameworkOptionArgs = optionArgs.filter(arg => arg !== '--json' && arg !== '--json=false')
  const frameworkArgs = [...frameworkOptionArgs, ...(terminator < 0 ? [] : normalizedArgs.slice(terminator))]
  try {
    const output = readOutputOptions(normalizedArgs)
    resetOutputState(output.format, output.file)
    await validateCommandPath(main, frameworkArgs)
    if (['auth', 'daemon'].includes(normalizedArgs[0])) {
      const config = await readProfileConfig(resolveProfilePaths(profile))
      if (optionArgs.some(arg => arg.startsWith('--remote=')) || process.env.TG_SEARCH_REMOTE_URL !== undefined || config.remoteUrl !== undefined)
        throw cliError({ code: 'LOCAL_PROFILE_REQUIRED', message: 'auth and daemon manage local profiles only; use a separate local profile', retryable: false })
    }
    if (frameworkOptionArgs.includes('--help') || frameworkOptionArgs.includes('-h') || (frameworkOptionArgs.length === 1 && frameworkOptionArgs[0] === '--version'))
      await runMain(main, { rawArgs: frameworkArgs })
    else
      await runCommand(main, { rawArgs: normalizedArgs })
  }
  catch (error) {
    const failure = toCliError(error)
    const hadOutput = hasWrittenOutput()
    if (!hadOutput)
      writeFailure(failure, outputMeta(profile, 'cli'))
    else
      process.stderr.write(isJsonOutput() ? `${JSON.stringify({ ok: false, error: failure, meta: outputMeta(profile, 'cli') })}\n` : `${failure.code}: ${failure.message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
