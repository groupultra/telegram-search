import type { ProfilePaths } from '../profile'

import process from 'node:process'

import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { chmod, link, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
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

/** `daemon` serves other commands over IPC; `cli` is a one-shot command that opened the database itself. */
export type ProfileLockRole = 'daemon' | 'cli'

interface ProfileLock {
  pid: number
  processIdentity?: string
  startedAt: number
  role: ProfileLockRole
}

/** A lock as read from disk; `raw` identifies this exact lock generation. */
export type HeldProfileLock = ProfileLock & { modifiedAt: number, raw: string }

export class ProfileLockedError extends Error {
  constructor(readonly owner: Pick<ProfileLock, 'pid' | 'role'>) {
    super(owner.role === 'daemon'
      ? `Daemon already running for profile at PID ${owner.pid}`
      : `Profile database is in use by tgs command at PID ${owner.pid}`)
  }
}

const PROFILE_LOCK_POLL_MS = 50

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

export async function readLock(paths: ProfilePaths): Promise<HeldProfileLock | undefined> {
  const lock = await readLockFile(paths)
  return lock === 'unreadable' ? undefined : lock
}

async function readLockFile(paths: ProfilePaths): Promise<HeldProfileLock | 'unreadable' | undefined> {
  try {
    const [raw, details] = await Promise.all([
      readFile(paths.daemonLock, 'utf8'),
      stat(paths.daemonLock),
    ])
    const legacy = (pid: number): HeldProfileLock | 'unreadable' => Number.isSafeInteger(pid)
      ? { pid, startedAt: details.mtimeMs, role: 'daemon', modifiedAt: details.mtimeMs, raw }
      : 'unreadable'
    try {
      const parsed = JSON.parse(raw) as Partial<ProfileLock> | number
      if (typeof parsed === 'object' && parsed !== null && Number.isSafeInteger(parsed.pid)) {
        return {
          pid: parsed.pid!,
          processIdentity: parsed.processIdentity,
          startedAt: parsed.startedAt ?? details.mtimeMs,
          // Locks written before roles existed all belonged to daemons.
          role: parsed.role === 'cli' ? 'cli' : 'daemon',
          modifiedAt: details.mtimeMs,
          raw,
        }
      }
      return legacy(typeof parsed === 'number' ? parsed : Number.NaN)
    }
    catch {
      return legacy(Number.parseInt(raw, 10))
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

export async function isLockOwnerActive(paths: ProfilePaths, lock: Pick<HeldProfileLock, 'pid' | 'processIdentity' | 'role' | 'modifiedAt'>): Promise<boolean> {
  if (!isProcessRunning(lock.pid))
    return false

  const actualIdentity = await processIdentity(lock.pid)
  if (lock.processIdentity && actualIdentity)
    return lock.processIdentity === actualIdentity

  // A one-shot command publishes no descriptor or socket to probe, and it may
  // hold the lock for longer than a daemon takes to start.
  if (lock.role === 'cli')
    return true

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

/**
 * Removes the lock that was judged stale, and only that one. Another starter
 * can replace a stale lock between the staleness check and this call, so an
 * unconditional unlink here would delete a live lock and let two processes
 * own the profile.
 */
async function removeStaleLock(paths: ProfilePaths, staleRaw: string): Promise<void> {
  const claimed = `${paths.daemonLock}.${process.pid}.${randomUUID()}.stale`
  try {
    await rename(paths.daemonLock, claimed)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return
    throw error
  }
  try {
    if (await readFile(claimed, 'utf8') === staleRaw)
      return
    // The renamed file is a newer, live lock: give it back without replacing
    // any lock taken in the meantime.
    await link(claimed, paths.daemonLock).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
        throw error
    })
  }
  finally {
    await rm(claimed, { force: true })
  }
}

function waitForLockPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal!.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, PROFILE_LOCK_POLL_MS)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Takes the lock that marks the single process allowed to open the profile's
 * PGlite database. With `wait`, a lock held by a one-shot command is waited
 * for until `deadlineAt`; a lock held by a daemon always fails at once, because
 * the caller should talk to that daemon instead.
 */
export async function acquireProfileLock(paths: ProfilePaths, options: {
  role: ProfileLockRole
  startedAt: number
  wait?: { deadlineAt: number, signal?: AbortSignal }
}): Promise<() => Promise<void>> {
  const lock: ProfileLock = {
    pid: process.pid,
    processIdentity: await processIdentity(process.pid),
    startedAt: options.startedAt,
    role: options.role,
  }
  const raw = `${JSON.stringify(lock)}\n`
  // Create the lock by hard-linking a complete file: `wx` followed by a write
  // exposes an empty lock that a concurrent starter reads as stale and deletes.
  const temporary = `${paths.daemonLock}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, raw, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  try {
    while (true) {
      options.wait?.signal?.throwIfAborted()
      try {
        await link(temporary, paths.daemonLock)
        break
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
          throw error
      }

      const existing = await readLockFile(paths)
      if (existing === undefined)
        continue
      if (existing === 'unreadable') {
        await removeStaleLock(paths, await readFile(paths.daemonLock, 'utf8').catch(() => ''))
        continue
      }
      if (!await isLockOwnerActive(paths, existing)) {
        await removeStaleLock(paths, existing.raw)
        continue
      }
      if (existing.role === 'daemon' || !options.wait || Date.now() >= options.wait.deadlineAt)
        throw new ProfileLockedError(existing)
      await waitForLockPoll(options.wait.signal)
    }
  }
  finally {
    await rm(temporary, { force: true })
  }

  return async () => {
    // Never remove a lock that another process holds now.
    if (await readFile(paths.daemonLock, 'utf8').catch(() => undefined) === raw)
      await removeIfExists(paths.daemonLock)
  }
}

/** Resolves once `pid` no longer holds the profile lock, or after `timeoutMs`. */
export async function waitForProfileLockRelease(paths: ProfilePaths, pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (true) {
    const lock = await readLock(paths)
    if (!lock || lock.pid !== pid || !await isLockOwnerActive(paths, lock))
      return true
    if (Date.now() >= deadline)
      return false
    await waitForLockPoll()
  }
}

export async function socketPathFor(paths: ProfilePaths): Promise<string> {
  const uid = typeof process.getuid === 'function' ? process.getuid() : process.pid
  const directory = join(tmpdir(), `tg-search-${uid}`)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  const digest = createHash('sha256').update(paths.root).digest('hex').slice(0, 24)
  return join(directory, `${digest}.sock`)
}
