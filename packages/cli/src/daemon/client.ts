import type { DaemonStatus } from '@tg-search/protocol'

import type { ProfilePaths } from '../profile'
import type { createCliRuntime } from '../runtime'

import { defineInvokes, defineStreamInvoke } from '@moeru/eventa'
import { connect as connectIpcSocket } from '@moeru/eventa/adapters/unix-socket'
import {
  chatContracts,
  daemonContracts,
  exportContracts,
  messageContracts,
  statsContracts,
  syncContracts,
} from '@tg-search/protocol'

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
      reload: (input: Record<string, never>) => Promise<DaemonStatus>
      status: (input: Record<string, never>) => Promise<DaemonStatus>
      stop: (input: Record<string, never>) => Promise<DaemonStatus>
    }
  }
  close: () => void
}

export async function connectDaemon(paths: ProfilePaths): Promise<DaemonClientRuntime | undefined> {
  const deadline = Date.now() + DAEMON_STARTUP_TIMEOUT_MS
  while (true) {
    const descriptor = await readDescriptor(paths)
    if (descriptor && await isDescriptorOwnerActive(descriptor)) {
      try {
        const connection = await connectIpcSocket(descriptor.socket)
        return {
          invokes: {
            chats: defineInvokes(connection.context, chatContracts),
            messages: defineInvokes(connection.context, messageContracts),
            stats: defineInvokes(connection.context, statsContracts),
            daemon: defineInvokes(connection.context, daemonContracts),
          },
          streams: {
            export: defineStreamInvoke(connection.context, exportContracts.run),
            sync: defineStreamInvoke(connection.context, syncContracts.run),
          },
          close: () => connection.dispose(),
        }
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
