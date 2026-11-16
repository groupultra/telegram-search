import type { ProfilePaths } from './profile'

import { cliError } from './cli-errors'
import { connectDaemon } from './daemon'
import { acquireProfileLock, ProfileLockedError } from './daemon/profile-state'
import { createCliRuntime } from './runtime'

type DirectRuntime = Awaited<ReturnType<typeof createCliRuntime>>
type DaemonRuntime = NonNullable<Awaited<ReturnType<typeof connectDaemon>>>

interface LocalRuntimeDependencies {
  connectDaemon: typeof connectDaemon
  createCliRuntime: typeof createCliRuntime
}

/**
 * Uses the running daemon, or opens the profile database in this process while
 * holding the profile lock. PGlite supports one process per data directory, so
 * "no daemon found, open it myself" without the lock let two commands, or a
 * command and a daemon that started a moment later, open the same files.
 */
export async function openLocalRuntime(
  paths: ProfilePaths,
  options: { remote: boolean, deadlineAt: number, signal: AbortSignal },
  dependencies: LocalRuntimeDependencies = { connectDaemon, createCliRuntime },
): Promise<DaemonRuntime | DirectRuntime> {
  while (true) {
    const daemon = await dependencies.connectDaemon(paths)
    if (daemon)
      return daemon

    let release: () => Promise<void>
    try {
      release = await acquireProfileLock(paths, { role: 'cli', startedAt: Date.now(), wait: options })
    }
    catch (error) {
      if (!(error instanceof ProfileLockedError)) {
        if (options.signal.aborted)
          throw cliError({ code: 'REQUEST_CANCELLED', message: 'Cancelled while waiting for the profile database', retryable: false })
        throw error
      }
      // A daemon took the lock after the check above: connect to it.
      if (error.owner.role === 'daemon')
        continue
      throw cliError({
        code: 'PROFILE_BUSY',
        message: `Another tgs command (PID ${error.owner.pid}) is using this profile's database; retry when it finishes, or run \`tgs daemon run\` to serve commands in parallel`,
        retryable: true,
      })
    }

    let runtime: DirectRuntime
    try {
      runtime = await dependencies.createCliRuntime(paths, { remote: options.remote })
    }
    catch (error) {
      await release()
      throw error
    }
    return {
      ...runtime,
      close: async () => {
        try {
          await runtime.close()
        }
        finally {
          await release()
        }
      },
    }
  }
}
