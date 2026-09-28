import type { TelegramClient } from 'telegram'

import { Api } from 'telegram'
import { Raw } from 'telegram/events'

export function withLoginAbort<Result>(operation: Promise<Result>, signal: AbortSignal): Promise<Result> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted)
      abort()
  })
}

export async function signInWithQrCode(
  client: Pick<TelegramClient, 'invoke' | '_switchDC' | 'addEventHandler' | 'removeEventHandler' | 'signInWithPassword'>,
  credentials: { apiId: number, apiHash: string },
  options: {
    signal: AbortSignal
    qrCode: (code: { url: string, expires: number }) => void
    password: () => Promise<string>
    passwordInvalid: () => void
  },
) {
  const { signal } = options
  let updateVersion = 0
  let wake: (() => void) | undefined
  const onUpdate = () => {
    updateVersion++
    wake?.()
  }
  const event = new Raw({ types: [Api.UpdateLoginToken] })
  client.addEventHandler(onUpdate, event)

  try {
    while (true) {
      signal.throwIfAborted()
      const version = updateVersion
      let result = await withLoginAbort(client.invoke(new Api.auth.ExportLoginToken({
        ...credentials,
        exceptIds: [],
      })), signal)
      signal.throwIfAborted()

      if (result instanceof Api.auth.LoginTokenMigrateTo) {
        await withLoginAbort(client._switchDC(result.dcId), signal)
        signal.throwIfAborted()
        result = await withLoginAbort(client.invoke(new Api.auth.ImportLoginToken({ token: result.token })), signal)
      }

      signal.throwIfAborted()
      if (result instanceof Api.auth.LoginTokenSuccess)
        return

      if (!(result instanceof Api.auth.LoginToken))
        throw new Error('Unexpected QR login response')

      const token = result.token.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
      const expires = result.expires
      options.qrCode({ url: `tg://login?token=${token}`, expires })
      if (updateVersion !== version)
        continue

      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await withLoginAbort(new Promise<void>((resolve) => {
          wake = resolve
          timer = setTimeout(resolve, Math.max(1000, expires * 1000 - Date.now()))
        }), signal)
      }
      finally {
        clearTimeout(timer)
        wake = undefined
      }
    }
  }
  catch (error) {
    signal.throwIfAborted()
    if (!(error instanceof Error) || !('errorMessage' in error) || error.errorMessage !== 'SESSION_PASSWORD_NEEDED')
      throw error

    await withLoginAbort(client.signInWithPassword(credentials, {
      password: async () => {
        signal.throwIfAborted()
        return options.password()
      },
      onError: async (passwordError) => {
        signal.throwIfAborted()
        if ('errorMessage' in passwordError && passwordError.errorMessage === 'PASSWORD_HASH_INVALID') {
          options.passwordInvalid()
          return false
        }
        throw passwordError
      },
    }), signal)
    signal.throwIfAborted()
  }
  finally {
    client.removeEventHandler(onUpdate, event)
  }
}
