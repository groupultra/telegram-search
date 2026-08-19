import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineInvokeEventa, defineInvokeHandler, defineInvokes, defineStreamInvoke, defineStreamInvokeHandler } from '@moeru/eventa'
import { connect as connectIpcSocket, createServer as createIpcServer } from '@moeru/eventa/adapters/unix-socket'
import { afterEach, describe, expect, it } from 'vitest'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

async function socketPath() {
  const directory = await mkdtemp(join(tmpdir(), 'tg-search-ipc-'))
  directories.push(directory)
  return join(directory, 'daemon.sock')
}

describe('eventa Unix socket adapter', () => {
  it('forwards invoke requests and responses over a framed socket', async () => {
    const path = await socketPath()
    const contract = defineInvokeEventa<number, number>('test.ipc.double')
    const server = await createIpcServer(path, (connection) => {
      defineInvokeHandler(connection.context, contract, input => input * 2)
    })
    const connection = await connectIpcSocket(path)
    const invokes = defineInvokes(connection.context, { double: contract })

    await expect(invokes.double(21)).resolves.toBe(42)

    connection.dispose()
    await server.close()
  })

  it('preserves stream ordering over one connection', async () => {
    const path = await socketPath()
    const contract = defineInvokeEventa<number, number>('test.ipc.stream')
    const server = await createIpcServer(path, (connection) => {
      defineStreamInvokeHandler(connection.context, contract, async function* (input) {
        yield input
        yield input + 1
      })
    })
    const connection = await connectIpcSocket(path)
    const stream = defineStreamInvoke(connection.context, contract)(3)

    await expect(Array.fromAsync(stream)).resolves.toEqual([3, 4])

    connection.dispose()
    await server.close()
  })
})
