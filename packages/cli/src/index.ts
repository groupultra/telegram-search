import type { AppResult } from '@tg-search/protocol'

import process from 'node:process'

import { createInterface } from 'node:readline/promises'

import { defineCommand, runMain } from 'citty'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'

import { closeOwnedTelegramClient, createAuthPrompts } from './auth-support'
import { createGramJsStderrLogger } from './gramjs-logger'
import { writeOutput, writeProgress } from './output'
import {
  ensureProfile,
  listProfiles,
  readProfileConfig,
  writeProfileConfig,
  writeSession,
} from './profile'
import { createCliRuntime, unwrap } from './runtime'

interface RootData {
  profile: string
}

function profileFrom(context: { data?: RootData }): string {
  return context.data?.profile ?? 'default'
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

function emitResult<T>(result: AppResult<T>): void {
  writeOutput(unwrap(result))
}

const profileCommand = defineCommand({
  meta: { name: 'profile', description: 'Manage isolated local profiles' },
  subCommands: {
    list: defineCommand({
      meta: { name: 'list', description: 'List profiles' },
      async run() {
        writeOutput({ profiles: await listProfiles() })
      },
    }),
    create: defineCommand({
      meta: { name: 'create', description: 'Create a profile' },
      args: { name: { type: 'positional', required: true } },
      async run({ args }) {
        const name = stringArg(args.name)
        await ensureProfile(name)
        writeOutput({ profile: name })
      },
    }),
    configure: defineCommand({
      meta: { name: 'configure', description: 'Set Telegram API credentials for the selected profile' },
      args: {
        apiId: { type: 'string', required: true },
        apiHash: { type: 'string', required: true },
      },
      async run(context) {
        const profile = profileFrom(context)
        const paths = await ensureProfile(profile)
        const existing = await readProfileConfig(paths)
        await writeProfileConfig(paths, { ...existing, apiId: stringArg(context.args.apiId), apiHash: stringArg(context.args.apiHash) })
        writeOutput({ profile, configured: true })
      },
    }),
  },
})

const authCommand = defineCommand({
  meta: { name: 'auth', description: 'Authenticate a Telegram profile locally' },
  subCommands: {
    login: defineCommand({
      meta: { name: 'login', description: 'Interactive Telegram login' },
      args: { phone: { type: 'string' } },
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
          writeOutput({ profile, userId: String(me.id), username: me.username })
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
      args: { limit: { type: 'string', default: '100' }, cursor: { type: 'string' } },
      async run(context) {
        await withRuntime(profileFrom(context), true, async runtime => emitResult(await runtime.invokes.chats.list({
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
        })))
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
      },
      async run(context) {
        await withRuntime(profileFrom(context), true, async runtime => emitResult(await runtime.invokes.messages.listRemote({
          chatId: stringArg(context.args.chat),
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
          fromUserId: stringArg(context.args.sender) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
        })))
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
      },
      async run(context) {
        await withRuntime(profileFrom(context), false, async runtime => emitResult(await runtime.invokes.messages.queryLocal({
          chatIds: parseChatIds(stringArg(context.args.chat)),
          fromUserId: stringArg(context.args.sender) || undefined,
          limit: Number(context.args.limit),
          cursor: stringArg(context.args.cursor) || undefined,
          from: parseTimestamp(stringArg(context.args.from)),
          to: parseTimestamp(stringArg(context.args.to)),
        })))
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
  },
  async run(context) {
    await withRuntime(profileFrom(context), false, async runtime => emitResult(await runtime.invokes.messages.searchLocal({
      query: context.args.query,
      chatIds: parseChatIds(context.args.chat),
      limit: Number(context.args.limit),
      useVector: false,
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    })))
  },
})

const contextCommand = defineCommand({
  meta: { name: 'context', description: 'Read local messages surrounding a target' },
  args: {
    chat: { type: 'string', required: true },
    message: { type: 'string', required: true },
    before: { type: 'string', default: '20' },
    after: { type: 'string', default: '20' },
  },
  async run(context) {
    await withRuntime(profileFrom(context), false, async runtime => emitResult(await runtime.invokes.messages.contextLocal({
      chatId: context.args.chat,
      messageId: context.args.message,
      before: Number(context.args.before),
      after: Number(context.args.after),
    })))
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
  },
  async run(context) {
    const groupBy = context.args.groupBy as 'month' | 'chat' | 'sender'
    await withRuntime(profileFrom(context), false, async runtime => emitResult(await runtime.invokes.stats.get({
      groupBy,
      timeZone: context.args.timezone,
      chatIds: parseChatIds(context.args.chat),
      from: parseTimestamp(context.args.from),
      to: parseTimestamp(context.args.to),
    })))
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
  },
  async run(context) {
    const chatIds = parseChatIds(context.args.chat) ?? []
    if (!context.args.all && chatIds.length === 0)
      throw new Error('sync requires --chat <id[,id]> or --all')
    await withRuntime(profileFrom(context), true, async (runtime) => {
      let completed: unknown
      for await (const update of runtime.streams.sync({
        chatIds,
        all: context.args.all,
        takeout: context.args.takeout,
        limit: Number(context.args.limit),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      })) {
        if (update.type === 'completed' || update.type === 'failed')
          completed = update
        else
          writeProgress(update)
      }
      writeOutput(completed)
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
  },
  async run(context) {
    const profile = profileFrom(context)
    const paths = await ensureProfile(profile)
    await withRuntime(profile, false, async (runtime) => {
      let completed: unknown
      for await (const update of runtime.streams.export({
        outputDir: context.args.output || paths.exports,
        format: 'jsonl',
        timeZone: context.args.timezone,
        chatIds: parseChatIds(context.args.chat),
        from: parseTimestamp(context.args.from),
        to: parseTimestamp(context.args.to),
      })) {
        if (update.type === 'completed' || update.type === 'failed')
          completed = update
        else
          writeProgress(update)
      }
      writeOutput(completed)
    })
  },
})

export const main = defineCommand({
  meta: { name: 'tg-search', version: '1.2.8', description: 'Agent-friendly local Telegram search and export CLI' },
  args: { profile: { type: 'string', default: 'default' } },
  setup(context) {
    context.data = { profile: context.args.profile } satisfies RootData
  },
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

function normalizeRawArgs(args: string[]): string[] {
  const normalized: string[] = []
  let index = 0
  while (index < args.length) {
    if (args[index] === '--json') {
      index += 1
      continue
    }
    if (args[index] === '--profile' && args[index + 1] && !args[index + 1].startsWith('-')) {
      normalized.push(`--profile=${args[index + 1]}`)
      index += 2
    }
    else {
      normalized.push(args[index])
      index += 1
    }
  }
  return normalized
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMain(main, { rawArgs: normalizeRawArgs(process.argv.slice(2)) }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
