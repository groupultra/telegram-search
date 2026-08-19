import type { ProfilePaths } from '../profile'

import process from 'node:process'

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { connect as connectIpcSocket } from '@moeru/eventa/adapters/unix-socket'

export interface DaemonDescriptor {
  pid: number
  profile: string
  processIdentity?: string
  socket: string
  startedAt: number
}

interface DaemonLock {
  pid: number
  processIdentity?: string
  startedAt: number
}

export const DAEMON_STARTUP_TIMEOUT_MS = 30_000
export const DAEMON_STARTUP_POLL_MS = 50

const execFileAsync = promisify(execFile)

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export async function readDescriptor(paths: ProfilePaths): Promise<DaemonDescriptor | undefined> {
  try {
    return JSON.parse(await readFile(paths.daemon, 'utf8')) as DaemonDescriptor
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

export async function removeIfExists(path: string): Promise<void> {
  try {
    await unlink(path)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
}

export async function processIdentity(pid: number): Promise<string | undefined> {
  try {
    if (process.platform === 'linux') {
      const contents = await readFile(`/proc/${pid}/stat`, 'utf8')
      const fields = contents.slice(contents.lastIndexOf(')') + 2).trim().split(/\s+/)
      return fields[19] ? `linux:${fields[19]}` : undefined
    }
    if (process.platform === 'darwin') {
      const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)])
      const started = stdout.trim()
      return started ? `darwin:${started}` : undefined
    }
  }
  catch {
    return undefined
  }
  return undefined
}

export async function readLock(paths: ProfilePaths): Promise<(DaemonLock & { modifiedAt: number }) | undefined> {
  try {
    const [contents, details] = await Promise.all([
      readFile(paths.daemonLock, 'utf8'),
      stat(paths.daemonLock),
    ])
    try {
      const parsed = JSON.parse(contents) as Partial<DaemonLock> | number
      if (typeof parsed === 'object' && parsed !== null && Number.isSafeInteger(parsed.pid)) {
        return {
          pid: parsed.pid!,
          processIdentity: parsed.processIdentity,
          startedAt: parsed.startedAt ?? details.mtimeMs,
          modifiedAt: details.mtimeMs,
        }
      }
      const pid = typeof parsed === 'number' ? parsed : Number.NaN
      return Number.isSafeInteger(pid) ? { pid, startedAt: details.mtimeMs, modifiedAt: details.mtimeMs } : undefined
    }
    catch {
      const pid = Number.parseInt(contents, 10)
      return Number.isSafeInteger(pid) ? { pid, startedAt: details.mtimeMs, modifiedAt: details.mtimeMs } : undefined
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

export async function isLockOwnerActive(paths: ProfilePaths, lock: DaemonLock & { modifiedAt: number }): Promise<boolean> {
  if (!isProcessRunning(lock.pid))
    return false

  const actualIdentity = await processIdentity(lock.pid)
  if (lock.processIdentity && actualIdentity)
    return lock.processIdentity === actualIdentity

  const descriptor = await readDescriptor(paths)
  if (descriptor?.pid === lock.pid) {
    try {
      const connection = await connectIpcSocket(descriptor.socket)
      connection.dispose()
      return true
    }
    catch {
      // A descriptor without a reachable socket is not sufficient proof of ownership.
    }
  }

  return Date.now() - lock.modifiedAt < DAEMON_STARTUP_TIMEOUT_MS
}

export async function isDescriptorOwnerActive(descriptor: DaemonDescriptor): Promise<boolean> {
  if (!isProcessRunning(descriptor.pid))
    return false

  if (!descriptor.processIdentity)
    return true

  const actualIdentity = await processIdentity(descriptor.pid)
  return !actualIdentity || descriptor.processIdentity === actualIdentity
}

export async function acquireProfileLock(paths: ProfilePaths, startedAt: number): Promise<() => Promise<void>> {
  const lock: DaemonLock = {
    pid: process.pid,
    processIdentity: await processIdentity(process.pid),
    startedAt,
  }
  try {
    await writeFile(paths.daemonLock, `${JSON.stringify(lock)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw error

    const existing = await readLock(paths)
    if (existing && await isLockOwnerActive(paths, existing))
      throw new Error(`Daemon already running for profile at PID ${existing.pid}`)

    await removeIfExists(paths.daemonLock)
    return acquireProfileLock(paths, startedAt)
  }
  await chmod(paths.daemonLock, 0o600)
  return async () => removeIfExists(paths.daemonLock)
}

export async function socketPathFor(paths: ProfilePaths): Promise<string> {
  const uid = typeof process.getuid === 'function' ? process.getuid() : process.pid
  const directory = join(tmpdir(), `tg-search-${uid}`)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const digest = createHash('sha256').update(paths.root).digest('hex').slice(0, 24)
  return join(directory, `${digest}.sock`)
}
