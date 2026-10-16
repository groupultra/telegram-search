import type { AppResult, DaemonStatus } from '@tg-search/protocol'

import type { ProfilePaths } from '../profile'
import type { createCliRuntime } from '../runtime'

import { defineInvokes, defineStreamInvoke } from '@moeru/eventa'
import { connect as connectIpcSocket } from '@moeru/eventa/adapters/unix-socket'
import { ApplicationError } from '@tg-search/core'
import {
  chatContracts,
  daemonContracts,
  daemonStatusSchema,
  exportContracts,
  mediaContracts,
  messageContracts,
  statsContracts,
  syncContracts,
} from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { runtimeBuildInfo } from '../build-info'
import {
  DAEMON_STARTUP_POLL_MS,
  DAEMON_STARTUP_TIMEOUT_MS,
  isDescriptorOwnerActive,
  isLockOwnerActive,
  readDescriptor,
  readLock,
} from './profile-state'

type CliRuntime = Awaited<ReturnType<typeof createCliRuntime>>

export type DaemonClientRuntime = Pick<CliRuntime, 'streams'> & {
  invokes: CliRuntime['invokes'] & {
    daemon: {
      recover: (input: Record<string, never>, options?: { signal?: AbortSignal }) => Promise<AppResult<DaemonStatus>>
      reload: (input: Record<string, never>, options?: { signal?: AbortSignal }) => Promise<DaemonStatus>
      status: (input: Record<string, never>, options?: { signal?: AbortSignal }) => Promise<DaemonStatus>
      stop: (input: Record<string, never>, options?: { signal?: AbortSignal }) => Promise<DaemonStatus>
    }
  }
  execution: { mode: 'daemon', cli: import('@tg-search/protocol').RuntimeBuild, daemon: import('@tg-search/protocol').RuntimeBuild }
  close: () => void
}

async function connectDaemonSocket(paths: ProfilePaths) {
  const deadline = Date.now() + DAEMON_STARTUP_TIMEOUT_MS
  while (true) {
    const descriptor = await readDescriptor(paths)
    if (descriptor && await isDescriptorOwnerActive(descriptor)) {
      try {
        return await connectIpcSocket(descriptor.socket)
      }
      catch {
        // The descriptor can become visible just before the socket accepts connections.
      }
    }
    const lock = await readLock(paths)
    if (!lock || !await isLockOwnerActive(paths, lock))
      return undefined
    if (Date.now() >= deadline)
      throw new Error(`Daemon startup timed out for profile root ${paths.root}`)
    await new Promise(resolve => setTimeout(resolve, DAEMON_STARTUP_POLL_MS))
  }
}

/** Stop is an owner control action and does not depend on the read/status schema. */
export async function stopDaemon(paths: ProfilePaths): Promise<Pick<DaemonStatus, 'profile' | 'pid' | 'startedAt' | 'state'> | undefined> {
  const connection = await connectDaemonSocket(paths)
  if (!connection)
    return undefined
  try {
    return await defineInvokes(connection.context, daemonContracts).stop({}, { signal: AbortSignal.timeout(5_000) })
  }
  finally {
    connection.dispose()
  }
}

export async function connectDaemon(paths: ProfilePaths): Promise<DaemonClientRuntime | undefined> {
  const connection = await connectDaemonSocket(paths)
  if (!connection)
    return undefined
  try {
    const daemon = defineInvokes(connection.context, daemonContracts)
    const result = safeParse(daemonStatusSchema, await daemon.status({}, { signal: AbortSignal.timeout(5_000) }))
    if (!result.success)
      throw new ApplicationError({ code: 'DAEMON_PROTOCOL_MISMATCH', message: 'The running daemon uses an incompatible status contract; stop and restart it with this CLI build', retryable: false })
    return {
      execution: { mode: 'daemon', cli: runtimeBuildInfo(), daemon: result.output.build },
      invokes: {
        media: defineInvokes(connection.context, mediaContracts),
        chats: defineInvokes(connection.context, chatContracts),
        messages: defineInvokes(connection.context, messageContracts),
        stats: defineInvokes(connection.context, statsContracts),
        daemon,
      },
      streams: {
        export: defineStreamInvoke(connection.context, exportContracts.run),
        sync: defineStreamInvoke(connection.context, syncContracts.run),
      },
      close: () => connection.dispose(),
    }
  }
  catch (error) {
    connection.dispose()
    throw error
  }
}
