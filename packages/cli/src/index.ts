import type { AppError, AppResult } from '@tg-search/protocol'

import type { OutputMeta } from './output'

import process from 'node:process'

import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'

import { defineCommand, runMain } from 'citty'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

import { closeOwnedTelegramClient, createAuthPrompts } from './auth-support'
import { createGramJsStderrLogger } from './gramjs-logger'
import { hasWrittenEnvelope, resetEnvelopeState, writeFailure, writeOutput, writeProgress } from './output'
import {
  ensureProfile,
  listProfiles,
  readProfileConfig,
  writeProfileConfig,
  writeSession,
} from './profile'
import { createCliRuntime } from './runtime'

const CLI_VERSION = (createRequire(import.meta.url)('../package.json') as { version: string }).version
const profileArg = { profile: { type: 'string' as const, default: 'default' } }

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
    throw new Error(`Invalid date: ${value}`)
  return Math.floor(milliseconds / 1000)
}

function parseChatIds(value: string | undefined): string[] | undefined {
  const ids = value?.split(',').map(item => item.trim()).filter(Boolean)
  return ids?.length ? ids : undefined
}

async function withRuntime<T>(profile: string, remote: boolean, operation: (runtime: Awaited<ReturnType<typeof createCliRuntime>>) => Promise<T>): Promise<T> {
  const paths = await ensureProfile(profile)
  const runtime = await createCliRuntime(paths, { remote })
  try {
    return await operation(runtime)
  }
  finally {
    await runtime.close()
  }
}

function outputMeta(profile: string, source: OutputMeta['source']): OutputMeta {
  return { profile, source }
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
    list: defineCommand({
      meta: { name: 'list', description: 'List profiles' },
      args: profileArg,
      async run(context) {
        const profile = profileFrom(context)
        writeOutput({ profiles: await listProfiles() }, outputMeta(profile, 'local'))
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
          throw new Error('Configure Telegram API credentials first')

        const client = new TelegramClient(new StringSession(''), Number(apiId), apiHash, {
          connectionRetries: 3,
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
          await client.start({
            ...prompts,
            onError: error => writeProgress({ type: 'auth-error', message: error.message }),
          })
          const me = await client.getMe()
          await writeSession(paths, String(client.session.save()))
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
      args: { limit: { type: 'string', default: '100' }, cursor: { type: 'string' }, ...profileArg },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(profile, true, async runtime => emitResult(await runtime.invokes.chats.list({
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
        }), outputMeta(profile, 'telegram')))
      },
    }),
  },
})

const messagesCommand = defineCommand({
  meta: { name: 'messages', description: 'Read remote or persisted local messages' },
  subCommands: {
    list: defineCommand({
      meta: { name: 'list', description: 'Read remote messages without persistence' },
      args: {
        chat: { type: 'string', required: true },
        limit: { type: 'string', default: '100' },
        cursor: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        sender: { type: 'string' },
        ...profileArg,
      },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(profile, true, async runtime => emitResult(await runtime.invokes.messages.listRemote({
          chatId: stringArg(context.args.chat),
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
          fromUserId: stringArg(context.args.sender) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
        }), outputMeta(profile, 'telegram')))
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
      },
      async run(context) {
        const profile = profileFrom(context)
        await withRuntime(profile, false, async runtime => emitResult(await runtime.invokes.messages.queryLocal({
          chatIds: parseChatIds(stringArg(context.args.chat)),
          fromUserId: stringArg(context.args.sender) || undefined,
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
        }), outputMeta(profile, 'local')))
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
  },
  async run(context) {
    const profile = profileFrom(context)
    await withRuntime(profile, false, async runtime => emitResult(await runtime.invokes.messages.searchLocal({
      query: context.args.query,
      chatIds: parseChatIds(context.args.chat),
      limit: Number(context.args.limit),
      useVector: false,
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    }), outputMeta(profile, 'local')))
  },
})

const contextCommand = defineCommand({
  meta: { name: 'context', description: 'Read local messages surrounding a target' },
  args: {
    chat: { type: 'string', required: true },
    message: { type: 'string', required: true },
    before: { type: 'string', default: '20' },
    after: { type: 'string', default: '20' },
    ...profileArg,
  },
  async run(context) {
    const profile = profileFrom(context)
    await withRuntime(profile, false, async runtime => emitResult(await runtime.invokes.messages.contextLocal({
      chatId: context.args.chat,
      messageId: context.args.message,
      before: Number(context.args.before),
      after: Number(context.args.after),
    }), outputMeta(profile, 'local')))
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
  },
  async run(context) {
    const groupBy = context.args.groupBy as 'month' | 'chat' | 'sender'
    const profile = profileFrom(context)
    await withRuntime(profile, false, async runtime => emitResult(await runtime.invokes.stats.get({
      groupBy,
      timeZone: context.args.timezone,
      chatIds: parseChatIds(context.args.chat),
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    }), outputMeta(profile, 'local')))
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
      throw new Error('sync requires --chat <id[,id]> or --all')
    const profile = profileFrom(context)
    await withRuntime(profile, true, async (runtime) => {
      await emitStreamResult(runtime.streams.sync({
        chatIds,
        all: context.args.all,
        takeout: context.args.takeout,
        limit: Number(context.args.limit),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      }), outputMeta(profile, 'telegram'))
    })
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
    const paths = await ensureProfile(profile)
    await withRuntime(profile, false, async (runtime) => {
      await emitStreamResult(runtime.streams.export({
        outputDir: context.args.output || paths.exports,
        format: context.args.format as 'jsonl',
        timeZone: context.args.timezone,
        chatIds: parseChatIds(context.args.chat),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      }), outputMeta(profile, 'local'))
    })
  },
})

export const main = defineCommand({
  meta: { name: 'tg-search', version: CLI_VERSION, description: 'Agent-friendly local Telegram search and export CLI' },
  args: profileArg,
  subCommands: {
    profile: profileCommand,
    auth: authCommand,
    chats: chatsCommand,
    messages: messagesCommand,
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
  let index = 0
  while (index < args.length) {
    if (args[index] === '--json') {
      index += 1
      continue
    }
    if (args[index] === '--profile' && args[index + 1] && !args[index + 1].startsWith('-')) {
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
  return normalized
}

function profileFromRawArgs(args: string[]): string {
  return args.find(arg => arg.startsWith('--profile='))?.slice('--profile='.length) || 'default'
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  resetEnvelopeState()
  const normalizedArgs = normalizeRawArgs(args)
  const profile = profileFromRawArgs(normalizedArgs)
  try {
    await runMain(main, { rawArgs: normalizedArgs })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!hasWrittenEnvelope())
      writeFailure({ code: 'CLI_ERROR', message, retryable: false }, outputMeta(profile, 'cli'))
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
